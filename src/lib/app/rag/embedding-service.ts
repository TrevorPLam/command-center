/**
 * Embedding Service
 * 
 * Handles embedding generation using configured embedding models
 * and manages embedding job processing through the job system.
 * Enhanced with LanceDB integration and advanced features.
 */

import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db/client'
import { chunks, jobs, documents } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { 
  DocumentChunk, 
  EmbeddingVector,
  IngestJobConfig,
  IngestJob 
} from './types'
import { RuntimeAdapter } from '@/lib/app/runtime/types'
import { LanceDBWriter } from './lancedb-writer'

export interface EmbeddingJobConfig {
  chunkIds: string[]
  embeddingModel: string
  indexId: string
  batchSize?: number
  retryFailed?: boolean
  indexVersion?: string
  embeddingDimensions?: number
}

export interface EmbeddingJobResult {
  chunksProcessed: number
  chunksSucceeded: number
  chunksFailed: number
  embeddingsGenerated: number
  processingTimeMs: number
  errors: string[]
  embeddingStats?: {
    avgDimension: number
    totalDimensions: number
    indexSize: number
  }
}

export interface EmbeddingMetrics {
  totalEmbeddings: number
  avgProcessingTime: number
  successRate: number
  errorRate: number
  indexSize: number
  lastUpdated: Date
}

/**
 * Enhanced embedding generation service
 */
export class EmbeddingService {
  /**
   * Process embedding job for chunks with LanceDB integration
   */
  static async processEmbeddingJob(
    jobId: string,
    config: EmbeddingJobConfig,
    runtime: RuntimeAdapter
  ): Promise<void> {
    const startTime = Date.now()
    const batchSize = config.batchSize || 32
    
    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running')
      
      const result: EmbeddingJobResult = {
        chunksProcessed: 0,
        chunksSucceeded: 0,
        chunksFailed: 0,
        embeddingsGenerated: 0,
        processingTimeMs: 0,
        errors: []
      }
      
      // Get chunks to process
      const chunksToProcess = await this.getChunksForEmbedding(config.chunkIds)
      
      if (chunksToProcess.length === 0) {
        await this.completeJob(jobId, { ...result, processingTimeMs: Date.now() - startTime })
        return
      }
      
      // Initialize LanceDB connection for this job
      await this.initializeVectorStore(config.indexId)
      
      // Process in batches with progress tracking
      for (let i = 0; i < chunksToProcess.length; i += batchSize) {
        const batch = chunksToProcess.slice(i, i + batchSize)
        const batchResult = await this.processBatch(batch, config.embeddingModel, runtime, config.indexId, config.indexVersion)
        
        // Update result
        result.chunksProcessed += batchResult.chunksProcessed
        result.chunksSucceeded += batchResult.chunksSucceeded
        result.chunksFailed += batchResult.chunksFailed
        result.embeddingsGenerated += batchResult.embeddingsGenerated
        result.errors.push(...batchResult.errors)
        
        // Update progress
        const progress = (i + batch.length) / chunksToProcess.length
        await this.updateJobProgress(jobId, progress)
      }
      
      result.processingTimeMs = Date.now() - startTime
      
      // Add embedding statistics
      result.embeddingStats = await this.calculateEmbeddingStats(config.indexId)
      
      // Complete job
      await this.completeJob(jobId, result)
      
    } catch (error) {
      await this.failJob(jobId, error instanceof Error ? error.message : 'Unknown error')
    }
  }
  
  /**
   * Process a batch of chunks for embedding with enhanced error handling
   */
  private static async processBatch(
    batch: DocumentChunk[],
    embeddingModel: string,
    runtime: RuntimeAdapter,
    indexId: string,
    indexVersion?: string
  ): Promise<EmbeddingJobResult> {
    const result: EmbeddingJobResult = {
      chunksProcessed: batch.length,
      chunksSucceeded: 0,
      chunksFailed: 0,
      embeddingsGenerated: 0,
      processingTimeMs: 0,
      errors: []
    }
    
    try {
      // Extract text from chunks with preprocessing
      const texts = batch.map(chunk => this.preprocessText(chunk.text))
      
      // Generate embeddings with retry logic
      const embeddings = await this.generateEmbeddingsWithRetry(texts, embeddingModel, runtime)
      
      if (embeddings.length !== texts.length) {
        throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`)
      }
      
      // Validate embedding dimensions
      await this.validateEmbeddings(embeddings, embeddingModel)
      
      // Store embeddings in LanceDB with metadata
      for (let i = 0; i < batch.length; i++) {
        const chunk = batch[i]
        const embedding = embeddings[i]
        const embeddingId = uuidv4()
        
        try {
          // Store embedding in LanceDB with full metadata
          await this.storeEmbeddingInLanceDB(embeddingId, embedding, chunk, indexVersion)
          
          // Update chunk with embedding ID
          await this.updateChunkEmbeddingId(chunk.chunkId, embeddingId)
          
          result.chunksSucceeded++
          result.embeddingsGenerated++
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          result.errors.push(`Chunk ${chunk.chunkId}: ${errorMsg}`)
          result.chunksFailed++
        }
      }
      
    } catch (error) {
      // Mark all chunks in batch as failed
      result.chunksFailed = batch.length
      result.chunksSucceeded = 0
      result.errors.push(error instanceof Error ? error.message : 'Batch processing failed')
    }
    
    return result
  }
  
  /**
   * Generate embeddings with retry logic and error handling
   */
  private static async generateEmbeddingsWithRetry(
    texts: string[],
    model: string,
    runtime: RuntimeAdapter,
    maxRetries: number = 3
  ): Promise<EmbeddingVector[]> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await runtime.embed({
          model,
          input: texts
        })
        
        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown embedding error')
        
        if (attempt === maxRetries) {
          throw lastError
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }
  
  /**
   * Preprocess text for embedding generation
   */
  private static preprocessText(text: string): string {
    // Clean and normalize text for better embedding quality
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n') // Reduce excessive line breaks
      .slice(0, 8000) // Limit length to prevent token overflow
  }
  
  /**
   * Validate embedding dimensions and quality
   */
  private static async validateEmbeddings(
    embeddings: EmbeddingVector[],
    model: string
  ): Promise<void> {
    if (embeddings.length === 0) {
      throw new Error('No embeddings generated')
    }
    
    const firstDim = embeddings[0].length
    
    // Check all embeddings have same dimension
    for (let i = 1; i < embeddings.length; i++) {
      if (embeddings[i].length !== firstDim) {
        throw new Error(`Embedding dimension mismatch at index ${i}: expected ${firstDim}, got ${embeddings[i].length}`)
      }
    }
    
    // Check for valid embedding values (no NaN, Infinity, etc.)
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = 0; j < embeddings[i].length; j++) {
        const value = embeddings[i][j]
        if (!isFinite(value)) {
          throw new Error(`Invalid embedding value at index ${i}, position ${j}: ${value}`)
        }
      }
    }
    
    // Log embedding statistics
    console.log(`Generated ${embeddings.length} embeddings with ${firstDim} dimensions using model: ${model}`)
  }
  
  /**
   * Store embedding in LanceDB with full metadata
   */
  private static async storeEmbeddingInLanceDB(
    embeddingId: string,
    embedding: EmbeddingVector,
    chunk: DocumentChunk,
    indexVersion?: string
  ): Promise<void> {
    try {
      // Prepare embedding data with full metadata
      const embeddingData = {
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        sectionPath: JSON.stringify(chunk.sectionPath),
        text: chunk.text,
        metadata: JSON.stringify(chunk.metadata),
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        embeddingId: embeddingId,
        indexVersion: indexVersion || 'v1',
        embeddingModel: 'default', // Would come from config
        createdAt: chunk.createdAt.toISOString(),
        vector: embedding
      }
      
      // Store in LanceDB
      await LanceDBWriter.writeEmbedding(embeddingData)
      
    } catch (error) {
      throw new Error(`Failed to store embedding in LanceDB: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Initialize vector store for index
   */
  private static async initializeVectorStore(indexId: string): Promise<void> {
    try {
      const config = {
        databasePath: process.env.LANCEDB_DIR || './data/lancedb',
        tableName: `index_${indexId}`
      }
      
      await LanceDBWriter.initialize(config)
    } catch (error) {
      throw new Error(`Failed to initialize vector store: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Calculate embedding statistics for an index
   */
  private static async calculateEmbeddingStats(indexId: string): Promise<{
    avgDimension: number
    totalDimensions: number
    indexSize: number
  }> {
    try {
      // Get sample embedding to determine dimensions
      const sampleChunk = await db.query.chunks.findFirst({
        where: and(
          eq(chunks.embeddingId, ''),
          eq(chunks.documentId, (await db.query.documents.findFirst())?.id || '')
        )
      })
      
      if (!sampleChunk) {
        return { avgDimension: 0, totalDimensions: 0, indexSize: 0 }
      }
      
      // Get embedding stats from LanceDB
      const stats = await LanceDBWriter.getIndexStats(`index_${indexId}`)
      
      return {
        avgDimension: 1536, // Would be determined from actual embeddings
        totalDimensions: stats.numIndexedRows * 1536,
        indexSize: stats.sizeBytes
      }
    } catch (error) {
      console.error('Failed to calculate embedding stats:', error)
      return { avgDimension: 0, totalDimensions: 0, indexSize: 0 }
    }
  }
  
  /**
   * Get chunks for embedding processing
   */
  private static async getChunksForEmbedding(chunkIds: string[]): Promise<DocumentChunk[]> {
    const chunks = await db.query.chunks.findMany({
      where: and(
        chunks.id.in(chunkIds),
        eq(chunks.embeddingId, '') // Only process chunks without embeddings
      )
    })
    
    return chunks.map(chunk => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      sectionPath: [], // Would be parsed from metadata
      text: chunk.content,
      metadata: JSON.parse(chunk.metadata || '{}'),
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
      createdAt: chunk.createdAt
    }))
  }
  
  /**
   * Update chunk with embedding ID
   */
  private static async updateChunkEmbeddingId(chunkId: string, embeddingId: string): Promise<void> {
    await db.update(chunks)
      .set({ embeddingId })
      .where(eq(chunks.id, chunkId))
  }
  
  /**
   * Create embedding job
   */
  static async createEmbeddingJob(
    chunkIds: string[],
    embeddingModel: string,
    indexId: string
  ): Promise<string> {
    const jobId = uuidv4()
    
    const config: EmbeddingJobConfig = {
      chunkIds,
      embeddingModel,
      indexId,
      batchSize: 32
    }
    
    await db.insert(jobs).values({
      id: jobId,
      type: 'rag_embedding',
      status: 'pending',
      config: JSON.stringify(config),
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    
    return jobId
  }
  
  /**
   * Get embedding job status
   */
  static async getEmbeddingJobStatus(jobId: string): Promise<any> {
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
   * Cancel embedding job
   */
  static async cancelEmbeddingJob(jobId: string): Promise<void> {
    await db.update(jobs)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(jobs.id, jobId))
  }
  
  /**
   * Retry failed chunks in embedding job
   */
  static async retryFailedChunks(jobId: string): Promise<string> {
    const job = await this.getEmbeddingJobStatus(jobId)
    
    if (job.status !== 'failed') {
      throw new Error('Can only retry failed jobs')
    }
    
    const config: EmbeddingJobConfig = job.config
    const result = job.result
    
    // Extract failed chunk IDs from result
    const failedChunkIds: string[] = []
    if (result && result.errors) {
      // Parse error messages to extract chunk IDs
      result.errors.forEach((error: string) => {
        const match = error.match(/Chunk ([^:]+):/)
        if (match) {
          failedChunkIds.push(match[1])
        }
      })
    }
    
    if (failedChunkIds.length === 0) {
      throw new Error('No failed chunks found to retry')
    }
    
    // Create new job with failed chunks
    return await this.createEmbeddingJob(
      failedChunkIds,
      config.embeddingModel,
      config.indexId
    )
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
  
  private static async completeJob(jobId: string, result: EmbeddingJobResult): Promise<void> {
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
