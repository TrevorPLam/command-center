/**
 * Base Chunker Interface and Common Functionality
 * 
 * Provides the foundation for all document chunkers with common utilities
 * and the chunker interface definition.
 */

import { DocumentChunk, DocumentContentType, ChunkingPolicy } from '../types'

export interface Chunker {
  /**
   * Chunk a document into smaller pieces
   */
  chunk(
    documentId: string,
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>,
    policy: ChunkingPolicy
  ): Promise<DocumentChunk[]>

  /**
   * Get supported content types
   */
  getSupportedContentTypes(): DocumentContentType[]
}

export abstract class BaseChunker implements Chunker {
  abstract chunk(
    documentId: string,
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>,
    policy: ChunkingPolicy
  ): Promise<DocumentChunk[]>

  abstract getSupportedContentTypes(): DocumentContentType[]

  /**
   * Calculate approximate token count for text
   */
  protected calculateTokenCount(text: string): number {
    // Simple approximation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  /**
   * Split text into chunks based on size
   */
  protected splitBySize(
    text: string,
    maxChunkSize: number,
    overlap: number = 0
  ): string[] {
    if (text.length <= maxChunkSize) {
      return [text]
    }

    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      let end = start + maxChunkSize
      
      // Try to break at word boundary
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end)
        if (lastSpace > start) {
          end = lastSpace
        }
      }

      chunks.push(text.substring(start, end))
      
      // Move start position with overlap
      start = Math.max(end - overlap, end > text.length ? text.length : end + 1)
    }

    return chunks
  }

  /**
   * Split text by separators
   */
  protected splitBySeparators(
    text: string,
    separators: string[],
    maxChunkSize: number,
    overlap: number = 0
  ): string[] {
    if (separators.length === 0) {
      return this.splitBySize(text, maxChunkSize, overlap)
    }

    // Find all separator positions
    const positions: number[] = [0]
    
    for (const separator of separators) {
      let index = text.indexOf(separator)
      while (index !== -1) {
        positions.push(index + separator.length)
        index = text.indexOf(separator, index + 1)
      }
    }

    // Sort and deduplicate positions
    const sortedPositions = [...new Set(positions)].sort((a, b) => a - b)

    // Create chunks based on separator positions
    const chunks: string[] = []
    let startIndex = 0

    for (let i = 1; i < sortedPositions.length; i++) {
      const endIndex = sortedPositions[i]
      const chunkText = text.substring(startIndex, endIndex)
      
      if (chunkText.length > 0) {
        // If chunk is too large, split it further
        if (chunkText.length > maxChunkSize) {
          const subChunks = this.splitBySize(chunkText, maxChunkSize, overlap)
          chunks.push(...subChunks)
        } else {
          chunks.push(chunkText)
        }
      }
      
      startIndex = endIndex
    }

    // Add remaining text
    if (startIndex < text.length) {
      const remainingText = text.substring(startIndex)
      if (remainingText.length > maxChunkSize) {
        chunks.push(...this.splitBySize(remainingText, maxChunkSize, overlap))
      } else {
        chunks.push(remainingText)
      }
    }

    return chunks.filter(chunk => chunk.trim().length > 0)
  }

  /**
   * Create document chunk
   */
  protected createChunk(
    documentId: string,
    text: string,
    sectionPath: string[],
    chunkIndex: number,
    metadata: Record<string, unknown> = {}
  ): DocumentChunk {
    return {
      chunkId: `${documentId}-chunk-${chunkIndex}`,
      documentId,
      sectionPath,
      text: text.trim(),
      metadata: {
        ...metadata,
        char_count: text.length,
        token_count: this.calculateTokenCount(text),
        chunk_index: chunkIndex
      },
      chunkIndex,
      tokenCount: this.calculateTokenCount(text),
      createdAt: new Date()
    }
  }

  /**
   * Merge small chunks with neighbors
   */
  protected mergeSmallChunks(
    chunks: DocumentChunk[],
    minChunkSize: number
  ): DocumentChunk[] {
    if (chunks.length === 0) return chunks

    const merged: DocumentChunk[] = []
    let current = chunks[0]

    for (let i = 1; i < chunks.length; i++) {
      const next = chunks[i]
      const combinedSize = current.text.length + next.text.length

      // If current chunk is small and combined with next is still under max size, merge
      if (current.text.length < minChunkSize && combinedSize < 2000) {
        current = this.createChunk(
          current.documentId,
          current.text + '\n\n' + next.text,
          current.sectionPath,
          current.chunkIndex,
          {
            ...current.metadata,
            merged: true,
            original_chunks: [current.chunkId, next.chunkId]
          }
        )
      } else {
        merged.push(current)
        current = next
      }
    }

    merged.push(current)
    return merged
  }

  /**
   * Validate chunk quality
   */
  protected validateChunk(chunk: DocumentChunk, policy: ChunkingPolicy): boolean {
    // Check minimum size
    if (policy.minChunkSize && chunk.text.length < policy.minChunkSize) {
      return false
    }

    // Check maximum size
    if (chunk.text.length > policy.maxChunkSize) {
      return false
    }

    // Check if chunk is not just whitespace
    if (chunk.text.trim().length === 0) {
      return false
    }

    return true
  }

  /**
   * Get chunk statistics
   */
  protected getChunkStats(chunks: DocumentChunk[]): {
    totalChunks: number
    totalTokens: number
    avgChunkSize: number
    minChunkSize: number
    maxChunkSize: number
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        totalTokens: 0,
        avgChunkSize: 0,
        minChunkSize: 0,
        maxChunkSize: 0
      }
    }

    const sizes = chunks.map(chunk => chunk.text.length)
    const tokens = chunks.map(chunk => chunk.tokenCount)

    return {
      totalChunks: chunks.length,
      totalTokens: tokens.reduce((sum, count) => sum + count, 0),
      avgChunkSize: sizes.reduce((sum, size) => sum + size, 0) / sizes.length,
      minChunkSize: Math.min(...sizes),
      maxChunkSize: Math.max(...sizes)
    }
  }
}
