/**
 * Full-Text Search Service
 * 
 * Handles keyword-based search using SQLite FTS5 or similar.
 * Supports text analysis, stemming, and phrase queries.
 */

import { Database } from 'better-sqlite3'
import { RetrievalQuery, RetrievalResult, IndexedChunk, VectorIndex } from '../types'
import { getDb } from '@/lib/db/client'

export class FullTextSearchService {
  private db: Database | null = null

  /**
   * Initialize the full-text search tables
   */
  async initialize(): Promise<void> {
    this.db = getDb()

    try {
      // Create FTS5 virtual table if it doesn't exist
      const createFtsTable = `
        CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(
          chunk_id,
          document_id,
          section_path,
          text,
          metadata,
          source_path,
          content='document_chunks',
          content_rowid='rowid'
        )
      `
      
      this.db.exec(createFtsTable)

      // Create triggers to keep FTS table in sync
      const createTriggers = `
        -- Trigger for INSERT
        CREATE TRIGGER IF NOT EXISTS document_chunks_ai AFTER INSERT ON document_chunks BEGIN
          INSERT INTO document_chunks_fts(
            chunk_id, 
            document_id, 
            section_path, 
            text, 
            metadata,
            source_path
          ) VALUES (
            new.chunk_id,
            new.document_id,
            new.section_path,
            new.text,
            new.metadata,
            (SELECT source_path FROM documents WHERE id = new.document_id)
          );
        END;

        -- Trigger for DELETE
        CREATE TRIGGER IF NOT EXISTS document_chunks_ad AFTER DELETE ON document_chunks BEGIN
          DELETE FROM document_chunks_fts WHERE rowid = old.rowid;
        END;

        -- Trigger for UPDATE
        CREATE TRIGGER IF NOT EXISTS document_chunks_au AFTER UPDATE ON document_chunks BEGIN
          DELETE FROM document_chunks_fts WHERE rowid = old.rowid;
          INSERT INTO document_chunks_fts(
            chunk_id, 
            document_id, 
            section_path, 
            text, 
            metadata,
            source_path
          ) VALUES (
            new.chunk_id,
            new.document_id,
            new.section_path,
            new.text,
            new.metadata,
            (SELECT source_path FROM documents WHERE id = new.document_id)
          );
        END;
      `
      
      this.db.exec(createTriggers)

    } catch (error) {
      throw new Error(`Failed to initialize FTS: ${error}`)
    }
  }

  /**
   * Perform full-text search
   */
  async search(query: RetrievalQuery, index: VectorIndex): Promise<RetrievalResult> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const startTime = Date.now()

    try {
      // Build FTS5 query
      const ftsQuery = this.buildFtsQuery(query)

      // Execute search with ranking
      const searchQuery = `
        SELECT 
          dc.*,
          d.source_path,
          d.title as document_title,
          document_chunks_fts.rank as search_score,
          bm25(dc.text) as bm25_score
        FROM document_chunks_fts
        JOIN document_chunks dc ON document_chunks_fts.rowid = dc.rowid
        JOIN documents d ON dc.document_id = d.id
        WHERE document_chunks_fts MATCH ?
        ${query.filters ? this.buildSqlFilters(query.filters) : ''}
        ORDER BY document_chunks_fts.rank
        LIMIT ?
      `

      const stmt = this.db.prepare(searchQuery)
      const results = stmt.all(ftsQuery, query.topK) as any[]

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
        score: row.search_score || row.bm25_score,
        sourceLabel: this.generateSourceLabel(row.document_id, row.source_path),
        citationLabel: this.generateCitationLabel(index + 1)
      }))

      const queryTime = Date.now() - startTime

      return {
        chunks,
        queryTime,
        totalResults: results.length,
        indexVersion: index.currentVersion.version,
        metadata: {
          queryType: 'fulltext',
          ftsQuery,
          analyzer: index.config.keywordIndexConfig?.analyzer || 'standard',
          stopwords: index.config.keywordIndexConfig?.stopwords !== false
        }
      }

    } catch (error) {
      throw new Error(`Full-text search failed: ${error}`)
    }
  }

  /**
   * Build FTS5 query from user query
   */
  private buildFtsQuery(query: RetrievalQuery): string {
    let ftsQuery = query.query.trim()

    // Handle phrase queries (quotes)
    if (ftsQuery.includes('"')) {
      // Keep quoted phrases intact
      ftsQuery = ftsQuery.replace(/"([^"]+)"/g, '"$1"')
    } else {
      // Split into terms and apply NEAR operator for better context
      const terms = ftsQuery.split(/\s+/)
      if (terms.length > 1) {
        ftsQuery = terms.join(' NEAR ')
      }
    }

    // Handle boolean operators
    ftsQuery = ftsQuery.replace(/\bAND\b/gi, ' AND ')
    ftsQuery = ftsQuery.replace(/\bOR\b/gi, ' OR ')
    ftsQuery = ftsQuery.replace(/\bNOT\b/gi, ' NOT ')

    // Handle wildcards
    ftsQuery = ftsQuery.replace(/\*$/g, '*') // Support trailing wildcards

    return ftsQuery
  }

  /**
   * Build SQL WHERE clause from filters
   */
  private buildSqlFilters(filters: Record<string, any>): string {
    const conditions: string[] = []

    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'string') {
        conditions.push(`dc.${key} = '${value}'`)
      } else if (typeof value === 'number') {
        conditions.push(`dc.${key} = ${value}`)
      } else if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ')
        conditions.push(`dc.${key} IN (${placeholders})`)
      }
    }

    return conditions.length > 0 ? ` AND ${conditions.join(' AND ')}` : ''
  }

  /**
   * Generate source label for citations
   */
  private generateSourceLabel(documentId: string, sourcePath: string): string {
    const filename = sourcePath.split('/').pop() || sourcePath
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
   * Rebuild FTS index for all documents
   */
  async rebuildIndex(): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      // Drop and recreate FTS table
      this.db.exec('DROP TABLE IF EXISTS document_chunks_fts')
      this.db.exec('DROP TRIGGER IF EXISTS document_chunks_ai')
      this.db.exec('DROP TRIGGER IF EXISTS document_chunks_ad')
      this.db.exec('DROP TRIGGER IF EXISTS document_chunks_au')

      await this.initialize()

      // Reindex all existing data
      const reindexQuery = `
        INSERT INTO document_chunks_fts(
          chunk_id, 
          document_id, 
          section_path, 
          text, 
          metadata,
          source_path
        )
        SELECT 
          dc.chunk_id,
          dc.document_id,
          dc.section_path,
          dc.text,
          dc.metadata,
          d.source_path
        FROM document_chunks dc
        JOIN documents d ON dc.document_id = d.id
      `

      const result = this.db.exec(reindexQuery)
      console.log(`Reindexed ${result.changes()} chunks in FTS table`)

    } catch (error) {
      throw new Error(`Failed to rebuild FTS index: ${error}`)
    }
  }

  /**
   * Get search statistics
   */
  async getSearchStats(): Promise<Record<string, any>> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const stats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_chunks,
          COUNT(DISTINCT document_id) as total_documents,
          AVG(length(text)) as avg_chunk_length,
          MAX(length(text)) as max_chunk_length,
          MIN(length(text)) as min_chunk_length
        FROM document_chunks
      `).get() as any

      return stats
    } catch (error) {
      throw new Error(`Failed to get search stats: ${error}`)
    }
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    if (!this.db) {
      await this.initialize()
    }

    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      // Use FTS to find terms that start with the partial query
      const suggestionsQuery = `
        SELECT DISTINCT 
          snippet(document_chunks_fts, 1, '', '', '...', 32) as snippet
        FROM document_chunks_fts 
        WHERE document_chunks_fts MATCH ? || '*'
        LIMIT ?
      `

      const results = this.db.prepare(suggestionsQuery).all(partialQuery, limit) as any[]
      
      return results.map(row => row.snippet.replace(/<[^>]*>/g, '')) // Remove HTML tags

    } catch (error) {
      throw new Error(`Failed to get suggestions: ${error}`)
    }
  }
}

// Singleton instance
export const fullTextSearchService = new FullTextSearchService()
