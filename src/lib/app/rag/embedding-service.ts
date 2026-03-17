/**
 * Embedding Service
 * 
 * Handles embedding generation using configured embedding models
 * and manages embedding job processing through the job system.
 */

import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db/client'
import { chunks, jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { 
  DocumentChunk, 
  EmbeddingVector,
  IngestJobConfig,
  IngestJob 
} from './types'
import { RuntimeAdapter } from '@/lib/app/runtime/types'

export interface EmbeddingJobConfig {
  chunkIds: string[]
  embeddingModel: string
  indexId: string
  batchSize?: number
  retryFailed?: boolean
}

export interface EmbeddingJobResult {
  chunksProcessed: number
  chunksSucceeded: number
  chunksFailed: number
  embeddingsGenerated: number
  processingTimeMs: number
  errors: string[]
}

/**
 * Embedding generation service
 */
export class EmbeddingService {
  /**
   * Process embedding job for chunks
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
      
      // Process in batches
      for (let i = 0; i < chunksToProcess.length; i += batchSize) {
        const batch = chunksToProcess.slice(i, i + batchSize)
        const batchResult = await this.processBatch(batch, config.embeddingModel, runtime)
        
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
      
      // Complete job
      await this.completeJob(jobId, result)
      
    } catch (error) {
      await this.failJob(jobId, error instanceof Error ? error.message : 'Unknown error')
    }
  }
  
  /**
   * Process a batch of chunks for embedding
   */
  private static async processBatch(
    batch: DocumentChunk[],
    embeddingModel: string,
    runtime: RuntimeAdapter
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
      // Extract text from chunks
      const texts = batch.map(chunk => chunk.text)
      
      // Generate embeddings
      const embeddings = await this.generateEmbeddings(texts, embeddingModel, runtime)
      
      if (embeddings.length !== texts.length) {
        throw new Error(`Embedding count mismatch: expected ${texts.length}, got ${embeddings.length}`)
      }
      
      // Update chunks with embedding IDs
      for (let i = 0; i < batch.length; i++) {
        const chunk = batch[i]
        const embedding = embeddings[i]
        const embeddingId = uuidv4()
        
        try {
          // Store embedding in LanceDB (placeholder - would use LanceDBWriter)
          await this.storeEmbedding(embeddingId, embedding, chunk)
          
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
   * Generate embeddings for texts
   */
  private static async generateEmbeddings(
    texts: string[],
    model: string,
    runtime: RuntimeAdapter
  ): Promise<EmbeddingVector[]> {
    try {
      const response = await runtime.embed({
        model,
        input: texts
      })
      
      return response
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Store embedding in vector database
   */
  private static async storeEmbedding(
    embeddingId: string,
    embedding: EmbeddingVector,
    chunk: DocumentChunk
  ): Promise<void> {
    // This would integrate with LanceDBWriter
    // For now, just log the embedding
    console.log(`Storing embedding ${embeddingId} for chunk ${chunk.chunkId}`)
    console.log(`Embedding dimension: ${embedding.length}`)
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
