/**
 * Evidence Pack
 * 
 * Manages collections of retrieved evidence chunks for RAG queries.
 * Provides utilities for organizing, ranking, and formatting evidence.
 */

import { 
  IndexedChunk, 
  EvidencePack as EvidencePackType,
  RetrievalQuery,
  RetrievalResult
} from './types'

export class EvidencePack {
  /**
   * Create an evidence pack from retrieval results
   */
  static create(
    query: RetrievalQuery,
    results: RetrievalResult,
    packedAt: Date = new Date()
  ): EvidencePackType {
    return {
      chunks: results.chunks,
      totalTokens: results.chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      query: query.query,
      indexVersion: results.indexVersion,
      packedAt
    }
  }

  /**
   * Pack chunks by document with optional ordering
   */
  static packByDocument(
    chunks: IndexedChunk[],
    preserveOrder: boolean = false
  ): IndexedChunk[] {
    // Group chunks by document
    const documentGroups = new Map<string, IndexedChunk[]>()

    chunks.forEach(chunk => {
      const docId = chunk.documentId
      if (!documentGroups.has(docId)) {
        documentGroups.set(docId, [])
      }
      documentGroups.get(docId)!.push(chunk)
    })

    // Sort groups and flatten
    const sortedGroups = Array.from(documentGroups.entries()).sort(([docA], [docB]) => docA.localeCompare(docB))

    if (preserveOrder) {
      // Maintain original order within documents
      return sortedGroups.flatMap(([_, chunks]) => chunks)
    } else {
      // Sort chunks within each document by relevance
      return sortedGroups.flatMap(([_, chunks]) => 
        chunks.sort((a, b) => (b.score || 0) - (a.score || 0))
      )
    }
  }

  /**
   * Pack chunks by relevance score
   */
  static packByRelevance(chunks: IndexedChunk[]): IndexedChunk[] {
    return chunks
      .filter(chunk => chunk.score !== undefined)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .concat(chunks.filter(chunk => chunk.score === undefined))
  }

  /**
   * Pack chunks with diversity (avoid clustering from same document)
   */
  static packWithDiversity(
    chunks: IndexedChunk[],
    maxChunksPerDocument: number = 3
  ): IndexedChunk[] {
    const documentCounts = new Map<string, number>()
    const result: IndexedChunk[] = []

    for (const chunk of chunks) {
      const docId = chunk.documentId
      const currentCount = documentCounts.get(docId) || 0

      if (currentCount < maxChunksPerDocument) {
        result.push(chunk)
        documentCounts.set(docId, currentCount + 1)
      }
    }

    return result
  }

  /**
   * Get evidence summary
   */
  static getSummary(pack: EvidencePackType): {
    totalChunks: number
    totalTokens: number
    uniqueDocuments: number
    averageScore: number
    documentBreakdown: Array<{
      documentId: string
      chunkCount: number
      averageScore: number
    }>
  } {
    const uniqueDocuments = new Set(pack.chunks.map(c => c.documentId))
    const scores = pack.chunks.filter(c => c.score !== undefined).map(c => c.score!)
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    // Document breakdown
    const documentBreakdown = Array.from(
      pack.chunks.reduce((acc, chunk) => {
        const docId = chunk.documentId
        if (!acc.has(docId)) {
          acc.set(docId, { chunks: [], scores: [] })
        }
        acc.get(docId)!.chunks.push(chunk)
        if (chunk.score !== undefined) {
          acc.get(docId)!.scores.push(chunk.score)
        }
        return acc
      }, new Map<string, { chunks: IndexedChunk[], scores: number[] }>())
    ).map(([docId, data]) => ({
      documentId: docId,
      chunkCount: data.chunks.length,
      averageScore: data.scores.length > 0 
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length 
        : 0
    }))

    return {
      totalChunks: pack.chunks.length,
      totalTokens: pack.totalTokens,
      uniqueDocuments: uniqueDocuments.size,
      averageScore,
      documentBreakdown
    }
  }

  /**
   * Format evidence for display
   */
  static formatForDisplay(
    pack: EvidencePackType,
    options: {
      includeMetadata?: boolean
      maxTextLength?: number
      includeScores?: boolean
    } = {}
  ): Array<{
    id: string
    documentId: string
    text: string
    score?: number
    metadata?: Record<string, unknown>
  }> {
    const {
      includeMetadata = false,
      maxTextLength = 500,
      includeScores = true
    } = options

    return pack.chunks.map(chunk => ({
      id: chunk.chunkId,
      documentId: chunk.documentId,
      text: chunk.text.length > maxTextLength 
        ? chunk.text.substring(0, maxTextLength) + '...'
        : chunk.text,
      ...(includeScores && chunk.score && { score: chunk.score }),
      ...(includeMetadata && { metadata: chunk.metadata })
    }))
  }

  /**
   * Filter evidence by relevance threshold
   */
  static filterByRelevance(
    pack: EvidencePackType,
    minScore: number
  ): EvidencePackType {
    return {
      ...pack,
      chunks: pack.chunks.filter(chunk => 
        chunk.score === undefined || chunk.score >= minScore
      )
    }
  }

  /**
   * Truncate evidence to fit token budget
   */
  static truncateToTokenBudget(
    pack: EvidencePackType,
    maxTokens: number
  ): EvidencePackType {
    let currentTokens = 0
    const truncatedChunks: IndexedChunk[] = []

    for (const chunk of pack.chunks) {
      if (currentTokens + chunk.tokenCount <= maxTokens) {
        truncatedChunks.push(chunk)
        currentTokens += chunk.tokenCount
      } else {
        break
      }
    }

    return {
      ...pack,
      chunks: truncatedChunks,
      totalTokens: currentTokens
    }
  }

  /**
   * Merge multiple evidence packs
   */
  static merge(packs: EvidencePackType[]): EvidencePackType {
    if (packs.length === 0) {
      throw new Error('Cannot merge empty evidence pack list')
    }

    const allChunks = packs.flatMap(p => p.chunks)
    const uniqueChunks = this.deduplicateChunks(allChunks)
    const totalTokens = uniqueChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0)

    return {
      chunks: uniqueChunks,
      totalTokens,
      query: packs[0].query, // Use first query
      indexVersion: packs[0].indexVersion, // Use first index version
      packedAt: new Date()
    }
  }

  /**
   * Remove duplicate chunks
   */
  private static deduplicateChunks(chunks: IndexedChunk[]): IndexedChunk[] {
    const seen = new Set<string>()
    const result: IndexedChunk[] = []

    for (const chunk of chunks) {
      const key = `${chunk.documentId}:${chunk.chunkIndex}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(chunk)
      }
    }

    return result
  }

  /**
   * Validate evidence pack
   */
  static validate(pack: EvidencePackType): {
    isValid: boolean
    issues: string[]
  } {
    const issues: string[] = []

    if (!pack.chunks || pack.chunks.length === 0) {
      issues.push('Evidence pack contains no chunks')
    }

    if (pack.totalTokens <= 0) {
      issues.push('Total token count is invalid')
    }

    if (!pack.query || pack.query.trim().length === 0) {
      issues.push('Query is empty')
    }

    if (!pack.indexVersion) {
      issues.push('Index version is missing')
    }

    // Validate chunk structure
    pack.chunks?.forEach((chunk, index) => {
      if (!chunk.chunkId) {
        issues.push(`Chunk ${index} missing chunkId`)
      }
      if (!chunk.documentId) {
        issues.push(`Chunk ${index} missing documentId`)
      }
      if (!chunk.text || chunk.text.trim().length === 0) {
        issues.push(`Chunk ${index} has empty text`)
      }
      if (chunk.tokenCount <= 0) {
        issues.push(`Chunk ${index} has invalid token count`)
      }
    })

    return {
      isValid: issues.length === 0,
      issues
    }
  }
}
