/**
 * Job State Machine
 * 
 * Manages job state transitions with proper validation, retry logic,
 * and queue operations for the agent runner system.
 */

import { randomUUID } from 'crypto'
import type { Job, NewJob } from '@/lib/db/schema'
import { jobRepository } from '@/lib/app/persistence/job-repository'

export type JobState = Job['status']
export type JobType = Job['type']

export interface StateTransition {
  from: JobState
  to: JobState
  condition?: (job: Job) => boolean
  action?: (job: Job) => Promise<void>
}

export interface QueueConfig {
  maxRetries: number
  retryDelayMs: number
  retryBackoffMultiplier: number
  maxRetryDelayMs: number
  jobTimeoutMs: number
  maxConcurrentJobs: number
}

/**
 * Job State Machine Class
 * 
 * Handles all job state transitions with validation and side effects.
 */
export class JobStateMachine {
  private config: QueueConfig
  private stateTransitions: Map<string, StateTransition[]> = new Map()

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      maxRetries: 3,
      retryDelayMs: 1000,
      retryBackoffMultiplier: 2,
      maxRetryDelayMs: 60000,
      jobTimeoutMs: 300000, // 5 minutes
      maxConcurrentJobs: 5,
      ...config
    }

    this.initializeTransitions()
  }

  /**
   * Initialize allowed state transitions
   */
  private initializeTransitions() {
    const transitions: StateTransition[] = [
      // Initial transitions
      { from: 'pending', to: 'running' },
      { from: 'pending', to: 'cancelled' },
      
      // Running transitions
      { from: 'running', to: 'completed' },
      { from: 'running', to: 'failed' },
      { from: 'running', to: 'cancelled' },
      
      // Failed transitions (with retry logic)
      { 
        from: 'failed', 
        to: 'retrying',
        condition: (job) => this.canRetry(job),
        action: (job) => this.scheduleRetry(job)
      },
      { from: 'failed', to: 'cancelled' },
      
      // Retrying transitions
      { from: 'retrying', to: 'pending' },
      { from: 'retrying', to: 'cancelled' },
      
      // Final states (no outgoing transitions)
      // 'completed', 'cancelled' are terminal states
    ]

    // Group transitions by from state
    for (const transition of transitions) {
      const key = transition.from
      if (!this.stateTransitions.has(key)) {
        this.stateTransitions.set(key, [])
      }
      this.stateTransitions.get(key)!.push(transition)
    }
  }

  /**
   * Check if a job can be retried
   */
  private canRetry(job: Job): boolean {
    const retryCount = (job as any).retryCount || 0
    const maxRetries = (job as any).maxRetries || this.config.maxRetries
    return retryCount < maxRetries
  }

  /**
   * Schedule a retry for a failed job
   */
  private async scheduleRetry(job: Job): Promise<void> {
    const retryCount = (job as any).retryCount || 0
    const delay = Math.min(
      this.config.retryDelayMs * Math.pow(this.config.retryBackoffMultiplier, retryCount),
      this.config.maxRetryDelayMs
    )
    
    const nextRetryAt = new Date(Date.now() + delay)
    
    await jobRepository.update(job.id, {
      retryCount: retryCount + 1,
      nextRetryAt: nextRetryAt
    })
  }

  /**
   * Validate if a state transition is allowed
   */
  canTransition(from: JobState, to: JobState, job?: Job): boolean {
    const transitions = this.stateTransitions.get(from) || []
    
    return transitions.some(transition => {
      if (transition.to !== to) return false
      
      if (transition.condition && job) {
        return transition.condition(job)
      }
      
      return true
    })
  }

  /**
   * Execute a state transition
   */
  async transition(job: Job, toState: JobState, reason?: string): Promise<Job | null> {
    // Validate transition
    if (!this.canTransition(job.status, toState, job)) {
      throw new Error(
        `Invalid state transition from ${job.status} to ${toState} for job ${job.id}`
      )
    }

    // Get transition to execute any actions
    const transitions = this.stateTransitions.get(job.status) || []
    const transition = transitions.find(t => t.to === toState)

    // Execute transition action if exists
    if (transition?.action) {
      await transition.action(job)
    }

    // Update job status
    const updateData: Partial<Job> = {
      status: toState,
      updatedAt: new Date()
    }

    // Add timestamps based on state
    if (toState === 'running' && !job.startedAt) {
      updateData.startedAt = new Date()
    } else if (['completed', 'failed', 'cancelled'].includes(toState)) {
      updateData.completedAt = new Date()
      if (toState === 'completed') {
        updateData.progress = 1.0
      }
    }

    // Add error message if provided
    if (reason && toState === 'failed') {
      updateData.error = reason
    }

    return await jobRepository.update(job.id, updateData)
  }

  /**
   * Get next available jobs for processing
   */
  async getNextJobs(limit: number = this.config.maxConcurrentJobs): Promise<Job[]> {
    const now = new Date()
    
    // Get jobs that are ready to run
    const jobs = await jobRepository.list({
      limit,
      status: 'pending',
      type: undefined // All job types
    })

    // Filter jobs that are actually ready (including retry delays)
    return jobs.filter(job => {
      if (job.status === 'pending') {
        // Check if job was retrying and delay has passed
        const nextRetryAt = (job as any).nextRetryAt
        if (nextRetryAt) {
          return new Date(nextRetryAt) <= now
        }
        return true
      }
      return false
    })
  }

  /**
   * Check if a job has timed out
   */
  isTimedOut(job: Job): boolean {
    if (!job.startedAt || job.status !== 'running') return false
    
    const timeoutMs = (job as any).timeoutMs || this.config.jobTimeoutMs
    const elapsed = Date.now() - job.startedAt.getTime()
    
    return elapsed > timeoutMs
  }

  /**
   * Handle job timeout
   */
  async handleTimeout(job: Job): Promise<Job | null> {
    if (!this.isTimedOut(job)) return job
    
    return await this.transition(
      job, 
      'failed', 
      `Job timed out after ${Date.now() - job.startedAt!.getTime()}ms`
    )
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
    retrying: number
    overdue: number
  }> {
    const stats = await jobRepository.getStats()
    const overdue = stats.runningJobs.filter(job => this.isTimedOut(job)).length

    return {
      pending: stats.byStatus.pending || 0,
      running: stats.byStatus.running || 0,
      completed: stats.byStatus.completed || 0,
      failed: stats.byStatus.failed || 0,
      cancelled: stats.byStatus.cancelled || 0,
      retrying: stats.byStatus.retrying || 0,
      overdue
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanup(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    return await jobRepository.cleanup(olderThanMs)
  }
}

/**
 * Queue Manager
 * 
 * High-level queue operations with state machine integration.
 */
export class QueueManager {
  private stateMachine: JobStateMachine
  private processingJobs: Set<string> = new Set()

  constructor(config: Partial<QueueConfig> = {}) {
    this.stateMachine = new JobStateMachine(config)
  }

  /**
   * Enqueue a new job
   */
  async enqueue(jobData: Omit<NewJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<Job> {
    const job: NewJob = {
      ...jobData,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    return await jobRepository.create(job)
  }

  /**
   * Dequeue next available jobs
   */
  async dequeue(limit: number = 5): Promise<Job[]> {
    const jobs = await this.stateMachine.getNextJobs(limit)
    
    // Mark jobs as running and track them
    const runningJobs = await Promise.all(
      jobs.map(async (job) => {
        const updated = await this.stateMachine.transition(job, 'running')
        if (updated) {
          this.processingJobs.add(updated.id)
        }
        return updated
      })
    )

    return runningJobs.filter(Boolean) as Job[]
  }

  /**
   * Complete a job successfully
   */
  async completeJob(jobId: string, result?: any): Promise<Job | null> {
    const job = await jobRepository.getById(jobId)
    if (!job) return null

    this.processingJobs.delete(jobId)

    const updateData: Partial<Job> = {
      result: result ? JSON.stringify(result) : undefined
    }

    await jobRepository.update(jobId, updateData)
    return await this.stateMachine.transition(job, 'completed')
  }

  /**
   * Fail a job
   */
  async failJob(jobId: string, error: string, result?: any): Promise<Job | null> {
    const job = await jobRepository.getById(jobId)
    if (!job) return null

    this.processingJobs.delete(jobId)

    const updateData: Partial<Job> = {
      result: result ? JSON.stringify(result) : undefined
    }

    await jobRepository.update(jobId, updateData)
    return await this.stateMachine.transition(job, 'failed', error)
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<Job | null> {
    const job = await jobRepository.getById(jobId)
    if (!job) return null

    this.processingJobs.delete(jobId)
    return await this.stateMachine.transition(job, 'cancelled')
  }

  /**
   * Get processing job IDs
   */
  getProcessingJobIds(): string[] {
    return Array.from(this.processingJobs)
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    return await this.stateMachine.getQueueStats()
  }

  /**
   * Handle overdue jobs
   */
  async handleOverdueJobs(): Promise<number> {
    const stats = await this.getStats()
    const overdueJobs = await jobRepository.list({ 
      status: 'running',
      limit: stats.overdue
    })

    let handled = 0
    for (const job of overdueJobs) {
      if (this.stateMachine.isTimedOut(job)) {
        await this.stateMachine.handleTimeout(job)
        this.processingJobs.delete(job.id)
        handled++
      }
    }

    return handled
  }
}

// Export singleton instances
export const jobStateMachine = new JobStateMachine()
export const queueManager = new QueueManager()
