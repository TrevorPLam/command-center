/**
 * Vector Retrieval Service
 * 
 * Handles vector similarity search using LanceDB.
 * Supports different distance metrics and filtering options.
 */

import { connect } from 'lancedb'
import { lancedb } from 'lancedb'
import path from 'path'
import { RetrievalQuery, RetrievalResult, IndexedChunk, VectorIndex } from '../types'
import { env } from '@/lib/config/env'

export class VectorRetrievalService {
  private db: lancedb.Connection | null = null
  private initialized = false

  /**
   * Initialize the LanceDB connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.db = await connect(env.LANCEDB_DIR)
      this.initialized = true
    } catch (error) {
      throw new Error(`Failed to initialize LanceDB: ${error}`)
    }
  }

  /**
   * Perform vector similarity search
   */
  async search(query: RetrievalQuery, index: VectorIndex): Promise<RetrievalResult> {
    await this.initialize()

    if (!this.db) {
      throw new Error('LanceDB not initialized')
    }

    const startTime = Date.now()

    try {
      // Get the table for the index version
      const tableName = this.getTableName(index.id, index.currentVersion.version)
      const table = await this.db.openTable(tableName)

      // Generate query embedding (this would use the embedding service)
      const queryEmbedding = await this.generateQueryEmbedding(query.query, index.currentVersion.embeddingModel)

      // Perform similarity search
      const results = await table
        .vectorSearch(queryEmbedding)
        .limit(query.topK)
        .filter(this.buildLanceDBFilter(query.filters))
        .execute()

      // Convert results to IndexedChunk format
      const chunks: IndexedChunk[] = results.map((row, index) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        sectionPath: JSON.parse(row.section_path),
        text: row.text,
        metadata: JSON.parse(row.metadata),
        chunkIndex: row.chunk_index,
        tokenCount: row.token_count,
        embeddingId: row.embedding_id,
        createdAt: new Date(row.created_at),
        score: row._distance ? 1 - row._distance : undefined, // Convert distance to similarity
        sourceLabel: this.generateSourceLabel(row.document_id, row.source_path),
        citationLabel: this.generateCitationLabel(index + 1)
      }))

      // Apply similarity threshold if specified
      const filteredChunks = query.similarityThreshold
        ? chunks.filter(chunk => chunk.score && chunk.score >= query.similarityThreshold)
        : chunks

      // Apply reranking if requested
      const finalChunks = query.rerank
        ? await this.rerankResults(query.query, filteredChunks)
        : filteredChunks

      const queryTime = Date.now() - startTime

      return {
        chunks: finalChunks,
        queryTime,
        totalResults: results.length,
        indexVersion: index.currentVersion.version,
        metadata: {
          queryEmbedding: queryEmbedding,
          distanceMetric: index.config.vectorIndexConfig?.metric || 'cosine',
          threshold: query.similarityThreshold,
          reranked: query.rerank
        }
      }

    } catch (error) {
      throw new Error(`Vector search failed: ${error}`)
    }
  }

  /**
   * Generate embedding for the query text
   */
  private async generateQueryEmbedding(query: string, model: string): Promise<number[]> {
    // This would integrate with the embedding service
    // For now, return a mock embedding
    console.log(`Generating embedding for query: "${query}" using model: ${model}`)
    
    // Mock embedding - in real implementation this would call the runtime service
    return Array.from({ length: 1536 }, () => Math.random() - 0.5)
  }

  /**
   * Build LanceDB filter from query filters
   */
  private buildLanceDBFilter(filters?: Record<string, any>): string | undefined {
    if (!filters || Object.keys(filters).length === 0) {
      return undefined
    }

    const filterConditions: string[] = []

    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string') {
        filterConditions.push(`${key} = '${value}'`)
      } else if (typeof value === 'number') {
        filterConditions.push(`${key} = ${value}`)
      } else if (Array.isArray(value)) {
        const inClause = value.map(v => `'${v}'`).join(', ')
        filterConditions.push(`${key} IN (${inClause})`)
      }
    }

    return filterConditions.length > 0 ? filterConditions.join(' AND ') : undefined
  }

  /**
   * Rerank results using a cross-encoder or similar approach
   */
  private async rererankResults(query: string, chunks: IndexedChunk[]): Promise<IndexedChunk[]> {
    // Mock reranking - in real implementation this would use a cross-encoder
    return chunks.map((chunk, index) => ({
      ...chunk,
      rerankScore: 1 - (index * 0.1) // Simple descending score
    })).sort((a, b) => (b.rerankScore || 0) - (a.rerankScore || 0))
  }

  /**
   * Generate source label for citations
   */
  private generateSourceLabel(documentId: string, sourcePath: string): string {
    const filename = path.basename(sourcePath)
    const docId = documentId.substring(0, 8)
    return `${filename} (${docId})`
  }

  /**
   * Generate citation label
   */
  private generateCitationLabel(index: number): string {
    return `[${index}]`
  }

  /**
   * Get table name for index version
   */
  private getTableName(indexId: string, version: string): string {
    return `${indexId}_v_${version.replace(/\./g, '_')}`
  }

  /**
   * Check if index exists and is ready
   */
  async indexExists(indexId: string, version: string): Promise<boolean> {
    await this.initialize()

    if (!this.db) return false

    try {
      const tableName = this.getTableName(indexId, version)
      const tableNames = await this.db.tableNames()
      return tableNames.includes(tableName)
    } catch {
      return false
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(indexId: string, version: string): Promise<Record<string, any>> {
    await this.initialize()

    if (!this.db) {
      throw new Error('LanceDB not initialized')
    }

    try {
      const tableName = this.getTableName(indexId, version)
      const table = await this.db.openTable(tableName)
      
      // Get basic stats
      const stats = await table.describe()
      
      return {
        tableName,
        numRows: stats.num_rows,
        numColumns: stats.num_columns,
        schema: stats.schema
      }
    } catch (error) {
      throw new Error(`Failed to get index stats: ${error}`)
    }
  }
}

// Singleton instance
export const vectorRetrievalService = new VectorRetrievalService()
