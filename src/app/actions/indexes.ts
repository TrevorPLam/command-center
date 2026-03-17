/**
 * Index Management Server Actions
 * 
 * Server-side actions for index management operations.
 * Provides type-safe interfaces for client components.
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { IndexManagementService } from '@/lib/app/services/index-management-service'
import { IndexRepository } from '@/lib/app/persistence/index-repository'
import type { CreateIndexRequest, UpdateIndexRequest, ReindexRequest } from '@/lib/app/services/index-management-service'

// Action schemas
const CreateIndexActionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['vector', 'keyword', 'hybrid']),
  config: z.object({
    indexType: z.enum(['vector', 'keyword', 'hybrid']),
    vectorIndexConfig: z.object({
      metric: z.enum(['cosine', 'euclidean', 'dotproduct']),
      ivfLists: z.number().optional(),
      pq: z.number().optional()
    }).optional(),
    keywordIndexConfig: z.object({
      analyzer: z.enum(['standard', 'keyword', 'whitespace']),
      stopwords: z.boolean()
    }).optional(),
    metadataFilters: z.record(z.any()).optional()
  }),
  embeddingModel: z.string().min(1),
  chunkingPolicy: z.object({
    strategy: z.enum(['semantic', 'fixed_size', 'recursive', 'document_structure']),
    maxChunkSize: z.number().min(100).max(8000),
    chunkOverlap: z.number().min(0).max(500),
    minChunkSize: z.number().min(50).optional(),
    preserveFormatting: z.boolean().default(false)
  }),
  description: z.string().max(500).optional()
})

const UpdateIndexActionSchema = z.object({
  indexId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: z.object({
    indexType: z.enum(['vector', 'keyword', 'hybrid']),
    vectorIndexConfig: z.object({
      metric: z.enum(['cosine', 'euclidean', 'dotproduct']),
      ivfLists: z.number().optional(),
      pq: z.number().optional()
    }).optional(),
    keywordIndexConfig: z.object({
      analyzer: z.enum(['standard', 'keyword', 'whitespace']),
      stopwords: z.boolean()
    }).optional()
  }).optional()
})

const DeleteIndexActionSchema = z.object({
  indexId: z.string().min(1),
  force: z.boolean().default(false)
})

const ReindexIndexActionSchema = z.object({
  indexId: z.string().min(1),
  newEmbeddingModel: z.string().min(1).optional(),
  newChunkingPolicy: z.object({
    strategy: z.enum(['semantic', 'fixed_size', 'recursive', 'document_structure']),
    maxChunkSize: z.number().min(100).max(8000),
    chunkOverlap: z.number().min(0).max(500),
    minChunkSize: z.number().min(50).optional(),
    preserveFormatting: z.boolean().default(false)
  }).optional(),
  newIndexingOptions: z.object({
    indexType: z.enum(['vector', 'keyword', 'hybrid']),
    vectorIndexConfig: z.object({
      metric: z.enum(['cosine', 'euclidean', 'dotproduct']),
      ivfLists: z.number().optional(),
      pq: z.number().optional()
    }).optional(),
    keywordIndexConfig: z.object({
      analyzer: z.enum(['standard', 'keyword', 'whitespace']),
      stopwords: z.boolean()
    }).optional()
  }).optional(),
  preserveOldData: z.boolean().default(true)
})

const GetIndexActionSchema = z.object({
  indexId: z.string().min(1)
})

const GetIndexHealthActionSchema = z.object({
  indexId: z.string().min(1)
})

const GetReindexJobStatusActionSchema = z.object({
  jobId: z.string().min(1)
})

const CancelReindexJobActionSchema = z.object({
  jobId: z.string().min(1)
})

// Action types
export type CreateIndexActionInput = z.infer<typeof CreateIndexActionSchema>
export type UpdateIndexActionInput = z.infer<typeof UpdateIndexActionSchema>
export type DeleteIndexActionInput = z.infer<typeof DeleteIndexActionSchema>
export type ReindexIndexActionInput = z.infer<typeof ReindexIndexActionSchema>
export type GetIndexActionInput = z.infer<typeof GetIndexActionSchema>
export type GetIndexHealthActionInput = z.infer<typeof GetIndexHealthActionSchema>
export type GetReindexJobStatusActionInput = z.infer<typeof GetReindexJobStatusActionSchema>
export type CancelReindexJobActionInput = z.infer<typeof CancelReindexJobActionSchema>

export type CreateIndexActionResult = {
  success: boolean
  index?: any
  error?: string
}

export type UpdateIndexActionResult = {
  success: boolean
  index?: any
  error?: string
}

export type DeleteIndexActionResult = {
  success: boolean
  message?: string
  error?: string
}

export type ReindexIndexActionResult = {
  success: boolean
  jobId?: string
  message?: string
  error?: string
}

export type GetIndexActionResult = {
  success: boolean
  index?: any
  error?: string
}

export type GetIndexHealthActionResult = {
  success: boolean
  health?: {
    isHealthy: boolean
    issues: string[]
    recommendations: string[]
    stats: any
  }
  error?: string
}

export type GetReindexJobStatusActionResult = {
  success: boolean
  job?: any
  error?: string
}

export type CancelReindexJobActionResult = {
  success: boolean
  message?: string
  error?: string
}

/**
 * Create a new index
 */
export async function createIndexAction(
  input: CreateIndexActionInput
): Promise<CreateIndexActionResult> {
  try {
    const validated = CreateIndexActionSchema.parse(input)
    
    const request: CreateIndexRequest = {
      name: validated.name,
      type: validated.type,
      config: validated.config,
      embeddingModel: validated.embeddingModel,
      chunkingPolicy: validated.chunkingPolicy,
      description: validated.description
    }
    
    const index = await IndexManagementService.createIndex(request)
    
    // Revalidate RAG page to show new index
    revalidatePath('/(command-center)/@rag')
    
    return {
      success: true,
      index
    }
    
  } catch (error) {
    console.error('Create index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create index'
    }
  }
}

/**
 * Update an existing index
 */
export async function updateIndexAction(
  input: UpdateIndexActionInput
): Promise<UpdateIndexActionResult> {
  try {
    const validated = UpdateIndexActionSchema.parse(input)
    
    const request: UpdateIndexRequest = {
      name: validated.name,
      description: validated.description,
      config: validated.config
    }
    
    const index = await IndexManagementService.updateIndex(validated.indexId, request)
    
    // Revalidate RAG page
    revalidatePath('/(command-center)/@rag')
    
    return {
      success: true,
      index
    }
    
  } catch (error) {
    console.error('Update index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update index'
    }
  }
}

/**
 * Delete an index
 */
export async function deleteIndexAction(
  input: DeleteIndexActionInput
): Promise<DeleteIndexActionResult> {
  try {
    const validated = DeleteIndexActionSchema.parse(input)
    
    await IndexManagementService.deleteIndex(validated.indexId, validated.force)
    
    // Revalidate RAG page
    revalidatePath('/(command-center)/@rag')
    
    return {
      success: true,
      message: `Index ${validated.indexId} deleted successfully`
    }
    
  } catch (error) {
    console.error('Delete index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete index'
    }
  }
}

/**
 * Reindex an index
 */
export async function reindexIndexAction(
  input: ReindexIndexActionInput
): Promise<ReindexIndexActionResult> {
  try {
    const validated = ReindexIndexActionSchema.parse(input)
    
    const request: ReindexRequest = {
      indexId: validated.indexId,
      newEmbeddingModel: validated.newEmbeddingModel,
      newChunkingPolicy: validated.newChunkingPolicy,
      newIndexingOptions: validated.newIndexingOptions,
      preserveOldData: validated.preserveOldData
    }
    
    // Get runtime adapter (would be injected properly)
    const runtime = {} as any // Placeholder
    
    const jobId = await IndexManagementService.reindexIndex(request, runtime)
    
    // Revalidate RAG page to show new job
    revalidatePath('/(command-center)/@rag')
    
    return {
      success: true,
      jobId,
      message: `Reindex job started with ID: ${jobId}`
    }
    
  } catch (error) {
    console.error('Reindex index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start reindex'
    }
  }
}

/**
 * Get index details
 */
export async function getIndexAction(
  input: GetIndexActionInput
): Promise<GetIndexActionResult> {
  try {
    const validated = GetIndexActionSchema.parse(input)
    
    const index = await IndexRepository.getIndex(validated.indexId)
    
    if (!index) {
      return {
        success: false,
        error: 'Index not found'
      }
    }
    
    return {
      success: true,
      index
    }
    
  } catch (error) {
    console.error('Get index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get index'
    }
  }
}

/**
 * Get index health
 */
export async function getIndexHealthAction(
  input: GetIndexHealthActionInput
): Promise<GetIndexHealthActionResult> {
  try {
    const validated = GetIndexHealthActionSchema.parse(input)
    
    const health = await IndexManagementService.getIndexHealth(validated.indexId)
    
    return {
      success: true,
      health
    }
    
  } catch (error) {
    console.error('Get index health action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get index health'
    }
  }
}

/**
 * Get reindex job status
 */
export async function getReindexJobStatusAction(
  input: GetReindexJobStatusActionInput
): Promise<GetReindexJobStatusActionResult> {
  try {
    const validated = GetReindexJobStatusActionSchema.parse(input)
    
    const job = await IndexManagementService.getReindexJobStatus(validated.jobId)
    
    return {
      success: true,
      job
    }
    
  } catch (error) {
    console.error('Get reindex job status action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job status'
    }
  }
}

/**
 * Cancel reindex job
 */
export async function cancelReindexJobAction(
  input: CancelReindexJobActionInput
): Promise<CancelReindexJobActionResult> {
  try {
    const validated = CancelReindexJobActionSchema.parse(input)
    
    await IndexManagementService.cancelReindexJob(validated.jobId)
    
    // Revalidate RAG page to show updated job status
    revalidatePath('/(command-center)/@rag')
    
    return {
      success: true,
      message: `Reindex job ${validated.jobId} cancelled`
    }
    
  } catch (error) {
    console.error('Cancel reindex job action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job'
    }
  }
}

/**
 * Get all indexes
 */
export async function getAllIndexesAction(): Promise<{
  success: boolean
  indexes?: any[]
  error?: string
}> {
  try {
    const indexes = await IndexRepository.getAllIndexes()
    
    return {
      success: true,
      indexes
    }
    
  } catch (error) {
    console.error('Get all indexes action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get indexes'
    }
  }
}
