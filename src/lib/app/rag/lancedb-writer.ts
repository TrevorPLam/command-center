/**
 * LanceDB Writer Service
 * 
 * Handles writing embeddings and metadata to LanceDB vector database.
 * Supports index creation, versioning, and management operations.
 */

import { connect } from 'lancedb'
import { v4 as uuidv4 } from 'uuid'
import { 
  VectorIndex, 
  IndexVersion, 
  IndexingOptions,
  DocumentChunk,
  EmbeddingVector 
} from './types'
import { env } from '@/lib/config/env'

export interface LanceDBConfig {
  databasePath: string
  tableName: string
}

export interface IndexWriteOptions {
  indexVersion: string
  embeddingModel: string
  chunkingPolicy: any
  indexingOptions: IndexingOptions
}

export interface IndexStats {
  numIndexedRows: number
  numUnindexedRows: number
  indexType: string
  distanceType: string
  sizeBytes: number
}

/**
 * LanceDB integration service
 */
export class LanceDBWriter {
  private static connection: any = null
  private static tables = new Map<string, any>()
  
  /**
   * Initialize LanceDB connection
   */
  static async initialize(config: LanceDBConfig): Promise<void> {
    try {
      this.connection = await connect(config.databasePath)
      console.log(`Connected to LanceDB at ${config.databasePath}`)
    } catch (error) {
      throw new Error(`Failed to connect to LanceDB: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Get or create a table
   */
  private static async getTable(tableName: string): Promise<any> {
    if (!this.connection) {
      throw new Error('LanceDB connection not initialized')
    }
    
    if (this.tables.has(tableName)) {
      return this.tables.get(tableName)
    }
    
    try {
      // Try to open existing table
      const table = await this.connection.openTable(tableName)
      this.tables.set(tableName, table)
      return table
    } catch (error) {
      // Table doesn't exist, create it
      const table = await this.connection.createTable(tableName, this.getSchema())
      this.tables.set(tableName, table)
      return table
    }
  }
  
  /**
   * Get LanceDB schema for chunks
   */
  private static getSchema(): any {
    return {
      chunkId: 'string',
      documentId: 'string',
      sectionPath: 'string',
      text: 'string',
      metadata: 'string',
      chunkIndex: 'int32',
      tokenCount: 'int32',
      embeddingId: 'string',
      indexVersion: 'string',
      embeddingModel: 'string',
      createdAt: 'string',
      vector: 'vector<float32>' // Will be configured based on embedding model
    }
  }
  
  /**
   * Write chunks with embeddings to LanceDB
   */
  static async writeChunks(
    tableName: string,
    chunks: DocumentChunk[],
    embeddings: EmbeddingVector[],
    options: IndexWriteOptions
  ): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error(`Chunks and embeddings count mismatch: ${chunks.length} vs ${embeddings.length}`)
    }
    
    const table = await this.getTable(tableName)
    
    // Prepare data for insertion
    const data = chunks.map((chunk, index) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      sectionPath: JSON.stringify(chunk.sectionPath),
      text: chunk.text,
      metadata: JSON.stringify(chunk.metadata),
      chunkIndex: chunk.chunkIndex,
      tokenCount: chunk.tokenCount,
      embeddingId: uuidv4(),
      indexVersion: options.indexVersion,
      embeddingModel: options.embeddingModel,
      createdAt: new Date().toISOString(),
      vector: embeddings[index]
    }))
    
    try {
      // Add data to table
      await table.add(data)
      console.log(`Added ${data.length} chunks to LanceDB table ${tableName}`)
    } catch (error) {
      throw new Error(`Failed to write chunks to LanceDB: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Create vector index on table
   */
  static async createVectorIndex(
    tableName: string,
    indexConfig: IndexingOptions['vectorIndexConfig']
  ): Promise<void> {
    const table = await this.getTable(tableName)
    
    if (!indexConfig) {
      throw new Error('Vector index configuration is required')
    }
    
    const indexName = `${tableName}_vector_idx`
    
    try {
      // Configure index based on type
      let indexType = 'IVF_PQ' // Default
      let indexParams: any = {
        metric: indexConfig.metric || 'cosine',
        num_partitions: indexConfig.ivfLists || 100,
        num_sub_vectors: indexConfig.pq || 16
      }
      
      // Create index
      await table.createIndex(
        indexName,
        indexType,
        indexParams
      )
      
      console.log(`Created vector index ${indexName} on table ${tableName}`)
      
    } catch (error) {
      throw new Error(`Failed to create vector index: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Wait for index to be built
   */
  static async waitForIndex(
    tableName: string,
    indexName: string,
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<void> {
    const table = await this.getTable(tableName)
    const startTime = Date.now()
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const stats = await table.indexStats(indexName)
        if (stats.numUnindexedRows === 0) {
          console.log(`Index ${indexName} is fully built`)
          return
        }
        
        console.log(`Index progress: ${stats.numIndexedRows}/${stats.numIndexedRows + stats.numUnindexedRows}`)
        await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
      } catch (error) {
        // Index might not be ready yet
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
    
    throw new Error(`Index build timed out after ${timeoutMs}ms`)
  }
  
  /**
   * Get index statistics
   */
  static async getIndexStats(
    tableName: string,
    indexName: string
  ): Promise<IndexStats> {
    const table = await this.getTable(tableName)
    
    try {
      const stats = await table.indexStats(indexName)
      
      return {
        numIndexedRows: stats.numIndexedRows,
        numUnindexedRows: stats.numUnindexedRows,
        indexType: stats.indexType || 'unknown',
        distanceType: stats.distanceType || 'unknown',
        sizeBytes: stats.sizeBytes || 0
      }
    } catch (error) {
      throw new Error(`Failed to get index stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Search for similar vectors
   */
  static async vectorSearch(
    tableName: string,
    queryVector: EmbeddingVector,
    limit: number = 10,
    indexName?: string,
    filter?: string
  ): Promise<any[]> {
    const table = await this.getTable(tableName)
    
    try {
      // Perform vector search
      const results = await table
        .search(queryVector)
        .limit(limit)
        .select(['chunkId', 'documentId', 'text', 'metadata', 'chunkIndex', 'indexVersion'])
        .where(filter) // Optional filter
        .execute()
      
      return results
    } catch (error) {
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Full-text search
   */
  static async fullTextSearch(
    tableName: string,
    query: string,
    limit: number = 10,
    filter?: string
  ): Promise<any[]> {
    const table = await this.getTable(tableName)
    
    try {
      // Perform full-text search
      const results = await table
        .search(query)
        .limit(limit)
        .select(['chunkId', 'documentId', 'text', 'metadata', 'chunkIndex', 'indexVersion'])
        .where(filter) // Optional filter
        .execute()
      
      return results
    } catch (error) {
      throw new Error(`Full-text search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Delete chunks by document ID
   */
  static async deleteChunksByDocument(
    tableName: string,
    documentId: string
  ): Promise<number> {
    const table = await this.getTable(tableName)
    
    try {
      // Delete chunks for document
      await table.delete(`documentId = '${documentId}'`)
      
      console.log(`Deleted chunks for document ${documentId} from table ${tableName}`)
      
      // Return count (would need to query first in real implementation)
      return 0
    } catch (error) {
      throw new Error(`Failed to delete chunks: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Delete chunks by index version
   */
  static async deleteChunksByVersion(
    tableName: string,
    indexVersion: string
  ): Promise<number> {
    const table = await this.getTable(tableName)
    
    try {
      // Delete chunks for index version
      await table.delete(`indexVersion = '${indexVersion}'`)
      
      console.log(`Deleted chunks for index version ${indexVersion} from table ${tableName}`)
      
      return 0
    } catch (error) {
      throw new Error(`Failed to delete chunks by version: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Get table statistics
   */
  static async getTableStats(tableName: string): Promise<{
    numRows: number
    sizeBytes: number
    indexes: string[]
  }> {
    const table = await this.getTable(tableName)
    
    try {
      // Get basic stats
      const numRows = await table.count()
      
      // Get index list
      const indexes = await table.listIndexes()
      
      return {
        numRows,
        sizeBytes: 0, // Would need to calculate from actual storage
        indexes: indexes.map((idx: any) => idx.name)
      }
    } catch (error) {
      throw new Error(`Failed to get table stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Drop table
   */
  static async dropTable(tableName: string): Promise<void> {
    if (!this.connection) {
      throw new Error('LanceDB connection not initialized')
    }
    
    try {
      await this.connection.dropTable(tableName)
      this.tables.delete(tableName)
      console.log(`Dropped table ${tableName}`)
    } catch (error) {
      throw new Error(`Failed to drop table: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Close connection
   */
  static async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close()
      this.connection = null
      this.tables.clear()
      console.log('Closed LanceDB connection')
    }
  }
  
  /**
   * Get default configuration
   */
  static getDefaultConfig(): LanceDBConfig {
    return {
      databasePath: env.LANCEDB_DIR || './data/lancedb',
      tableName: 'chunks'
    }
  }
}
