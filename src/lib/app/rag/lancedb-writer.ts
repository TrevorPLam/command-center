/**
 * LanceDB Writer Service
 * 
 * Handles writing embeddings and metadata to LanceDB vector database.
 * Supports index creation, versioning, and management operations.
 * Enhanced with comprehensive embedding management.
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

export interface IndexMetadata {
  indexVersion: string
  embeddingModel: string
  chunkingPolicy: any
  indexingOptions: IndexingOptions
  createdAt: Date
  chunkCount: number
}

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
   * Get or create table
   */
  private static async getTable(tableName: string): Promise<any> {
    if (!this.connection) {
      throw new Error('LanceDB connection not initialized')
    }

    if (this.tables.has(tableName)) {
      return this.tables.get(tableName)
    }

    try {
      const table = await this.connection.openTable(tableName)
      this.tables.set(tableName, table)
      return table
    } catch (error) {
      // Table doesn't exist, create it
      const schema = {
        chunkId: 'string',
        documentId: 'string',
        sectionPath: 'list<string>',
        text: 'string',
        metadata: 'object',
        chunkIndex: 'int32',
        tokenCount: 'int32',
        embeddingId: 'string',
        createdAt: 'string',
        vector: 'vector' // Will be added dynamically
      }

      const table = await this.connection.createTable(tableName, schema)
      this.tables.set(tableName, table)
      return table
    }
  }

  /**
   * Write chunks to LanceDB
   */
  static async writeChunks(
    tableName: string,
    chunks: DocumentChunk[],
    embeddings: EmbeddingVector[],
    metadata: IndexMetadata
  ): Promise<void> {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunks and embeddings must have the same length')
    }

    const table = await this.getTable(tableName)

    try {
      // Prepare data for insertion
      const data = chunks.map((chunk, index) => ({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        sectionPath: chunk.sectionPath,
        text: chunk.text,
        metadata: chunk.metadata,
        chunkIndex: chunk.chunkIndex,
        tokenCount: chunk.tokenCount,
        embeddingId: chunk.embeddingId || uuidv4(),
        createdAt: chunk.createdAt.toISOString(),
        vector: embeddings[index],
        // Index metadata
        indexVersion: metadata.indexVersion,
        embeddingModel: metadata.embeddingModel,
        chunkingPolicy: metadata.chunkingPolicy,
        indexingOptions: metadata.indexingOptions
      }))

      // Add data to table
      await table.add(data)

      // Create vector index if it doesn't exist
      await this.ensureVectorIndex(table, metadata)

      console.log(`Wrote ${chunks.length} chunks to table ${tableName}`)
    } catch (error) {
      throw new Error(`Failed to write chunks: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Ensure vector index exists
   */
  private static async ensureVectorIndex(table: any, metadata: IndexMetadata): Promise<void> {
    try {
      const indexes = await table.listIndexes()
      const indexName = `vector_idx_${metadata.indexVersion.replace(/[^a-zA-Z0-9]/g, '_')}`

      if (!indexes.some((idx: any) => idx.name === indexName)) {
        await table.createIndex({
          name: indexName,
          type: 'vector',
          column: 'vector',
          metric: metadata.indexingOptions.vectorIndexConfig?.metric || 'cosine'
        })

        console.log(`Created vector index ${indexName}`)
      }
    } catch (error) {
      console.warn('Failed to create vector index:', error)
    }
  }

  /**
   * Perform vector search
   */
  static async vectorSearch(
    tableName: string,
    queryVector: EmbeddingVector,
    limit: number = 10,
    indexVersion?: string
  ): Promise<any[]> {
    const table = await this.getTable(tableName)

    try {
      let query = table.search(queryVector).limit(limit)

      // Filter by index version if specified
      if (indexVersion) {
        query = query.where(`indexVersion = '${indexVersion}'`)
      }

      const results = await query.execute()
      
      return results.map((result: any) => ({
        chunkId: result.chunkId,
        documentId: result.documentId,
        sectionPath: result.sectionPath,
        text: result.text,
        metadata: result.metadata,
        chunkIndex: result.chunkIndex,
        tokenCount: result.tokenCount,
        score: result._distance,
        sourceLabel: `${result.documentId} (${result.chunkIndex})`,
        citationLabel: `[${result.chunkIndex}]`,
        createdAt: new Date(result.createdAt)
      }))
    } catch (error) {
      throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get chunks by document ID
   */
  static async getChunksByDocument(
    tableName: string,
    documentId: string,
    indexVersion?: string
  ): Promise<any[]> {
    const table = await this.getTable(tableName)

    try {
      let query = table.search().where(`documentId = '${documentId}'`)

      if (indexVersion) {
        query = query.and(`indexVersion = '${indexVersion}'`)
      }

      const results = await query.execute()
      
      return results.map((result: any) => ({
        chunkId: result.chunkId,
        documentId: result.documentId,
        sectionPath: result.sectionPath,
        text: result.text,
        metadata: result.metadata,
        chunkIndex: result.chunkIndex,
        tokenCount: result.tokenCount,
        createdAt: new Date(result.createdAt)
      }))
    } catch (error) {
      throw new Error(`Failed to get chunks: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
