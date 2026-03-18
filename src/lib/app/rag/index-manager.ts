/**
 * Index Manager Service
 * 
 * Manages vector index versions, reindexing workflows, and rollback operations.
 * Handles index lifecycle management with versioning and migration support.
 */

import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db/client'
import { indexes, documents, chunks, jobs } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { 
  VectorIndex, 
  IndexVersion, 
  IndexingOptions,
  IndexStatus,
  ChunkingPolicy,
  IngestJobConfig
} from './types'
import { LanceDBWriter } from './lancedb-writer'
import { EmbeddingService } from './embedding-service'

export interface IndexCreateConfig {
  name: string
  type: 'vector' | 'keyword' | 'hybrid'
  embeddingModel: string
  chunkingPolicy: ChunkingPolicy
  indexingOptions: IndexingOptions
  description?: string
}

export interface IndexVersionConfig {
  embeddingModel: string
  chunkingPolicy: ChunkingPolicy
  indexingOptions: IndexingOptions
  migrationStrategy?: 'reindex_all' | 'incremental' | 'selective'
}

export interface ReindexJobConfig {
  indexId: string
  targetVersion: string
  documentIds?: string[]
  strategy: 'full' | 'incremental' | 'selective'
  preserveOldVersion: boolean
}

export interface IndexMetrics {
  totalDocuments: number
  totalChunks: number
  totalEmbeddings: number
  indexSize: number
  averageChunkSize: number
  indexingSpeed: number
  lastUpdated: Date
}

/**
 * Index management service with versioning support
 */
export class IndexManager {
  /**
   * Create a new vector index with initial version
   */
  static async createIndex(config: IndexCreateConfig): Promise<VectorIndex> {
    const indexId = uuidv4()
    const versionId = `v1`
    
    try {
      // Create index record
      const index: VectorIndex = {
        id: indexId,
        name: config.name,
        type: config.type,
        status: 'building',
        config: JSON.stringify(config),
        chunkCount: 0,
        metadata: {
          description: config.description,
          created_at: new Date().toISOString(),
          versions: [versionId],
          current_version: versionId
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Save to database
      await db.insert(indexes).values({
        id: index.id,
        name: index.name,
        type: index.type,
        config: index.config,
        status: index.status,
        chunkCount: index.chunkCount,
        metadata: JSON.stringify(index.metadata),
        createdAt: index.createdAt,
        updatedAt: index.updatedAt
      })

      // Create initial version record
      await this.createIndexVersion(indexId, versionId, {
        embeddingModel: config.embeddingModel,
        chunkingPolicy: config.chunkingPolicy,
        indexingOptions: config.indexingOptions
      })

      // Initialize LanceDB table for this index
      await this.initializeIndexTable(indexId, versionId)

      console.log(`Created new index: ${config.name} (${indexId}) with version ${versionId}`)
      
      return index

    } catch (error) {
      throw new Error(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a new version of an existing index
   */
  static async createIndexVersion(
    indexId: string,
    versionId: string,
    config: IndexVersionConfig
  ): Promise<IndexVersion> {
    try {
      // Get current index
      const index = await this.getIndex(indexId)
      if (!index) {
        throw new Error(`Index not found: ${indexId}`)
      }

      // Create version record
      const version: IndexVersion = {
        id: versionId,
        indexId: indexId,
        embeddingModel: config.embeddingModel,
        chunkingPolicy: config.chunkingPolicy,
        indexingOptions: config.indexingOptions,
        status: 'building',
        chunkCount: 0,
        documentCount: 0,
        metadata: {
          created_at: new Date().toISOString(),
          migration_strategy: config.migrationStrategy || 'reindex_all',
          parent_version: index.metadata.current_version
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }

      // Update index metadata to include new version
      const updatedMetadata = {
        ...index.metadata,
        versions: [...(index.metadata.versions as string[] || []), versionId],
        current_version: versionId
      }

      // Update index record
      await db.update(indexes)
        .set({
          metadata: JSON.stringify(updatedMetadata),
          updatedAt: new Date()
        })
        .where(eq(indexes.id, indexId))

      console.log(`Created new version ${versionId} for index ${indexId}`)
      
      return version

    } catch (error) {
      throw new Error(`Failed to create index version: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Initialize LanceDB table for index version
   */
  private static async initializeIndexTable(indexId: string, versionId: string): Promise<void> {
    try {
      const config = {
        databasePath: process.env.LANCEDB_DIR || './data/lancedb',
        tableName: `index_${indexId}_${versionId}`
      }

      await LanceDBWriter.initialize(config)
      
      // Create vector index with default settings
      await LanceDBWriter.createVectorIndex(config.tableName, {
        metric: 'cosine',
        ivfLists: 100,
        pq: 8
      })

    } catch (error) {
      throw new Error(`Failed to initialize index table: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Start reindexing job for an index
   */
  static async startReindexing(config: ReindexJobConfig): Promise<string> {
    const jobId = uuidv4()
    
    try {
      // Get index and target version
      const index = await this.getIndex(config.indexId)
      if (!index) {
        throw new Error(`Index not found: ${config.indexId}`)
      }

      // Determine documents to reindex
      let documentIds = config.documentIds
      if (!documentIds || documentIds.length === 0) {
        documentIds = await this.getAllDocumentIdsForIndex(config.indexId)
      }

      // Create reindexing job
      const jobConfig: IngestJobConfig = {
        sourceType: 'reindex',
        sourcePath: `reindex_${config.indexId}`,
        indexingOptions: await this.getVersionIndexingOptions(config.indexId, config.targetVersion),
        chunkingPolicy: await this.getVersionChunkingPolicy(config.indexId, config.targetVersion),
        embeddingModel: await this.getVersionEmbeddingModel(config.indexId, config.targetVersion),
        indexId: config.indexId
      }

      await db.insert(jobs).values({
        id: jobId,
        type: 'rag_reindex',
        status: 'pending',
        config: JSON.stringify({
          ...jobConfig,
          reindexConfig: config,
          targetVersion: config.targetVersion
        }),
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Update index status
      await db.update(indexes)
        .set({ status: 'reindexing', updatedAt: new Date() })
        .where(eq(indexes.id, config.indexId))

      console.log(`Started reindexing job ${jobId} for index ${config.indexId} to version ${config.targetVersion}`)
      
      return jobId

    } catch (error) {
      throw new Error(`Failed to start reindexing: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Process reindexing job
   */
  static async processReindexingJob(jobId: string): Promise<void> {
    try {
      // Get job configuration
      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, jobId)
      })

      if (!job) {
        throw new Error(`Job not found: ${jobId}`)
      }

      const config = JSON.parse(job.config)
      const reindexConfig = config.reindexConfig as ReindexJobConfig

      // Update job status
      await this.updateJobStatus(jobId, 'running')

      // Get documents to reindex
      const documents = await this.getDocumentsForReindexing(reindexConfig)

      // Process documents based on strategy
      if (reindexConfig.strategy === 'full') {
        await this.performFullReindex(jobId, documents, config, reindexConfig)
      } else if (reindexConfig.strategy === 'incremental') {
        await this.performIncrementalReindex(jobId, documents, config, reindexConfig)
      } else {
        await this.performSelectiveReindex(jobId, documents, config, reindexConfig)
      }

      // Complete job
      await this.completeReindexingJob(jobId, reindexConfig)

    } catch (error) {
      await this.failReindexingJob(jobId, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Perform full reindexing
   */
  private static async performFullReindex(
    jobId: string,
    documents: any[],
    config: any,
    reindexConfig: ReindexJobConfig
  ): Promise<void> {
    const totalDocuments = documents.length
    
    for (let i = 0; i < documents.length; i++) {
      const document = documents[i]
      
      try {
        // Delete existing embeddings for this document
        await this.deleteDocumentEmbeddings(document.id, reindexConfig.indexId)
        
        // Re-chunk document with new policy
        const chunks = await this.rechunkDocument(document, config.chunkingPolicy)
        
        // Generate new embeddings
        const embeddingJobId = await EmbeddingService.createEmbeddingJob(
          chunks.map(c => c.chunkId),
          config.embeddingModel,
          reindexConfig.indexId
        )
        
        // Update progress
        const progress = (i + 1) / totalDocuments
        await this.updateJobProgress(jobId, progress)
        
      } catch (error) {
        console.error(`Failed to reindex document ${document.id}:`, error)
      }
    }
  }

  /**
   * Rollback to previous index version
   */
  static async rollbackIndex(indexId: string, targetVersion: string): Promise<void> {
    try {
      const index = await this.getIndex(indexId)
      if (!index) {
        throw new Error(`Index not found: ${indexId}`)
      }

      const versions = index.metadata.versions as string[] || []
      if (!versions.includes(targetVersion)) {
        throw new Error(`Version ${targetVersion} not found in index ${indexId}`)
      }

      // Update current version
      const updatedMetadata = {
        ...index.metadata,
        current_version: targetVersion,
        rollback_history: [
          ...(index.metadata.rollback_history as any[] || []),
          {
            from_version: index.metadata.current_version,
            to_version: targetVersion,
            timestamp: new Date().toISOString()
          }
        ]
      }

      await db.update(indexes)
        .set({
          metadata: JSON.stringify(updatedMetadata),
          updatedAt: new Date()
        })
        .where(eq(indexes.id, indexId))

      console.log(`Rolled back index ${indexId} to version ${targetVersion}`)

    } catch (error) {
      throw new Error(`Failed to rollback index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get comprehensive index metrics
   */
  static async getIndexMetrics(indexId: string): Promise<IndexMetrics> {
    try {
      const index = await this.getIndex(indexId)
      if (!index) {
        throw new Error(`Index not found: ${indexId}`)
      }

      // Get document and chunk counts
      const documentCount = await db.query.documents.findMany({
        where: eq(documents.metadata, JSON.stringify({ indexId }))
      }).then(docs => docs.length)

      const chunkCount = await db.query.chunks.findMany({
        where: eq(chunks.documentId, indexId)
      }).then(chunks => chunks.length)

      // Get index statistics from LanceDB
      const tableName = `index_${indexId}_${index.metadata.current_version}`
      const indexStats = await LanceDBWriter.getIndexStats(tableName)

      return {
        totalDocuments: documentCount,
        totalChunks: chunkCount,
        totalEmbeddings: indexStats.numIndexedRows,
        indexSize: indexStats.sizeBytes,
        averageChunkSize: chunkCount > 0 ? Math.round(indexStats.sizeBytes / chunkCount) : 0,
        indexingSpeed: 0, // Would be calculated from job history
        lastUpdated: index.updatedAt
      }

    } catch (error) {
      throw new Error(`Failed to get index metrics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete index and all its versions
   */
  static async deleteIndex(indexId: string): Promise<void> {
    try {
      const index = await this.getIndex(indexId)
      if (!index) {
        throw new Error(`Index not found: ${indexId}`)
      }

      // Delete all LanceDB tables for this index
      const versions = index.metadata.versions as string[] || []
      for (const version of versions) {
        const tableName = `index_${indexId}_${version}`
        try {
          await LanceDBWriter.deleteEmbeddingsByDocument(indexId)
        } catch (error) {
          console.error(`Failed to delete table ${tableName}:`, error)
        }
      }

      // Delete index record
      await db.delete(indexes).where(eq(indexes.id, indexId))

      console.log(`Deleted index ${indexId} and all its versions`)

    } catch (error) {
      throw new Error(`Failed to delete index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Helper methods
   */
  private static async getIndex(indexId: string): Promise<any> {
    const index = await db.query.indexes.findFirst({
      where: eq(indexes.id, indexId)
    })
    
    if (!index) return null
    
    return {
      ...index,
      metadata: JSON.parse(index.metadata || '{}'),
      config: JSON.parse(index.config || '{}')
    }
  }

  private static async getAllDocumentIdsForIndex(indexId: string): Promise<string[]> {
    const documents = await db.query.documents.findMany({
      where: eq(documents.metadata, JSON.stringify({ indexId }))
    })
    
    return documents.map(doc => doc.id)
  }

  private static async getVersionEmbeddingModel(indexId: string, versionId: string): Promise<string> {
    // This would fetch the embedding model from the version configuration
    return 'default-embedding' // Placeholder
  }

  private static async getVersionChunkingPolicy(indexId: string, versionId: string): Promise<ChunkingPolicy> {
    // This would fetch the chunking policy from the version configuration
    return {
      strategy: 'semantic',
      maxChunkSize: 1000,
      chunkOverlap: 200
    } // Placeholder
  }

  private static async getVersionIndexingOptions(indexId: string, versionId: string): Promise<IndexingOptions> {
    // This would fetch the indexing options from the version configuration
    return {
      indexType: 'hybrid',
      vectorIndexConfig: {
        metric: 'cosine'
      }
    } // Placeholder
  }

  private static async getDocumentsForReindexing(config: ReindexJobConfig): Promise<any[]> {
    // This would fetch documents based on the reindexing configuration
    return [] // Placeholder
  }

  private static async performIncrementalReindex(
    jobId: string,
    documents: any[],
    config: any,
    reindexConfig: ReindexJobConfig
  ): Promise<void> {
    // Implementation for incremental reindexing
    console.log('Performing incremental reindexing')
  }

  private static async performSelectiveReindex(
    jobId: string,
    documents: any[],
    config: any,
    reindexConfig: ReindexJobConfig
  ): Promise<void> {
    // Implementation for selective reindexing
    console.log('Performing selective reindexing')
  }

  private static async deleteDocumentEmbeddings(documentId: string, indexId: string): Promise<void> {
    await LanceDBWriter.deleteEmbeddingsByDocument(documentId)
  }

  private static async rechunkDocument(document: any, chunkingPolicy: ChunkingPolicy): Promise<any[]> {
    // Implementation for re-chunking documents
    return [] // Placeholder
  }

  private static async updateJobStatus(jobId: string, status: string): Promise<void> {
    await db.update(jobs)
      .set({ status, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
  }

  private static async updateJobProgress(jobId: string, progress: number): Promise<void> {
    await db.update(jobs)
      .set({ progress, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
  }

  private static async completeReindexingJob(jobId: string, config: ReindexJobConfig): Promise<void> {
    await db.update(jobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(jobs.id, jobId))

    // Update index status
    await db.update(indexes)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(eq(indexes.id, config.indexId))
  }

  private static async failReindexingJob(jobId: string, error: string): Promise<void> {
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
