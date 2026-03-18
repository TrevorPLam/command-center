/**
 * Index Management Server Actions
 * 
 * Server-side actions for index management operations.
 * Provides type-safe interfaces for index CRUD, versioning, and reindexing.
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { IndexManager } from '@/lib/app/rag/index-manager'
import { IndexCreateConfig, ReindexJobConfig } from '@/lib/app/rag/index-manager'

// Action schemas
const CreateIndexActionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['vector', 'keyword', 'hybrid']),
  embeddingModel: z.string().min(1),
  chunkingPolicy: z.object({
    strategy: z.enum(['semantic', 'fixed_size', 'recursive', 'document_structure']),
    maxChunkSize: z.number().min(100).max(8000),
    chunkOverlap: z.number().min(0).max(500),
    minChunkSize: z.number().min(50).optional(),
    separators: z.array(z.string()).optional(),
    preserveFormatting: z.boolean().default(false)
  }),
  indexingOptions: z.object({
    indexType: z.enum(['vector', 'keyword', 'hybrid']),
    vectorIndexConfig: z.object({
      metric: z.enum(['cosine', 'euclidean', 'dotproduct'])
    }).optional(),
    keywordIndexConfig: z.object({
      analyzer: z.string(),
      stopwords: z.boolean()
    }).optional()
  }),
  description: z.string().max(500).optional()
})

const ReindexIndexActionSchema = z.object({
  indexId: z.string().min(1),
  targetVersion: z.string().min(1),
  documentIds: z.array(z.string()).optional(),
  strategy: z.enum(['full', 'incremental', 'selective']),
  preserveOldVersion: z.boolean().default(true)
})

const RollbackIndexActionSchema = z.object({
  indexId: z.string().min(1),
  targetVersion: z.string().min(1)
})

const DeleteIndexActionSchema = z.object({
  indexId: z.string().min(1),
  confirm: z.boolean()
})

// Action types
export type CreateIndexActionInput = z.infer<typeof CreateIndexActionSchema>
export type ReindexIndexActionInput = z.infer<typeof ReindexIndexActionSchema>
export type RollbackIndexActionInput = z.infer<typeof RollbackIndexActionSchema>
export type DeleteIndexActionInput = z.infer<typeof DeleteIndexActionSchema>

export type CreateIndexActionResult = {
  success: boolean
  index?: {
    id: string
    name: string
    type: string
    status: string
    createdAt: Date
  }
  error?: string
}

export type ReindexIndexActionResult = {
  success: boolean
  jobId?: string
  message?: string
  error?: string
}

export type RollbackIndexActionResult = {
  success: boolean
  message?: string
  error?: string
}

export type DeleteIndexActionResult = {
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
    
    // Create index through IndexManager
    const index = await IndexManager.createIndex({
      name: validated.name,
      type: validated.type,
      embeddingModel: validated.embeddingModel,
      chunkingPolicy: validated.chunkingPolicy,
      indexingOptions: validated.indexingOptions,
      description: validated.description
    })

    // Revalidate RAG page to show new index
    revalidatePath('/(command-center)/@rag')

    return {
      success: true,
      index: {
        id: index.id,
        name: index.name,
        type: index.type,
        status: index.status,
        createdAt: index.createdAt
      }
    }

  } catch (error) {
    console.error('Create index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Index creation failed'
    }
  }
}

/**
 * Start reindexing for an index
 */
export async function reindexIndexAction(
  input: ReindexIndexActionInput
): Promise<ReindexIndexActionResult> {
  try {
    const validated = ReindexIndexActionSchema.parse(input)
    
    // Start reindexing through IndexManager
    const jobId = await IndexManager.startReindexing({
      indexId: validated.indexId,
      targetVersion: validated.targetVersion,
      documentIds: validated.documentIds,
      strategy: validated.strategy,
      preserveOldVersion: validated.preserveOldVersion
    })

    // Revalidate RAG page to show job status
    revalidatePath('/(command-center)/@rag')

    return {
      success: true,
      jobId,
      message: `Reindexing job started for index ${validated.indexId}`
    }

  } catch (error) {
    console.error('Reindex index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Reindexing failed'
    }
  }
}

/**
 * Rollback index to previous version
 */
export async function rollbackIndexAction(
  input: RollbackIndexActionInput
): Promise<RollbackIndexActionResult> {
  try {
    const validated = RollbackIndexActionSchema.parse(input)
    
    // Perform rollback through IndexManager
    await IndexManager.rollbackIndex(validated.indexId, validated.targetVersion)

    // Revalidate RAG page to show updated index
    revalidatePath('/(command-center)/@rag')

    return {
      success: true,
      message: `Index ${validated.indexId} rolled back to version ${validated.targetVersion}`
    }

  } catch (error) {
    console.error('Rollback index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Rollback failed'
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
    
    if (!validated.confirm) {
      return {
        success: false,
        error: 'Index deletion must be confirmed'
      }
    }
    
    // Delete index through IndexManager
    await IndexManager.deleteIndex(validated.indexId)

    // Revalidate RAG page to show updated index list
    revalidatePath('/(command-center)/@rag')

    return {
      success: true,
      message: `Index ${validated.indexId} deleted successfully`
    }

  } catch (error) {
    console.error('Delete index action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Index deletion failed'
    }
  }
}

/**
 * Get index metrics
 */
export async function getIndexMetricsAction(indexId: string): Promise<{
  success: boolean
  metrics?: any
  error?: string
}> {
  try {
    const metrics = await IndexManager.getIndexMetrics(indexId)

    return {
      success: true,
      metrics
    }

  } catch (error) {
    console.error('Get index metrics action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get index metrics'
    }
  }
}

/**
 * Get all indexes with their current status
 */
export async function getIndexesAction(): Promise<{
  success: boolean
  indexes?: any[]
  error?: string
}> {
  try {
    // This would query the index repository
    // For now, return mock data
    const mockIndexes = [
      {
        id: 'docs-index',
        name: 'Documentation',
        type: 'hybrid',
        status: 'ready',
        currentVersion: 'v3',
        versions: ['v1', 'v2', 'v3'],
        chunkCount: 1247,
        documentCount: 156,
        size: '2.3GB',
        lastUpdated: new Date(Date.now() - 3600000).toISOString(),
        config: {
          embeddingModel: 'text-embedding-ada-002',
          chunkingPolicy: {
            strategy: 'semantic',
            maxChunkSize: 1000,
            chunkOverlap: 200
          }
        }
      },
      {
        id: 'code-index',
        name: 'Code Repository',
        type: 'vector',
        status: 'building',
        currentVersion: 'v2',
        versions: ['v1', 'v2'],
        chunkCount: 892,
        documentCount: 94,
        size: '1.8GB',
        lastUpdated: new Date(Date.now() - 1800000).toISOString(),
        config: {
          embeddingModel: 'text-embedding-ada-002',
          chunkingPolicy: {
            strategy: 'document_structure',
            maxChunkSize: 800,
            chunkOverlap: 100
          }
        }
      }
    ]

    return {
      success: true,
      indexes: mockIndexes
    }

  } catch (error) {
    console.error('Get indexes action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get indexes'
    }
  }
}

/**
 * Get index version history
 */
export async function getIndexVersionsAction(indexId: string): Promise<{
  success: boolean
  versions?: any[]
  error?: string
}> {
  try {
    // This would query the version repository
    // For now, return mock data
    const mockVersions = [
      {
        id: 'v3',
        indexId: indexId,
        embeddingModel: 'text-embedding-ada-002',
        chunkingPolicy: {
          strategy: 'semantic',
          maxChunkSize: 1000,
          chunkOverlap: 200
        },
        status: 'ready',
        chunkCount: 1247,
        documentCount: 156,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        metadata: {
          migration_strategy: 'reindex_all',
          parent_version: 'v2'
        }
      },
      {
        id: 'v2',
        indexId: indexId,
        embeddingModel: 'text-embedding-ada-002',
        chunkingPolicy: {
          strategy: 'fixed_size',
          maxChunkSize: 800,
          chunkOverlap: 150
        },
        status: 'deprecated',
        chunkCount: 1247,
        documentCount: 156,
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        metadata: {
          migration_strategy: 'reindex_all',
          parent_version: 'v1'
        }
      },
      {
        id: 'v1',
        indexId: indexId,
        embeddingModel: 'text-embedding-ada-002',
        chunkingPolicy: {
          strategy: 'recursive',
          maxChunkSize: 600,
          chunkOverlap: 100
        },
        status: 'deprecated',
        chunkCount: 1247,
        documentCount: 156,
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        metadata: {
          migration_strategy: 'initial',
          parent_version: null
        }
      }
    ]

    return {
      success: true,
      versions: mockVersions
    }

  } catch (error) {
    console.error('Get index versions action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get index versions'
    }
  }
}
