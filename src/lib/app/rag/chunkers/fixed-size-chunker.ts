/**
 * Fixed Size Chunker
 * 
 * Chunks documents based on fixed character or token limits.
 * Simple and predictable chunking strategy.
 */

import { BaseChunker } from './chunker-base'
import { DocumentChunk, ChunkingPolicy, DocumentContentType } from '../types'

export class FixedSizeChunker extends BaseChunker {
  getSupportedContentTypes(): DocumentContentType[] {
    return [
      'text/plain',
      'text/markdown',
      'text/html',
      'application/json',
      'text/csv',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  }

  async chunk(
    documentId: string,
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>,
    policy: ChunkingPolicy
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []
    let chunkIndex = 0

    // Combine all sections into one text for fixed-size chunking
    const combinedText = sections.map(section => section.text).join('\n\n')
    const sectionBoundaries = this.calculateSectionBoundaries(sections)

    // Split by size with overlap
    const textChunks = this.splitBySize(combinedText, policy.maxChunkSize, policy.chunkOverlap)

    for (let i = 0; i < textChunks.length; i++) {
      const textChunk = textChunks[i]
      const sectionInfo = this.findSectionInfo(textChunk, sectionBoundaries, sections)

      const chunk = this.createChunk(
        documentId,
        textChunk,
        sectionInfo.sectionPath,
        chunkIndex++,
        {
          type: 'fixed_size',
          chunk_number: i + 1,
          total_chunks: textChunks.length,
          overlap: policy.chunkOverlap,
          ...sectionInfo.metadata
        }
      )

      chunks.push(chunk)
    }

    // Apply post-processing
    const processedChunks = this.postProcessChunks(chunks, policy)
    
    return processedChunks
  }

  /**
   * Calculate section boundaries for tracking
   */
  private calculateSectionBoundaries(
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>
  ): Array<{ start: number; end: number; sectionIndex: number }> {
    const boundaries = []
    let currentPos = 0

    sections.forEach((section, index) => {
      const start = currentPos
      const end = currentPos + section.text.length
      boundaries.push({ start, end, sectionIndex: index })
      currentPos = end + 2 // Add 2 for '\n\n' separator
    })

    return boundaries
  }

  /**
   * Find which section(s) a chunk belongs to
   */
  private findSectionInfo(
    chunkText: string,
    boundaries: Array<{ start: number; end: number; sectionIndex: number }>,
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>
  ): { sectionPath: string[]; metadata: Record<string, unknown> } {
    // Find the primary section (where most of the chunk content comes from)
    const maxOverlap = 0
    let primarySectionIndex = 0

    boundaries.forEach((boundary, index) => {
      // Simple heuristic: check if chunk contains section start or end
      if (chunkText.includes(sections[boundary.sectionIndex].text.substring(0, 50))) {
        primarySectionIndex = boundary.sectionIndex
      }
    })

    // If no clear match, use the first section
    const primarySection = sections[primarySectionIndex]

    return {
      sectionPath: primarySection.path,
      metadata: {
        primary_section: primarySectionIndex,
        section_type: primarySection.metadata.type,
        ...primarySection.metadata
      }
    }
  }

  /**
   * Enhanced split by size that respects word boundaries
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

      // If we're not at the end, try to break at word boundary
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end)
        const lastNewline = text.lastIndexOf('\n', end)
        const lastPeriod = text.lastIndexOf('. ', end)

        // Prefer breaking at sentence, then newline, then space
        const breakPoint = Math.max(lastPeriod + 1, lastNewline, lastSpace)

        // Only use break point if it's not too far back
        if (breakPoint > start && breakPoint > end - maxChunkSize * 0.2) {
          end = breakPoint
        }
      }

      const chunk = text.substring(start, end).trim()
      if (chunk.length > 0) {
        chunks.push(chunk)
      }

      // Move start position with overlap
      start = Math.max(end - overlap, end >= text.length ? text.length : end + 1)

      // Prevent infinite loop
      if (start >= text.length) break
    }

    return chunks
  }

  /**
   * Post-process chunks for fixed-size strategy
   */
  private postProcessChunks(chunks: DocumentChunk[], policy: ChunkingPolicy): DocumentChunk[] {
    let processed = [...chunks]

    // Remove chunks that are too small (unless they're the only chunk)
    if (policy.minChunkSize && processed.length > 1) {
      processed = processed.filter(chunk => this.validateChunk(chunk, policy))
    }

    // If we lost too many chunks, relax the minimum size requirement
    if (processed.length === 0 && chunks.length > 0) {
      processed = [chunks[0]] // Keep at least the first chunk
    }

    // Re-index chunks
    processed.forEach((chunk, index) => {
      chunk.chunkIndex = index
      chunk.chunkId = `${chunk.documentId}-chunk-${index}`
    })

    return processed
  }

  /**
   * Get chunking statistics for fixed-size strategy
   */
  getChunkingStats(chunks: DocumentChunk[]): {
    strategy: 'fixed_size'
    avgChunkSize: number
    sizeVariance: number
    overlapUtilization: number
  } {
    if (chunks.length === 0) {
      return {
        strategy: 'fixed_size',
        avgChunkSize: 0,
        sizeVariance: 0,
        overlapUtilization: 0
      }
    }

    const sizes = chunks.map(chunk => chunk.text.length)
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length

    // Calculate overlap utilization (how much overlap is actually used)
    let overlapUtilization = 0
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1].text
      const currChunk = chunks[i].text
      
      // Simple overlap detection (would be more sophisticated in production)
      const overlapSize = this.calculateOverlap(prevChunk, currChunk)
      overlapUtilization += overlapSize
    }
    
    overlapUtilization = overlapUtilization / (chunks.length - 1) || 0

    return {
      strategy: 'fixed_size',
      avgChunkSize,
      sizeVariance: Math.sqrt(variance),
      overlapUtilization
    }
  }

  /**
   * Calculate overlap between two chunks
   */
  private calculateOverlap(chunk1: string, chunk2: string): number {
    const minLength = Math.min(chunk1.length, chunk2.length)
    let overlap = 0

    // Check for overlap at the end of chunk1 and beginning of chunk2
    for (let i = 1; i <= minLength; i++) {
      const end1 = chunk1.substring(chunk1.length - i)
      const start2 = chunk2.substring(0, i)
      
      if (end1 === start2) {
        overlap = i
      } else {
        break
      }
    }

    return overlap
  }

  /**
   * Validate that fixed-size chunking meets requirements
   */
  validateChunkingResult(chunks: DocumentChunk[], policy: ChunkingPolicy): {
    isValid: boolean
    issues: string[]
  } {
    const issues: string[] = []

    // Check chunk sizes
    chunks.forEach((chunk, index) => {
      if (chunk.text.length > policy.maxChunkSize) {
        issues.push(`Chunk ${index} exceeds maximum size: ${chunk.text.length} > ${policy.maxChunkSize}`)
      }

      if (policy.minChunkSize && chunk.text.length < policy.minChunkSize) {
        issues.push(`Chunk ${index} below minimum size: ${chunk.text.length} < ${policy.minChunkSize}`)
      }
    })

    // Check overlap
    if (policy.chunkOverlap > 0) {
      let totalOverlap = 0
      for (let i = 1; i < chunks.length; i++) {
        const overlap = this.calculateOverlap(chunks[i - 1].text, chunks[i].text)
        totalOverlap += overlap
      }
      
      const avgOverlap = totalOverlap / (chunks.length - 1) || 0
      if (avgOverlap < policy.chunkOverlap * 0.5) {
        issues.push(`Average overlap ${avgOverlap} is much less than requested ${policy.chunkOverlap}`)
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    }
  }
}
