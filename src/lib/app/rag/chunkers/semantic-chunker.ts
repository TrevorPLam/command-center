/**
 * Semantic Chunker
 * 
 * Chunks documents based on semantic boundaries like paragraphs,
 * sections, and logical content breaks.
 */

import { BaseChunker } from './chunker-base'
import { DocumentChunk, ChunkingPolicy, DocumentContentType } from '../types'

export class SemanticChunker extends BaseChunker {
  getSupportedContentTypes(): DocumentContentType[] {
    return [
      'text/plain',
      'text/markdown',
      'text/html',
      'application/json',
      'text/javascript',
      'text/typescript',
      'text/python',
      'text/java',
      'text/cpp',
      'text/csharp',
      'text/go',
      'text/rust',
      'text/sql'
    ]
  }

  async chunk(
    documentId: string,
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>,
    policy: ChunkingPolicy
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []
    let chunkIndex = 0

    for (const section of sections) {
      const sectionChunks = await this.chunkSection(documentId, section, policy, chunkIndex)
      chunks.push(...sectionChunks)
      chunkIndex += sectionChunks.length
    }

    // Apply post-processing
    const processedChunks = this.postProcessChunks(chunks, policy)
    
    return processedChunks
  }

  /**
   * Chunk a single section
   */
  private async chunkSection(
    documentId: string,
    section: { path: string[]; text: string; metadata: Record<string, unknown> },
    policy: ChunkingPolicy,
    startIndex: number
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []

    // Determine chunking strategy based on section type
    const sectionType = section.metadata.type as string

    switch (sectionType) {
      case 'heading':
        // Keep headings as separate chunks or merge with following content
        chunks.push(this.createChunk(
          documentId,
          section.text,
          section.path,
          startIndex,
          { type: 'heading', ...section.metadata }
        ))
        break

      case 'code':
        // Handle code blocks specially
        chunks.push(...this.chunkCodeBlock(documentId, section, startIndex, policy))
        break

      case 'table':
        // Handle tables as single chunks
        chunks.push(this.createChunk(
          documentId,
          section.text,
          section.path,
          startIndex,
          { type: 'table', ...section.metadata }
        ))
        break

      case 'function':
      case 'method':
        // Keep functions/methods together
        chunks.push(this.createChunk(
          documentId,
          section.text,
          section.path,
          startIndex,
          { type: 'function', ...section.metadata }
        ))
        break

      case 'class':
        // Keep classes together
        chunks.push(this.createChunk(
          documentId,
          section.text,
          section.path,
          startIndex,
          { type: 'class', ...section.metadata }
        ))
        break

      default:
        // Use paragraph-based chunking for general content
        chunks.push(...this.chunkByParagraphs(documentId, section, startIndex, policy))
        break
    }

    return chunks
  }

  /**
   * Chunk code blocks
   */
  private chunkCodeBlock(
    documentId: string,
    section: { path: string[]; text: string; metadata: Record<string, unknown> },
    startIndex: number,
    policy: ChunkingPolicy
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const codeText = section.text

    // If code block is small enough, keep it as one chunk
    if (codeText.length <= policy.maxChunkSize) {
      chunks.push(this.createChunk(
        documentId,
        codeText,
        section.path,
        startIndex,
        { type: 'code_block', language: section.metadata.language, ...section.metadata }
      ))
      return chunks
    }

    // For large code blocks, try to split at logical boundaries
    const logicalChunks = this.splitCodeByLogicalBoundaries(codeText)
    
    logicalChunks.forEach((codeChunk, index) => {
      if (codeChunk.length <= policy.maxChunkSize) {
        chunks.push(this.createChunk(
          documentId,
          codeChunk,
          section.path,
          startIndex + index,
          {
            type: 'code_block',
            language: section.metadata.language,
            part_index: index + 1,
            total_parts: logicalChunks.length,
            ...section.metadata
          }
        ))
      } else {
        // If still too large, split by size
        const sizeChunks = this.splitBySize(codeChunk, policy.maxChunkSize, policy.chunkOverlap)
        sizeChunks.forEach((sizeChunk, sizeIndex) => {
          chunks.push(this.createChunk(
            documentId,
            sizeChunk,
            section.path,
            startIndex + index + sizeIndex,
            {
              type: 'code_block',
              language: section.metadata.language,
              part_index: sizeIndex + 1,
              total_parts: sizeChunks.length,
              ...section.metadata
            }
          ))
        })
      }
    })

    return chunks
  }

  /**
   * Split code by logical boundaries (functions, classes, etc.)
   */
  private splitCodeByLogicalBoundaries(code: string): string[] {
    const chunks: string[] = []
    const lines = code.split('\n')
    let currentChunk: string[] = []
    let currentIndent = 0

    for (const line of lines) {
      const trimmed = line.trim()
      const indent = line.length - line.trimStart().length

      // If we encounter a major structural element at top level, start new chunk
      if (indent === 0 && trimmed.length > 0 && this.isCodeStructureElement(trimmed)) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.join('\n'))
          currentChunk = []
        }
      }

      currentChunk.push(line)
      currentIndent = indent
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'))
    }

    return chunks.filter(chunk => chunk.trim().length > 0)
  }

  /**
   * Check if line is a code structure element
   */
  private isCodeStructureElement(line: string): boolean {
    const patterns = [
      /^(function|def|class|interface|struct|enum|type)\s+\w+/,
      /^(public|private|protected|static|async|export)\s+/,
      /^@\w+/, // Annotations
      /^\s*\w+\s*\([^)]*\)\s*[:{]/, // Function definitions
      /^(if|for|while|switch|try)\s*\(/,
      /^(case|default)\s+/,
      /^import\s+|^from\s+|^package\s+|^using\s+/
    ]

    return patterns.some(pattern => pattern.test(line))
  }

  /**
   * Chunk by paragraphs
   */
  private chunkByParagraphs(
    documentId: string,
    section: { path: string[]; text: string; metadata: Record<string, unknown> },
    startIndex: number,
    policy: ChunkingPolicy
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const paragraphs = this.splitIntoParagraphs(section.text)

    let currentParagraphs: string[] = []
    let currentLength = 0

    for (const paragraph of paragraphs) {
      const paragraphLength = paragraph.length

      // If adding this paragraph would exceed max size and we have content, create chunk
      if (currentLength + paragraphLength > policy.maxChunkSize && currentParagraphs.length > 0) {
        chunks.push(this.createChunk(
          documentId,
          currentParagraphs.join('\n\n'),
          section.path,
          startIndex + chunks.length,
          {
            type: 'paragraph_group',
            paragraph_count: currentParagraphs.length,
            ...section.metadata
          }
        ))

        // Start new chunk with overlap
        currentParagraphs = this.getOverlapParagraphs(currentParagraphs, policy.chunkOverlap)
        currentLength = currentParagraphs.join('\n\n').length
      }

      currentParagraphs.push(paragraph)
      currentLength += paragraphLength + 2 // Add 2 for '\n\n'
    }

    // Add remaining paragraphs
    if (currentParagraphs.length > 0) {
      chunks.push(this.createChunk(
        documentId,
        currentParagraphs.join('\n\n'),
        section.path,
        startIndex + chunks.length,
        {
          type: 'paragraph_group',
          paragraph_count: currentParagraphs.length,
          ...section.metadata
        }
      ))
    }

    return chunks
  }

  /**
   * Split text into paragraphs
   */
  private splitIntoParagraphs(text: string): string[] {
    return text
      .split(/\n\s*\n+/) // Split on double newlines with optional whitespace
      .filter(p => p.trim().length > 0)
      .map(p => p.trim())
  }

  /**
   * Get overlap paragraphs for next chunk
   */
  private getOverlapParagraphs(paragraphs: string[], overlapSize: number): string[] {
    if (overlapSize === 0 || paragraphs.length === 0) {
      return []
    }

    const overlapParagraphs: string[] = []
    let currentLength = 0

    // Start from the end and work backwards
    for (let i = paragraphs.length - 1; i >= 0; i--) {
      const paragraph = paragraphs[i]
      const newLength = currentLength + paragraph.length + 2

      if (newLength <= overlapSize) {
        overlapParagraphs.unshift(paragraph)
        currentLength = newLength
      } else {
        break
      }
    }

    return overlapParagraphs
  }

  /**
   * Post-process chunks to ensure quality
   */
  private postProcessChunks(chunks: DocumentChunk[], policy: ChunkingPolicy): DocumentChunk[] {
    let processed = [...chunks]

    // Remove chunks that are too small
    if (policy.minChunkSize) {
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
}
