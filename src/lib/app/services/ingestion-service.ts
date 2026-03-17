/**
 * Document Ingestion Service
 * 
 * Orchestrates the document ingestion pipeline: upload → parse → normalize → chunk → embed → index.
 * All heavy operations are queued through the job system for async processing.
 */

import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { documents, jobs } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { 
  IngestJob,
  IngestJobConfig,
  FileUpload,
  DirectoryWatchConfig,
  NormalizedDocument,
  DocumentContentType,
  ChunkingPolicy,
  IndexingOptions
} from '@/lib/app/rag/types'
import { DocumentNormalizer, MetadataEnricher } from '@/lib/app/rag/document-model'

// Validation schemas
export const UploadRequestSchema = z.object({
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

export const DirectoryWatchRequestSchema = z.object({
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

export type UploadRequest = z.infer<typeof UploadRequestSchema>
export type DirectoryWatchRequest = z.infer<typeof DirectoryWatchRequestSchema>

/**
 * Main ingestion service
 */
export class IngestionService {
  /**
   * Handle file upload ingestion request
   */
  static async handleUpload(request: UploadRequest): Promise<IngestJob> {
    const validated = UploadRequestSchema.parse(request)
    
    // Create ingestion job
    const jobId = uuidv4()
    const config: IngestJobConfig = {
      sourceType: 'upload',
      sourcePath: 'upload_' + Date.now(),
      indexingOptions: this.getDefaultIndexingOptions(),
      chunkingPolicy: validated.chunkingPolicy || this.getDefaultChunkingPolicy(),
      embeddingModel: validated.embeddingModel || 'default-embedding',
      indexId: validated.indexId
    }

    const job: IngestJob = {
      id: jobId,
      type: 'rag_ingest',
      status: 'pending',
      config,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Save job to database
    await this.saveJob(job)

    // Process files asynchronously
    await this.processUploadFiles(jobId, validated.files, config)

    return job
  }

  /**
   * Handle directory watch configuration
   */
  static async configureDirectoryWatch(request: DirectoryWatchRequest): Promise<string> {
    const validated = DirectoryWatchRequestSchema.parse(request)
    
    const watchId = uuidv4()
    const config: DirectoryWatchConfig = {
      path: validated.path,
      patterns: validated.patterns,
      ignorePatterns: validated.ignorePatterns,
      recursive: validated.recursive,
      autoIndex: validated.autoIndex
    }

    // Save watch configuration (would integrate with file system watcher)
    // For now, just return the watch ID
    
    return watchId
  }

  /**
   * Process uploaded files and create document records
   */
  private static async processUploadFiles(
    jobId: string,
    files: File[],
    config: IngestJobConfig
  ): Promise<void> {
    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running')

      const documentIds: string[] = []
      const errors: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        try {
          // Check for duplicates by checksum
          const buffer = await file.arrayBuffer()
          const content = new TextDecoder().decode(buffer)
          const checksum = this.calculateChecksum(content)
          
          const existing = await this.findDocumentByChecksum(checksum)
          if (existing) {
            errors.push(`${file.name}: Document already exists`)
            continue
          }

          // Detect content type
          const contentType = this.detectContentType(file.name, file.type)
          
          // Parse document (basic implementation for now)
          const parsed = await this.parseDocument(content, contentType)
          
          // Normalize document
          const normalized = await DocumentNormalizer.normalize(
            file.name,
            contentType,
            parsed
          )
          
          // Enrich metadata
          const enriched = MetadataEnricher.enrich(normalized)
          const final = MetadataEnricher.addSearchMetadata(enriched)

          // Save document to database
          await this.saveDocument(final)
          documentIds.push(final.id)

          // Update progress
          const progress = (i + 1) / files.length
          await this.updateJobProgress(jobId, progress)

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`${file.name}: ${errorMessage}`)
        }
      }

      // Queue chunking and embedding jobs
      if (documentIds.length > 0) {
        await this.queueChunkingJob(jobId, documentIds, config)
      }

      // Complete job
      await this.completeJob(jobId, {
        documentsProcessed: files.length,
        documentsSucceeded: documentIds.length,
        documentsFailed: errors.length,
        chunksGenerated: 0, // Will be updated by chunking job
        embeddingsGenerated: 0, // Will be updated by embedding job
        indexVersion: config.indexId,
        processingTimeMs: 0, // Will be calculated on completion
        errors
      })

    } catch (error) {
      await this.failJob(jobId, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Parse document based on content type
   */
  private static async parseDocument(
    content: string,
    contentType: DocumentContentType
  ): Promise<any> {
    // Use parser registry for consistent parsing
    const { ParserRegistry } = await import('@/lib/app/rag/parsers')
    return await ParserRegistry.parse(content, contentType)
  }

  /**
   * Helper methods
   */
  private static calculateChecksum(content: string): string {
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
  }

  private static detectContentType(filename: string, mimeType: string): DocumentContentType {
    // Use MIME type if available and valid
    if (mimeType && this.isValidContentType(mimeType)) {
      return mimeType as DocumentContentType
    }

    // Fall back to file extension
    const ext = filename.split('.').pop()?.toLowerCase()
    const extensionMap: Record<string, DocumentContentType> = {
      'txt': 'text/plain',
      'md': 'text/markdown',
      'csv': 'text/csv',
      'json': 'application/json',
      'html': 'text/html',
      'htm': 'text/html',
      'js': 'text/javascript',
      'jsx': 'text/javascript',
      'ts': 'text/typescript',
      'tsx': 'text/typescript',
      'py': 'text/python',
      'java': 'text/java',
      'cpp': 'text/cpp',
      'c': 'text/cpp',
      'cs': 'text/csharp',
      'go': 'text/go',
      'rs': 'text/rust',
      'sql': 'text/sql'
    }

    return extensionMap[ext] || 'text/plain'
  }

  private static isValidContentType(mimeType: string): boolean {
    const validTypes = [
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/json',
      'text/html',
      'text/javascript',
      'text/typescript',
      'text/python',
      'text/java',
      'text/cpp',
      'text/csharp',
      'text/go',
      'text/rust',
      'text/sql'
    ]
    return validTypes.includes(mimeType)
  }

  private static getDefaultChunkingPolicy(): ChunkingPolicy {
    return {
      strategy: 'semantic',
      maxChunkSize: 1000,
      chunkOverlap: 200,
      minChunkSize: 100,
      preserveFormatting: false
    }
  }

  private static getDefaultIndexingOptions(): IndexingOptions {
    return {
      indexType: 'hybrid',
      vectorIndexConfig: {
        metric: 'cosine'
      },
      keywordIndexConfig: {
        analyzer: 'standard',
        stopwords: true
      }
    }
  }

  // Database operations (simplified - would use proper repositories)
  private static async saveJob(job: IngestJob): Promise<void> {
    await db.insert(jobs).values({
      id: job.id,
      type: job.type,
      status: job.status,
      config: JSON.stringify(job.config),
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    })
  }

  private static async updateJobStatus(jobId: string, status: IngestJob['status']): Promise<void> {
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

  private static async completeJob(jobId: string, result: any): Promise<void> {
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

  private static async saveDocument(document: NormalizedDocument): Promise<void> {
    await db.insert(documents).values({
      id: document.id,
      content: document.sections.map(s => s.text).join('\n\n'),
      metadata: JSON.stringify(document.metadata),
      checksum: document.checksum,
      size: document.size,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    })
  }

  private static async findDocumentByChecksum(checksum: string): Promise<any> {
    return await db.query.documents.findFirst({
      where: eq(documents.checksum, checksum)
    })
  }

  private static async queueChunkingJob(jobId: string, documentIds: string[], config: IngestJobConfig): Promise<void> {
    // This would create a new job for chunking and embedding
    // For now, just log that it would happen
    console.log(`Would queue chunking job for ${documentIds.length} documents`)
  }
}
