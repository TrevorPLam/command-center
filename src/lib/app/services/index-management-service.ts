/**
 * Index Management Service
 * 
 * High-level service for managing vector indexes.
 * Handles reindexing, versioning, and lifecycle operations.
 */

import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db/client'
import { jobs, chunks, documents } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { 
  VectorIndex, 
  IndexVersion, 
  IndexingOptions,
  ReindexRequest 
} from '@/lib/app/rag/types'
import { IndexRepository, CreateIndexRequest, UpdateIndexRequest } from '@/lib/app/persistence/index-repository'
import { EmbeddingService } from '@/lib/app/rag/embedding-service'
import { LanceDBWriter } from '@/lib/app/rag/lancedb-writer'
import { ChunkerRegistry } from '@/lib/app/rag/chunkers'
import { RuntimeAdapter } from '@/lib/app/runtime/types'

export interface ReindexJobConfig {
  indexId: string
  newEmbeddingModel?: string
  newChunkingPolicy?: any
  newIndexingOptions?: IndexingOptions
  preserveOldData: boolean
  batchSize?: number
}

export interface ReindexJobResult {
  documentsProcessed: number
  documentsSucceeded: number
  documentsFailed: number
  chunksGenerated: number
  embeddingsGenerated: number
  processingTimeMs: number
  oldVersion: string
  newVersion: string
  errors: string[]
}

/**
 * Index management service
 */
export class IndexManagementService {
  /**
   * Create a new index
   */
  static async createIndex(request: CreateIndexRequest): Promise<VectorIndex> {
    // Validate request
    this.validateCreateIndexRequest(request)
    
    // Create index
    const index = await IndexRepository.createIndex(request)
    
    // Initialize LanceDB table
    try {
      const lancedbConfig = LanceDBWriter.getDefaultConfig()
      await LanceDBWriter.initialize(lancedbConfig)
      
      // Create vector index if configured
      if (request.config.vectorIndexConfig) {
        await LanceDBWriter.createVectorIndex(
          lancedbConfig.tableName,
          request.config.vectorIndexConfig
        )
      }
      
      console.log(`Created index ${index.id} with LanceDB table`)
    } catch (error) {
      console.error('Failed to initialize LanceDB:', error)
      // Don't fail index creation, but log the error
    }
    
    return index
  }
  
  /**
   * Update an existing index
   */
  static async updateIndex(indexId: string, request: UpdateIndexRequest): Promise<VectorIndex> {
    // Validate request
    this.validateUpdateIndexRequest(request)
    
    return await IndexRepository.updateIndex(indexId, request)
  }
  
  /**
   * Delete an index and all its data
   */
  static async deleteIndex(indexId: string, force: boolean = false): Promise<void> {
    const index = await IndexRepository.getIndex(indexId)
    if (!index) {
      throw new Error('Index not found')
    }
    
    // Check if index is in use
    if (!force && index.status === 'ready' && index.chunkCount > 0) {
      throw new Error('Cannot delete index with data. Use force=true to override.')
    }
    
    // Delete from LanceDB
    try {
      const lancedbConfig = LanceDBWriter.getDefaultConfig()
      await LanceDBWriter.dropTable(lancedbConfig.tableName)
      console.log(`Dropped LanceDB table for index ${indexId}`)
    } catch (error) {
      console.error('Failed to drop LanceDB table:', error)
      // Continue with database deletion
    }
    
    // Delete from database
    await IndexRepository.deleteIndex(indexId)
    
    console.log(`Deleted index ${indexId}`)
  }
  
  /**
   * Reindex an index with new configuration
   */
  static async reindexIndex(
    request: ReindexRequest,
    runtime: RuntimeAdapter
  ): Promise<string> {
    const index = await IndexRepository.getIndex(request.indexId)
    if (!index) {
      throw new Error('Index not found')
    }
    
    // Create reindex job
    const jobId = uuidv4()
    
    const jobConfig: ReindexJobConfig = {
      indexId: request.indexId,
      newEmbeddingModel: request.newEmbeddingModel || index.currentVersion.embeddingModel,
      newChunkingPolicy: request.newChunkingPolicy || index.currentVersion.chunkingPolicy,
      newIndexingOptions: request.newIndexingOptions || index.currentVersion.indexingOptions,
      preserveOldData: request.preserveOldData ?? true,
      batchSize: 32
    }
    
    // Save job to database
    await db.insert(jobs).values({
      id: jobId,
      type: 'rag_reindex',
      status: 'pending',
      config: JSON.stringify(jobConfig),
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    
    // Start reindex processing (async)
    this.processReindexJob(jobId, jobConfig, runtime).catch(error => {
      console.error(`Reindex job ${jobId} failed:`, error)
    })
    
    return jobId
  }
  
  /**
   * Process reindex job
   */
  private static async processReindexJob(
    jobId: string,
    config: ReindexJobConfig,
    runtime: RuntimeAdapter
  ): Promise<void> {
    const startTime = Date.now()
    
    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running')
      
      const index = await IndexRepository.getIndex(config.indexId)
      if (!index) {
        throw new Error('Index not found')
      }
      
      // Create new version
      const newVersion = await IndexRepository.createVersion(
        config.indexId,
        config.newEmbeddingModel!,
        config.newChunkingPolicy!,
        config.newIndexingOptions!
      )
      
      const result: ReindexJobResult = {
        documentsProcessed: 0,
        documentsSucceeded: 0,
        documentsFailed: 0,
        chunksGenerated: 0,
        embeddingsGenerated: 0,
        processingTimeMs: 0,
        oldVersion: index.currentVersion.version,
        newVersion: newVersion.version,
        errors: []
      }
      
      // Get all documents for this index (simplified)
      const allDocuments = await this.getAllDocumentsForIndex(config.indexId)
      
      // Process documents in batches
      const batchSize = config.batchSize || 32
      for (let i = 0; i < allDocuments.length; i += batchSize) {
        const batch = allDocuments.slice(i, i + batchSize)
        const batchResult = await this.processReindexBatch(
          batch,
          config,
          runtime
        )
        
        // Update result
        result.documentsProcessed += batchResult.documentsProcessed
        result.documentsSucceeded += batchResult.documentsSucceeded
        result.documentsFailed += batchResult.documentsFailed
        result.chunksGenerated += batchResult.chunksGenerated
        result.embeddingsGenerated += batchResult.embeddingsGenerated
        result.errors.push(...batchResult.errors)
        
        // Update progress
        const progress = (i + batch.length) / allDocuments.length
        await this.updateJobProgress(jobId, progress)
      }
      
      result.processingTimeMs = Date.now() - startTime
      
      // Update version status
      await IndexRepository.updateVersionStatus(
        config.indexId,
        newVersion.version,
        'ready',
        result.chunksGenerated
      )
      
      // Clean up old data if not preserving
      if (!config.preserveOldData) {
        await this.cleanupOldVersionData(config.indexId, index.currentVersion.version)
      }
      
      // Complete job
      await this.completeJob(jobId, result)
      
      console.log(`Reindex job ${jobId} completed successfully`)
      
    } catch (error) {
      await this.failJob(jobId, error instanceof Error ? error.message : 'Unknown error')
    }
  }
  
  /**
   * Process a batch of documents for reindexing
   */
  private static async processReindexBatch(
    documents: any[],
    config: ReindexJobConfig,
    runtime: RuntimeAdapter
  ): Promise<Omit<ReindexJobResult, 'oldVersion' | 'newVersion' | 'processingTimeMs'>> {
    const result = {
      documentsProcessed: documents.length,
      documentsSucceeded: 0,
      documentsFailed: 0,
      chunksGenerated: 0,
      embeddingsGenerated: 0,
      errors: []
    }
    
    for (const document of documents) {
      try {
        // Re-chunk document with new policy
        const chunks = await ChunkerRegistry.chunkDocument(
          document,
          config.newChunkingPolicy!
        )
        
        // Generate embeddings for chunks
        const texts = chunks.map(chunk => chunk.text)
        const embeddings = await EmbeddingService.generateEmbeddings(
          texts,
          config.newEmbeddingModel!,
          runtime
        )
        
        // Store in LanceDB with new version
        await LanceDBWriter.writeChunks(
          'chunks', // Would use index-specific table
          chunks,
          embeddings,
          {
            indexVersion: uuidv4(), // Would use actual version ID
            embeddingModel: config.newEmbeddingModel!,
            chunkingPolicy: config.newChunkingPolicy!,
            indexingOptions: config.newIndexingOptions!
          }
        )
        
        result.documentsSucceeded++
        result.chunksGenerated += chunks.length
        result.embeddingsGenerated += embeddings.length
        
      } catch (error) {
        result.documentsFailed++
        result.errors.push(
          `Document ${document.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }
    
    return result
  }
  
  /**
   * Get all documents for an index (simplified implementation)
   */
  private static async getAllDocumentsForIndex(indexId: string): Promise<any[]> {
    // This would query documents associated with the index
    // For now, return mock data
    return [
      {
        id: 'doc-1',
        contentType: 'text/markdown',
        sections: [{ text: 'Sample document content', path: ['root'] }],
        metadata: {}
      }
    ]
  }
  
  /**
   * Clean up data from old version
   */
  private static async cleanupOldVersionData(indexId: string, oldVersion: string): Promise<void> {
    try {
      // Delete old version chunks from LanceDB
      await LanceDBWriter.deleteChunksByVersion('chunks', oldVersion)
      
      // Clean up database records if needed
      console.log(`Cleaned up old version ${oldVersion} data`)
    } catch (error) {
      console.error('Failed to cleanup old version data:', error)
    }
  }
  
  /**
   * Get index health and recommendations
   */
  static async getIndexHealth(indexId: string): Promise<{
    isHealthy: boolean
    issues: string[]
    recommendations: string[]
    stats: any
  }> {
    const health = await IndexRepository.getIndexHealth(indexId)
    const stats = await IndexRepository.getIndexStats(indexId)
    
    return {
      ...health,
      stats
    }
  }
  
  /**
   * Get reindex job status
   */
  static async getReindexJobStatus(jobId: string): Promise<any> {
    const job = await db.query.jobs.findFirst({
      where: eq(jobs.id, jobId)
    })
    
    if (!job) {
      throw new Error('Job not found')
    }
    
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      config: JSON.parse(job.config),
      result: job.result ? JSON.parse(job.result) : null,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      updatedAt: job.updatedAt
    }
  }
  
  /**
   * Cancel reindex job
   */
  static async cancelReindexJob(jobId: string): Promise<void> {
    await db.update(jobs)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(jobs.id, jobId))
  }
  
  // Validation methods
  private static validateCreateIndexRequest(request: CreateIndexRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Index name is required')
    }
    
    if (!request.type) {
      throw new Error('Index type is required')
    }
    
    if (!request.config) {
      throw new Error('Index configuration is required')
    }
    
    if (!request.embeddingModel) {
      throw new Error('Embedding model is required')
    }
  }
  
  private static validateUpdateIndexRequest(request: UpdateIndexRequest): void {
    if (!request.name && !request.config && !request.description) {
      throw new Error('At least one field to update is required')
    }
  }
  
  // Job status update methods
  private static async updateJobStatus(jobId: string, status: string): Promise<void> {
    await db.update(jobs)
      .set({ 
        status,
        updatedAt: new Date(),
        ...(status === 'running' ? { startedAt: new Date() } : {}),
        ...(status === 'completed' || status === 'failed' ? { completedAt: new Date() } : {})
      })
      .where(eq(jobs.id, jobId))
  }
  
  private static async updateJobProgress(jobId: string, progress: number): Promise<void> {
    await db.update(jobs)
      .set({ progress, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
  }
  
  private static async completeJob(jobId: string, result: ReindexJobResult): Promise<void> {
    await db.update(jobs)
      .set({
        status: 'completed',
        result: JSON.stringify(result),
        progress: 1.0,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(jobs.id, jobId))
  }
  
  private static async failJob(jobId: string, error: string): Promise<void> {
    await db.update(jobs)
      .set({
        status: 'failed',
        error,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(jobs.id, jobId))
  }
}
