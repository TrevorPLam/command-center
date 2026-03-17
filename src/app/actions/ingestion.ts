/**
 * Ingestion Server Actions
 * 
 * Server-side actions for document ingestion operations.
 * Provides type-safe interfaces for client components.
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { IngestionService, UploadRequestSchema, DirectoryWatchRequestSchema } from '@/lib/app/services/ingestion-service'
import { UploadRequest, DirectoryWatchRequest } from '@/lib/app/services/ingestion-service'

// Action schemas
const UploadFilesActionSchema = z.object({
  files: z.array(z.instanceof(File)).min(1).max(10),
  indexId: z.string().min(1),
  chunkingPolicy: z.object({
    strategy: z.enum(['semantic', 'fixed_size', 'recursive', 'document_structure']),
    maxChunkSize: z.number().min(100).max(8000),
    chunkOverlap: z.number().min(0).max(500),
    minChunkSize: z.number().min(50).optional(),
    separators: z.array(z.string()).optional(),
    preserveFormatting: z.boolean().default(false)
  }).optional(),
  embeddingModel: z.string().min(1).optional()
})

const ConfigureDirectoryWatchActionSchema = z.object({
  path: z.string().min(1),
  patterns: z.array(z.string()).default(['**/*']),
  ignorePatterns: z.array(z.string()).default([]),
  recursive: z.boolean().default(true),
  autoIndex: z.boolean().default(true),
  indexId: z.string().min(1),
  chunkingPolicy: z.object({
    strategy: z.enum(['semantic', 'fixed_size', 'recursive', 'document_structure']),
    maxChunkSize: z.number().min(100).max(8000),
    chunkOverlap: z.number().min(0).max(500)
  }).optional(),
  embeddingModel: z.string().min(1).optional()
})

const GetJobStatusActionSchema = z.object({
  jobId: z.string().min(1)
})

const CancelJobActionSchema = z.object({
  jobId: z.string().min(1)
})

// Action types
export type UploadFilesActionInput = z.infer<typeof UploadFilesActionSchema>
export type ConfigureDirectoryWatchActionInput = z.infer<typeof ConfigureDirectoryWatchActionSchema>
export type GetJobStatusActionInput = z.infer<typeof GetJobStatusActionSchema>
export type CancelJobActionInput = z.infer<typeof CancelJobActionSchema>

export type UploadFilesActionResult = {
  success: boolean
  job?: {
    id: string
    status: string
    config: any
    createdAt: Date
  }
  error?: string
}

export type ConfigureDirectoryWatchActionResult = {
  success: boolean
  watchId?: string
  error?: string
}

export type JobStatusActionResult = {
  success: boolean
  job?: {
    id: string
    status: string
    progress: number
    startedAt?: string
    completedAt?: string
    config?: any
    result?: any
    error?: string
  }
  error?: string
}

export type CancelJobActionResult = {
  success: boolean
  message?: string
  error?: string
}

/**
 * Upload files for ingestion
 */
export async function uploadFilesAction(
  input: UploadFilesActionInput
): Promise<UploadFilesActionResult> {
  try {
    const validated = UploadFilesActionSchema.parse(input)
    
    // Convert to service request format
    const uploadRequest: UploadRequest = {
      files: validated.files,
      indexId: validated.indexId,
      ...(validated.chunkingPolicy && { chunkingPolicy: validated.chunkingPolicy }),
      ...(validated.embeddingModel && { embeddingModel: validated.embeddingModel })
    }

    // Process upload
    const job = await IngestionService.handleUpload(uploadRequest)

    // Revalidate RAG page to show new job
    revalidatePath('/(command-center)/@rag')

    return {
      success: true,
      job: {
        id: job.id,
        status: job.status,
        config: job.config,
        createdAt: job.createdAt
      }
    }

  } catch (error) {
    console.error('Upload files action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

/**
 * Configure directory watch
 */
export async function configureDirectoryWatchAction(
  input: ConfigureDirectoryWatchActionInput
): Promise<ConfigureDirectoryWatchActionResult> {
  try {
    const validated = ConfigureDirectoryWatchActionSchema.parse(input)
    
    // Convert to service request format
    const watchRequest: DirectoryWatchRequest = {
      path: validated.path,
      patterns: validated.patterns,
      ignorePatterns: validated.ignorePatterns,
      recursive: validated.recursive,
      autoIndex: validated.autoIndex,
      indexId: validated.indexId,
      ...(validated.chunkingPolicy && { chunkingPolicy: validated.chunkingPolicy }),
      ...(validated.embeddingModel && { embeddingModel: validated.embeddingModel })
    }

    // Configure watch
    const watchId = await IngestionService.configureDirectoryWatch(watchRequest)

    // Revalidate RAG page
    revalidatePath('/(command-center)/@rag')

    return {
      success: true,
      watchId
    }

  } catch (error) {
    console.error('Configure directory watch action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Configuration failed'
    }
  }
}

/**
 * Get job status
 */
export async function getJobStatusAction(
  input: GetJobStatusActionInput
): Promise<JobStatusActionResult> {
  try {
    const validated = GetJobStatusActionSchema.parse(input)
    
    // This would query the job repository
    // For now, return mock data
    const mockJob = {
      id: validated.jobId,
      status: 'running',
      progress: 0.65,
      startedAt: new Date(Date.now() - 300000).toISOString(),
      config: {
        sourceType: 'upload',
        indexId: 'default-index'
      }
    }

    return {
      success: true,
      job: mockJob
    }

  } catch (error) {
    console.error('Get job status action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get job status'
    }
  }
}

/**
 * Cancel job
 */
export async function cancelJobAction(
  input: CancelJobActionInput
): Promise<CancelJobActionResult> {
  try {
    const validated = CancelJobActionSchema.parse(input)
    
    // This would update the job status in the repository
    // For now, return success
    
    // Revalidate RAG page to show updated job status
    revalidatePath('/(command-center)/@rag')

    return {
      success: true,
      message: `Job ${validated.jobId} cancelled`
    }

  } catch (error) {
    console.error('Cancel job action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job'
    }
  }
}

/**
 * Get all ingestion jobs
 */
export async function getIngestionJobsAction(): Promise<{
  success: boolean
  jobs?: any[]
  error?: string
}> {
  try {
    // This would query the job repository
    // For now, return mock data
    const mockJobs = [
      {
        id: 'job-1',
        type: 'rag_ingest',
        status: 'running',
        progress: 0.75,
        createdAt: new Date(Date.now() - 300000).toISOString(),
        startedAt: new Date(Date.now() - 290000).toISOString(),
        config: {
          sourceType: 'upload',
          indexId: 'docs-index'
        }
      },
      {
        id: 'job-2',
        type: 'rag_ingest',
        status: 'completed',
        progress: 1.0,
        createdAt: new Date(Date.now() - 600000).toISOString(),
        startedAt: new Date(Date.now() - 590000).toISOString(),
        completedAt: new Date(Date.now() - 120000).toISOString(),
        result: {
          documentsProcessed: 5,
          documentsSucceeded: 5,
          documentsFailed: 0,
          chunksGenerated: 47,
          embeddingsGenerated: 47
        }
      },
      {
        id: 'job-3',
        type: 'rag_ingest',
        status: 'failed',
        progress: 0.2,
        createdAt: new Date(Date.now() - 900000).toISOString(),
        startedAt: new Date(Date.now() - 890000).toISOString(),
        completedAt: new Date(Date.now() - 800000).toISOString(),
        error: 'Failed to parse PDF file: Corrupted format'
      }
    ]

    return {
      success: true,
      jobs: mockJobs
    }

  } catch (error) {
    console.error('Get ingestion jobs action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get jobs'
    }
  }
}

/**
 * Get document statistics
 */
export async function getDocumentStatsAction(): Promise<{
  success: boolean
  stats?: {
    totalDocuments: number
    indexedDocuments: number
    failedDocuments: number
    processingDocuments: number
    totalChunks: number
    totalEmbeddings: number
    indexSize: string
  }
  error?: string
}> {
  try {
    // This would query the document and chunk repositories
    // For now, return mock data
    const mockStats = {
      totalDocuments: 1247,
      indexedDocuments: 1247,
      failedDocuments: 0,
      processingDocuments: 0,
      totalChunks: 15678,
      totalEmbeddings: 15678,
      indexSize: '2.3GB'
    }

    return {
      success: true,
      stats: mockStats
    }

  } catch (error) {
    console.error('Get document stats action error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get document stats'
    }
  }
}

/**
 * Get index information
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
        type: 'lancedb',
        status: 'ready',
        documents: 856,
        lastUpdated: new Date(Date.now() - 3600000).toISOString(),
        config: {
          indexType: 'hybrid',
          vectorIndexConfig: {
            metric: 'cosine'
          }
        }
      },
      {
        id: 'code-index',
        name: 'Code Repository',
        type: 'lancedb',
        status: 'ready',
        documents: 391,
        lastUpdated: new Date(Date.now() - 7200000).toISOString(),
        config: {
          indexType: 'hybrid',
          vectorIndexConfig: {
            metric: 'cosine'
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
