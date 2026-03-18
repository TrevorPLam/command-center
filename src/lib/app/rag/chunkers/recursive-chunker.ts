/**
 * Recursive Chunker
 * 
 * Chunks documents recursively using a hierarchy of separators.
 * Good for structured documents like markdown and code.
 */

import { BaseChunker } from './chunker-base'
import { DocumentChunk, ChunkingPolicy, DocumentContentType } from '../types'

export class RecursiveChunker extends BaseChunker {
  private readonly defaultSeparators = [
    '\n\n\n', // Triple newlines (major sections)
    '\n\n',   // Double newlines (paragraphs)
    '\n',     // Single newlines (lines)
    '. ',     // Sentences
    ' ',      // Words
  ]

  getSupportedContentTypes(): DocumentContentType[] {
    return [
      'text/plain',
      'text/markdown',
      'text/html',
      'text/javascript',
      'text/typescript',
      'text/python',
      'text/java',
      'text/cpp',
      'text/csharp',
      'text/go',
      'text/rust'
    ]
  }

  async chunk(
    documentId: string,
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>,
    policy: ChunkingPolicy
  ): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = []
    let chunkIndex = 0

    // Get separators from policy or use defaults
    const separators = policy.separators || this.defaultSeparators

    for (const section of sections) {
      const sectionChunks = await this.chunkSectionRecursive(
        documentId,
        section,
        separators,
        policy,
        chunkIndex
      )
      allChunks.push(...sectionChunks)
      chunkIndex += sectionChunks.length
    }

    // Apply post-processing
    const processedChunks = this.postProcessChunks(allChunks, policy)
    
    return processedChunks
  }

  /**
   * Chunk a section using recursive splitting
   */
  private async chunkSectionRecursive(
    documentId: string,
    section: { path: string[]; text: string; metadata: Record<string, unknown> },
    separators: string[],
    policy: ChunkingPolicy,
    startIndex: number
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []

    // Try each separator level recursively
    const result = await this.recursiveSplit(
      documentId,
      section.text,
      separators,
      0,
      policy,
      section.path,
      startIndex,
      section.metadata
    )

    chunks.push(...result)
    return chunks
  }

  /**
   * Recursive splitting algorithm
   */
  private async recursiveSplit(
    documentId: string,
    text: string,
    separators: string[],
    separatorIndex: number,
    policy: ChunkingPolicy,
    sectionPath: string[],
    startIndex: number,
    metadata: Record<string, unknown>
  ): Promise<DocumentChunk[]> {
    // Base case: text is small enough
    if (text.length <= policy.maxChunkSize) {
      return [this.createChunk(
        documentId,
        text,
        sectionPath,
        startIndex,
        {
          type: 'recursive',
          separator_level: separatorIndex,
          ...metadata
        }
      )]
    }

    // If we've exhausted all separators, fall back to size-based splitting
    if (separatorIndex >= separators.length) {
      return this.fallbackSizeSplit(documentId, text, policy, sectionPath, startIndex, metadata)
    }

    const separator = separators[separatorIndex]
    const splits = this.splitBySeparator(text, separator)

    // If separator doesn't split the text, try next separator
    if (splits.length === 1) {
      return this.recursiveSplit(
        documentId,
        text,
        separators,
        separatorIndex + 1,
        policy,
        sectionPath,
        startIndex,
        metadata
      )
    }

    const chunks: DocumentChunk[] = []
    let currentChunkText = ''
    let currentChunkIndex = startIndex

    for (let i = 0; i < splits.length; i++) {
      const splitText = splits[i]
      const potentialChunk = currentChunkText + (currentChunkText ? '\n\n' : '') + splitText

      // If adding this split would exceed max size and we have content, create chunk
      if (potentialChunk.length > policy.maxChunkSize && currentChunkText.length > 0) {
        chunks.push(this.createChunk(
          documentId,
          currentChunkText,
          sectionPath,
          currentChunkIndex++,
          {
            type: 'recursive',
            separator_level: separatorIndex,
            separator_used: separator,
            split_count: i,
            ...metadata
          }
        ))

        // Start new chunk with overlap
        currentChunkText = this.getOverlapText(currentChunkText, policy.chunkOverlap)
      }

      currentChunkText += (currentChunkText ? '\n\n' : '') + splitText
    }

    // Add remaining text
    if (currentChunkText.length > 0) {
      chunks.push(this.createChunk(
        documentId,
        currentChunkText,
        sectionPath,
        currentChunkIndex,
        {
          type: 'recursive',
          separator_level: separatorIndex,
          separator_used: separator,
          final_chunk: true,
          ...metadata
        }
      ))
    }

    // Recursively process chunks that are still too large
    const finalChunks: DocumentChunk[] = []
    for (const chunk of chunks) {
      if (chunk.text.length > policy.maxChunkSize) {
        // Try to split this chunk with more granular separators
        const subChunks = await this.recursiveSplit(
          documentId,
          chunk.text,
          separators,
          separatorIndex + 1,
          policy,
          chunk.sectionPath,
          chunk.chunkIndex,
          chunk.metadata
        )
        finalChunks.push(...subChunks)
      } else {
        finalChunks.push(chunk)
      }
    }

    return finalChunks
  }

  /**
   * Split text by a specific separator
   */
  private splitBySeparator(text: string, separator: string): string[] {
    if (separator === '. ') {
      // Special handling for sentences to avoid abbreviations
      return this.splitBySentences(text)
    }

    return text.split(separator).filter(part => part.trim().length > 0)
  }

  /**
   * Split text by sentences (more sophisticated than simple split)
   */
  private splitBySentences(text: string): string[] {
    const sentences: string[] = []
    let start = 0

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '.') {
        // Check if this is likely a sentence ending
        const nextChar = text[i + 1]
        const prevChar = i > 0 ? text[i - 1] : ''

        // Don't split after abbreviations
        if (nextChar === ' ' || nextChar === '\n' || nextChar === undefined) {
          // Check if it's not an abbreviation
          if (!this.isAbbreviation(text.substring(Math.max(0, i - 5), i))) {
            const sentence = text.substring(start, i + 1).trim()
            if (sentence.length > 0) {
              sentences.push(sentence)
              start = i + 1
            }
          }
        }
      }
    }

    // Add remaining text
    if (start < text.length) {
      const remaining = text.substring(start).trim()
      if (remaining.length > 0) {
        sentences.push(remaining)
      }
    }

    return sentences
  }

  /**
   * Check if a word is likely an abbreviation
   */
  private isAbbreviation(word: string): boolean {
    const abbreviations = new Set([
      'mr', 'mrs', 'dr', 'prof', 'sr', 'jr', 'st', 'ave', 'blvd', 'rd', 'ln',
      'etc', 'ie', 'eg', 'vs', 'cf', 'viz', 'ps', 'pt', 'am', 'pm',
      'no', 'num', 'vol', 'fig', 'tab', 'eq', 'ref', 'cit', 'al', 'et'
    ])

    return abbreviations.has(word.toLowerCase().replace('.', ''))
  }

  /**
   * Fallback to size-based splitting when recursive splitting fails
   */
  private fallbackSizeSplit(
    documentId: string,
    text: string,
    policy: ChunkingPolicy,
    sectionPath: string[],
    startIndex: number,
    metadata: Record<string, unknown>
  ): DocumentChunk[] {
    const sizeChunks = this.splitBySize(text, policy.maxChunkSize, policy.chunkOverlap)
    
    return sizeChunks.map((chunk, index) => 
      this.createChunk(
        documentId,
        chunk,
        sectionPath,
        startIndex + index,
        {
          type: 'recursive_fallback',
          fallback_reason: 'exhausted_separators',
          ...metadata
        }
      )
    )
  }

  /**
   * Get overlap text for next chunk
   */
  private getOverlapText(text: string, overlapSize: number): string {
    if (overlapSize === 0 || text.length === 0) {
      return ''
    }

    // Take from the end of the text
    const start = Math.max(0, text.length - overlapSize)
    return text.substring(start)
  }

  /**
   * Post-process recursive chunks
   */
  private postProcessChunks(chunks: DocumentChunk[], policy: ChunkingPolicy): DocumentChunk[] {
    let processed = [...chunks]

    // Remove chunks that are too small
    if (policy.minChunkSize && processed.length > 1) {
      processed = processed.filter(chunk => this.validateChunk(chunk, policy))
    }

    // Merge very small chunks with neighbors
    processed = this.mergeSmallChunks(processed, policy.minChunkSize || 50)

    // Re-index chunks
    processed.forEach((chunk, index) => {
      chunk.chunkIndex = index
      chunk.chunkId = `${chunk.documentId}-chunk-${index}`
    })

    return processed
  }

  /**
   * Analyze recursive chunking results
   */
  analyzeChunking(chunks: DocumentChunk[]): {
    strategy: 'recursive'
    separatorUsage: Record<string, number>
    avgRecursionDepth: number
    chunkSizeDistribution: Record<string, number>
  } {
    const separatorUsage: Record<string, number> = {}
    const chunkSizeDistribution: Record<string, number> = {
      small: 0,  // < 200 chars
      medium: 0, // 200-800 chars
      large: 0,  // > 800 chars
    }
    let totalRecursionDepth = 0

    chunks.forEach(chunk => {
      // Track separator usage
      const separator = chunk.metadata.separator_used as string
      if (separator) {
        separatorUsage[separator] = (separatorUsage[separator] || 0) + 1
      }

      // Track chunk size distribution
      const size = chunk.text.length
      if (size < 200) chunkSizeDistribution.small++
      else if (size <= 800) chunkSizeDistribution.medium++
      else chunkSizeDistribution.large++

      // Track recursion depth
      const depth = chunk.metadata.separator_level as number
      totalRecursionDepth += depth || 0
    })

    return {
      strategy: 'recursive',
      separatorUsage,
      avgRecursionDepth: chunks.length > 0 ? totalRecursionDepth / chunks.length : 0,
      chunkSizeDistribution
    }
  }

  /**
   * Get optimal separators for content type
   */
  getOptimalSeparators(contentType: DocumentContentType): string[] {
    const separatorMap: Record<DocumentContentType, string[]> = {
      'text/markdown': [
        '\n# ',      // Headers
        '\n## ',     // Subheaders
        '\n### ',    // Sub-subheaders
        '\n\n',      // Paragraphs
        '\n',        // Lines
        '. ',        // Sentences
      ],
      'text/html': [
        '\n<div',     // Div elements
        '\n<p',      // Paragraphs
        '\n<h',       // Headers
        '\n\n',      // Paragraph breaks
        '. ',        // Sentences
      ],
      'text/javascript': [
        '\nfunction ', // Functions
        '\nclass ',   // Classes
        '\nconst ',   // Constants
        '\nlet ',     // Variables
        '\n\n',       // Paragraphs
        ';',         // Statements
      ],
      'text/typescript': [
        '\nfunction ', // Functions
        '\nclass ',   // Classes
        '\nconst ',   // Constants
        '\nlet ',     // Variables
        '\n\n',       // Paragraphs
        ';',         // Statements
      ],
      'text/python': [
        '\ndef ',     // Functions
        '\nclass ',   // Classes
        '\nimport ',  // Imports
        '\n\n',       // Paragraphs
        '\n',         // Lines
      ],
      default: this.defaultSeparators
    }

    return separatorMap[contentType] || separatorMap.default
  }
}
