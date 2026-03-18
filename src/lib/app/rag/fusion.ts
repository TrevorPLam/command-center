/**
 * Fusion Service for Hybrid Search
 * 
 * Combines results from vector and full-text search using various fusion strategies.
 * Supports score normalization, reciprocal rank fusion, and weighted combinations.
 */

import { RetrievalQuery, RetrievalResult, IndexedChunk, VectorIndex } from '../types'
import { vectorRetrievalService } from './retrieval-service'
import { fullTextSearchService } from './fulltext-search'

export type FusionStrategy = 
  | 'reciprocal_rank'     // Reciprocal Rank Fusion (RRF)
  | 'weighted_score'      // Weighted combination of normalized scores
  | 'condensed_list'      // Condensed list fusion
  | 'interleaved'         // Interleaved results
  | 'best_of_k'           // Best results from each method

export interface FusionConfig {
  strategy: FusionStrategy
  vectorWeight?: number     // Weight for vector search results (0-1)
  textWeight?: number       // Weight for text search results (0-1)
  k?: number              // Parameter for RRF (default: 60)
  topK?: number            // Final number of results to return
  minScore?: number        // Minimum score threshold
}

export class FusionService {
  /**
   * Perform hybrid search by combining vector and full-text results
   */
  async hybridSearch(
    query: RetrievalQuery, 
    index: VectorIndex, 
    config: FusionConfig
  ): Promise<RetrievalResult> {
    const startTime = Date.now()

    try {
      // Run both searches in parallel
      const [vectorResult, textResult] = await Promise.all([
        vectorRetrievalService.search(query, index),
        fullTextSearchService.search(query, index)
      ])

      // Combine results using the specified fusion strategy
      const fusedChunks = await this.fuseResults(
        vectorResult.chunks,
        textResult.chunks,
        config
      )

      // Apply final topK limit
      const finalChunks = fusedChunks.slice(0, config.topK || query.topK)

      const queryTime = Date.now() - startTime

      return {
        chunks: finalChunks,
        queryTime,
        totalResults: fusedChunks.length,
        indexVersion: index.currentVersion.version,
        metadata: {
          fusionStrategy: config.strategy,
          vectorResults: vectorResult.chunks.length,
          textResults: textResult.chunks.length,
          fusionConfig: config,
          vectorMetadata: vectorResult.metadata,
          textMetadata: textResult.metadata
        }
      }

    } catch (error) {
      throw new Error(`Hybrid search failed: ${error}`)
    }
  }

  /**
   * Fuse results from two search methods
   */
  private async fuseResults(
    vectorChunks: IndexedChunk[],
    textChunks: IndexedChunk[],
    config: FusionConfig
  ): Promise<IndexedChunk[]> {
    switch (config.strategy) {
      case 'reciprocal_rank':
        return this.reciprocalRankFusion(vectorChunks, textChunks, config)
      
      case 'weighted_score':
        return this.weightedScoreFusion(vectorChunks, textChunks, config)
      
      case 'condensed_list':
        return this.condensedListFusion(vectorChunks, textChunks, config)
      
      case 'interleaved':
        return this.interleavedFusion(vectorChunks, textChunks, config)
      
      case 'best_of_k':
        return this.bestOfKFusion(vectorChunks, textChunks, config)
      
      default:
        return this.reciprocalRankFusion(vectorChunks, textChunks, config)
    }
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   * 
   * RRF(k) = Σ(1 / (k + rank_i)) for each result i
   * Default k=60 as recommended in literature
   */
  private reciprocalRankFusion(
    vectorChunks: IndexedChunk[],
    textChunks: IndexedChunk[],
    config: FusionConfig
  ): IndexedChunk[] {
    const k = config.k || 60
    const chunkMap = new Map<string, IndexedChunk>()

    // Process vector results
    vectorChunks.forEach((chunk, rank) => {
      const key = this.getChunkKey(chunk)
      const score = 1 / (k + rank + 1) // +1 because rank is 0-based
      
      chunkMap.set(key, {
        ...chunk,
        score: chunk.score || 0,
        fusionScore: score
      })
    })

    // Process text results and add to fusion scores
    textChunks.forEach((chunk, rank) => {
      const key = this.getChunkKey(chunk)
      const score = 1 / (k + rank + 1)
      
      const existing = chunkMap.get(key)
      if (existing) {
        existing.fusionScore = (existing.fusionScore || 0) + score
      } else {
        chunkMap.set(key, {
          ...chunk,
          score: chunk.score || 0,
          fusionScore: score
        })
      }
    })

    // Sort by fusion score and return
    return Array.from(chunkMap.values())
      .sort((a, b) => (b.fusionScore || 0) - (a.fusionScore || 0))
      .filter(chunk => !config.minScore || (chunk.fusionScore || 0) >= config.minScore)
  }

  /**
   * Weighted Score Fusion
   * 
   * Normalize scores from both methods and combine with weights
   */
  private weightedScoreFusion(
    vectorChunks: IndexedChunk[],
    textChunks: IndexedChunk[],
    config: FusionConfig
  ): IndexedChunk[] {
    const vectorWeight = config.vectorWeight || 0.5
    const textWeight = config.textWeight || 0.5
    
    // Normalize scores to 0-1 range
    const normalizedVector = this.normalizeScores(vectorChunks)
    const normalizedText = this.normalizeScores(textChunks)

    const chunkMap = new Map<string, IndexedChunk>()

    // Process vector results
    normalizedVector.forEach(chunk => {
      const key = this.getChunkKey(chunk)
      chunkMap.set(key, {
        ...chunk,
        fusionScore: (chunk.score || 0) * vectorWeight
      })
    })

    // Process text results and add weighted scores
    normalizedText.forEach(chunk => {
      const key = this.getChunkKey(chunk)
      const existing = chunkMap.get(key)
      
      if (existing) {
        existing.fusionScore = (existing.fusionScore || 0) + (chunk.score || 0) * textWeight
      } else {
        chunkMap.set(key, {
          ...chunk,
          fusionScore: (chunk.score || 0) * textWeight
        })
      }
    })

    // Sort by fusion score
    return Array.from(chunkMap.values())
      .sort((a, b) => (b.fusionScore || 0) - (a.fusionScore || 0))
      .filter(chunk => !config.minScore || (chunk.fusionScore || 0) >= config.minScore)
  }

  /**
   * Condensed List Fusion
   * 
   * Takes the best results from both lists while maintaining order
   */
  private condensedListFusion(
    vectorChunks: IndexedChunk[],
    textChunks: IndexedChunk[],
    config: FusionConfig
  ): IndexedChunk[] {
    const seen = new Set<string>()
    const result: IndexedChunk[] = []
    const maxResults = (config.topK || 20) * 2 // Take more initially

    // Add top vector results
    vectorChunks.slice(0, maxResults).forEach(chunk => {
      const key = this.getChunkKey(chunk)
      if (!seen.has(key)) {
        seen.add(key)
        result.push({
          ...chunk,
          fusionScore: chunk.score || 0
        })
      }
    })

    // Add top text results that weren't already added
    textChunks.slice(0, maxResults).forEach(chunk => {
      const key = this.getChunkKey(chunk)
      if (!seen.has(key)) {
        seen.add(key)
        result.push({
          ...chunk,
          fusionScore: chunk.score || 0
        })
      }
    })

    // Sort by original scores (maintaining some ranking)
    return result
      .sort((a, b) => (b.fusionScore || 0) - (a.fusionScore || 0))
      .filter(chunk => !config.minScore || (chunk.fusionScore || 0) >= config.minScore)
  }

  /**
   * Interleaved Fusion
   * 
   * Interleaves results from both lists
   */
  private interleavedFusion(
    vectorChunks: IndexedChunk[],
    textChunks: IndexedChunk[],
    config: FusionConfig
  ): IndexedChunk[] {
    const seen = new Set<string>()
    const result: IndexedChunk[] = []
    const maxResults = config.topK || 20

    // Interleave results
    for (let i = 0; i < maxResults && result.length < maxResults; i++) {
      // Add vector result at position i
      if (i < vectorChunks.length) {
        const vChunk = vectorChunks[i]
        const key = this.getChunkKey(vChunk)
        if (!seen.has(key)) {
          seen.add(key)
          result.push({
            ...vChunk,
            fusionScore: vChunk.score || 0
          })
        }
      }

      // Add text result at position i
      if (i < textChunks.length && result.length < maxResults) {
        const tChunk = textChunks[i]
        const key = this.getChunkKey(tChunk)
        if (!seen.has(key)) {
          seen.add(key)
          result.push({
            ...tChunk,
            fusionScore: tChunk.score || 0
          })
        }
      }
    }

    return result.filter(chunk => !config.minScore || (chunk.fusionScore || 0) >= config.minScore)
  }

  /**
   * Best-of-K Fusion
   * 
   * Takes the top K results from each method and merges them
   */
  private bestOfKFusion(
    vectorChunks: IndexedChunk[],
    textChunks: IndexedChunk[],
    config: FusionConfig
  ): IndexedChunk[] {
    const k = config.topK || 10
    const seen = new Set<string>()
    const result: IndexedChunk[] = []

    // Take top k from vector
    vectorChunks.slice(0, k).forEach(chunk => {
      const key = this.getChunkKey(chunk)
      if (!seen.has(key)) {
        seen.add(key)
        result.push({
          ...chunk,
          fusionScore: chunk.score || 0
        })
      }
    })

    // Take top k from text
    textChunks.slice(0, k).forEach(chunk => {
      const key = this.getChunkKey(chunk)
      if (!seen.has(key)) {
        seen.add(key)
        result.push({
          ...chunk,
          fusionScore: chunk.score || 0
        })
      }
    })

    // Sort by score and return top results
    return result
      .sort((a, b) => (b.fusionScore || 0) - (a.fusionScore || 0))
      .slice(0, config.topK)
      .filter(chunk => !config.minScore || (chunk.fusionScore || 0) >= config.minScore)
  }

  /**
   * Normalize scores to 0-1 range
   */
  private normalizeScores(chunks: IndexedChunk[]): IndexedChunk[] {
    if (chunks.length === 0) return chunks

    const scores = chunks.map(c => c.score || 0)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    
    if (maxScore === minScore) {
      // All scores are the same, give them all 0.5
      return chunks.map(chunk => ({ ...chunk, score: 0.5 }))
    }

    return chunks.map(chunk => ({
      ...chunk,
      score: ((chunk.score || 0) - minScore) / (maxScore - minScore)
    }))
  }

  /**
   * Get unique key for a chunk
   */
  private getChunkKey(chunk: IndexedChunk): string {
    return `${chunk.documentId}:${chunk.chunkId}`
  }

  /**
   * Get fusion strategy recommendations based on query characteristics
   */
  getRecommendedStrategy(query: string): FusionStrategy {
    // Analyze query characteristics
    const words = query.split(/\s+/).length
    const hasQuotes = query.includes('"')
    const hasBoolean = /\b(AND|OR|NOT)\b/i.test(query)
    const hasWildcards = query.includes('*')

    // Recommend strategy based on query type
    if (hasBoolean || hasWildcards) {
      return 'weighted_score' // Complex queries benefit from weighted scores
    } else if (hasQuotes) {
      return 'reciprocal_rank' // Phrase queries work well with RRF
    } else if (words <= 3) {
      return 'best_of_k' // Short queries: take best from both
    } else {
      return 'reciprocal_rank' // Default: RRF works well for most cases
    }
  }

  /**
   * Get default fusion config
   */
  getDefaultConfig(): FusionConfig {
    return {
      strategy: 'reciprocal_rank',
      vectorWeight: 0.6,
      textWeight: 0.4,
      k: 60,
      topK: 10,
      minScore: 0.1
    }
  }
}

// Singleton instance
export const fusionService = new FusionService()
