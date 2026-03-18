/**
 * Job Actions
 * 
 * Server actions for job management with proper validation and error handling.
 */

import { z } from 'zod'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { jobRepository } from '@/lib/app/persistence/job-repository'
import { queueManager } from '@/lib/app/services/job-state-machine'
import type { Job, NewJob } from '@/lib/db/schema'

// Validation schemas
const CreateJobSchema = z.object({
  type: z.enum(['rag_index', 'model_sync', 'batch_process', 'export', 'agent_run']),
  config: z.string().min(1), // JSON string
  maxSteps: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).max(10).default(3),
  priority: z.number().int().min(0).max(100).default(0),
  timeoutMs: z.number().int().positive().optional(),
  metadata: z.string().optional() // JSON string
})

const UpdateJobSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'retrying']).optional(),
  progress: z.number().min(0).max(1).optional(),
  result: z.string().optional(),
  error: z.string().optional()
})

const JobQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'retrying']).optional(),
  type: z.enum(['rag_index', 'model_sync', 'batch_process', 'export', 'agent_run']).optional()
})

/**
 * Create a new job
 */
export async function createJob(input: z.infer<typeof CreateJobSchema>): Promise<{
  success: boolean
  job?: Job
  error?: string
}> {
  try {
    const validated = CreateJobSchema.parse(input)
    
    // Validate config JSON
    let configObj
    try {
      configObj = JSON.parse(validated.config)
    } catch (e) {
      return {
        success: false,
        error: 'Invalid JSON in config field'
      }
    }

    // Validate metadata JSON if provided
    let metadataObj
    if (validated.metadata) {
      try {
        metadataObj = JSON.parse(validated.metadata)
      } catch (e) {
        return {
          success: false,
          error: 'Invalid JSON in metadata field'
        }
      }
    }

    const jobData: Omit<NewJob, 'id' | 'createdAt' | 'updatedAt'> = {
      type: validated.type,
      status: 'pending',
      config: validated.config,
      maxSteps: validated.maxSteps,
      maxRetries: validated.maxRetries,
      priority: validated.priority,
      timeoutMs: validated.timeoutMs,
      metadata: validated.metadata,
      progress: 0
    }

    const job = await queueManager.enqueue(jobData)
    
    revalidatePath('/agents')
    revalidatePath('/monitoring')
    
    return {
      success: true,
      job
    }
  } catch (error) {
    console.error('Failed to create job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Create an agent job with default configuration
 */
export async function createAgentJob(params: {
  prompt: string
  modelProfileId?: string
  maxSteps?: number
  tools?: string[]
  metadata?: Record<string, any>
}): Promise<{
  success: boolean
  job?: Job
  error?: string
}> {
  const config = {
    prompt: params.prompt,
    modelProfileId: params.modelProfileId,
    tools: params.tools || [],
    createdAt: new Date().toISOString()
  }

  return await createJob({
    type: 'agent_run',
    config: JSON.stringify(config),
    maxSteps: params.maxSteps || 50,
    metadata: params.metadata ? JSON.stringify(params.metadata) : undefined
  })
}

/**
 * Get a job by ID
 */
export async function getJob(id: string): Promise<{
  success: boolean
  job?: Job
  error?: string
}> {
  try {
    const job = await jobRepository.getById(id, true) // Include tool runs
    
    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      }
    }

    return {
      success: true,
      job
    }
  } catch (error) {
    console.error('Failed to get job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * List jobs with filtering
 */
export async function listJobs(input: z.infer<typeof JobQuerySchema>): Promise<{
  success: boolean
  jobs?: Job[]
  total?: number
  error?: string
}> {
  try {
    const validated = JobQuerySchema.parse(input)
    
    const jobs = await jobRepository.list({
      limit: validated.limit,
      offset: validated.offset,
      status: validated.status,
      type: validated.type
    })

    const stats = await jobRepository.getStats()
    
    return {
      success: true,
      jobs,
      total: stats.total
    }
  } catch (error) {
    console.error('Failed to list jobs:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Update a job
 */
export async function updateJob(
  id: string, 
  input: z.infer<typeof UpdateJobSchema>
): Promise<{
  success: boolean
  job?: Job
  error?: string
}> {
  try {
    const validated = UpdateJobSchema.parse(input)
    
    const job = await jobRepository.getById(id)
    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      }
    }

    // Validate result JSON if provided
    if (validated.result) {
      try {
        JSON.parse(validated.result)
      } catch (e) {
        return {
          success: false,
          error: 'Invalid JSON in result field'
        }
      }
    }

    const updateData: Partial<Job> = {
      ...validated,
      updatedAt: new Date()
    }

    const updatedJob = await jobRepository.update(id, updateData)
    
    revalidatePath('/agents')
    revalidatePath('/monitoring')
    
    return {
      success: true,
      job: updatedJob
    }
  } catch (error) {
    console.error('Failed to update job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Cancel a job
 */
export async function cancelJob(id: string): Promise<{
  success: boolean
  job?: Job
  error?: string
}> {
  try {
    const job = await queueManager.cancelJob(id)
    
    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      }
    }

    revalidatePath('/agents')
    revalidatePath('/monitoring')
    
    return {
      success: true,
      job
    }
  } catch (error) {
    console.error('Failed to cancel job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Retry a failed job
 */
export async function retryJob(id: string): Promise<{
  success: boolean
  job?: Job
  error?: string
}> {
  try {
    const job = await jobRepository.getById(id)
    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      }
    }

    if (job.status !== 'failed') {
      return {
        success: false,
        error: 'Only failed jobs can be retried'
      }
    }

    // Reset job to pending state
    const updateData: Partial<Job> = {
      status: 'pending',
      error: undefined,
      result: undefined,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined,
      updatedAt: new Date()
    }

    const updatedJob = await jobRepository.update(id, updateData)
    
    revalidatePath('/agents')
    revalidatePath('/monitoring')
    
    return {
      success: true,
      job: updatedJob
    }
  } catch (error) {
    console.error('Failed to retry job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Delete a job
 */
export async function deleteJob(id: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const job = await jobRepository.getById(id)
    if (!job) {
      return {
        success: false,
        error: 'Job not found'
      }
    }

    if (job.status === 'running') {
      return {
        success: false,
        error: 'Cannot delete a running job'
      }
    }

    const deleted = await jobRepository.delete(id)
    
    if (!deleted) {
      return {
        success: false,
        error: 'Failed to delete job'
      }
    }

    revalidatePath('/agents')
    revalidatePath('/monitoring')
    
    return {
      success: true
    }
  } catch (error) {
    console.error('Failed to delete job:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  success: boolean
  stats?: {
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
    retrying: number
    overdue: number
  }
  error?: string
}> {
  try {
    const stats = await queueManager.getStats()
    
    return {
      success: true,
      stats
    }
  } catch (error) {
    console.error('Failed to get queue stats:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Clean up old jobs
 */
export async function cleanupJobs(olderThanDays: number = 7): Promise<{
  success: boolean
  deletedCount?: number
  error?: string
}> {
  try {
    const olderThanMs = olderThanDays * 24 * 60 * 60 * 1000
    const deletedCount = await queueManager.cleanup(olderThanMs)
    
    revalidatePath('/agents')
    revalidatePath('/monitoring')
    
    return {
      success: true,
      deletedCount
    }
  } catch (error) {
    console.error('Failed to cleanup jobs:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
