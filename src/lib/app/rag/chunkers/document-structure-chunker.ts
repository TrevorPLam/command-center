/**
 * Document Structure Chunker
 * 
 * Chunks documents based on their inherent document structure.
 * Preserves logical boundaries like headings, code blocks, lists, etc.
 */

import { BaseChunker } from './chunker-base'
import { DocumentChunk, ChunkingPolicy, DocumentContentType, DocumentElement } from '../types'

export class DocumentStructureChunker extends BaseChunker {
  getSupportedContentTypes(): DocumentContentType[] {
    return [
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
      'text/rust'
    ]
  }

  async chunk(
    documentId: string,
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>,
    policy: ChunkingPolicy
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []
    let chunkIndex = 0

    // Group sections by their logical structure
    const structureGroups = this.groupByStructure(sections)

    for (const group of structureGroups) {
      const groupChunks = await this.chunkStructureGroup(documentId, group, policy, chunkIndex)
      chunks.push(...groupChunks)
      chunkIndex += groupChunks.length
    }

    // Apply post-processing
    const processedChunks = this.postProcessChunks(chunks, policy)
    
    return processedChunks
  }

  /**
   * Group sections by their logical structure
   */
  private groupByStructure(
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>
  ): StructureGroup[] {
    const groups: StructureGroup[] = []
    let currentGroup: StructureGroup | null = null

    for (const section of sections) {
      const sectionType = section.metadata.type as string
      const structureType = this.getStructureType(sectionType)

      // Determine if we should start a new group
      if (this.shouldStartNewGroup(currentGroup, structureType, section)) {
        if (currentGroup) {
          groups.push(currentGroup)
        }
        currentGroup = {
          type: structureType,
          sections: [section],
          metadata: {
            group_type: structureType,
            start_path: section.path
          }
        }
      } else if (currentGroup) {
        currentGroup.sections.push(section)
      } else {
        // First section
        currentGroup = {
          type: structureType,
          sections: [section],
          metadata: {
            group_type: structureType,
            start_path: section.path
          }
        }
      }
    }

    if (currentGroup) {
      groups.push(currentGroup)
    }

    return groups
  }

  /**
   * Get structure type for a section
   */
  private getStructureType(sectionType: string): StructureType {
    const typeMap: Record<string, StructureType> = {
      'heading': 'heading_group',
      'paragraph': 'content_group',
      'code': 'code_group',
      'function': 'code_group',
      'method': 'code_group',
      'class': 'code_group',
      'list': 'list_group',
      'table': 'table_group',
      'blockquote': 'content_group',
      'property': 'data_group',
      'array_item': 'data_group'
    }

    return typeMap[sectionType] || 'content_group'
  }

  /**
   * Determine if we should start a new group
   */
  private shouldStartNewGroup(
    currentGroup: StructureGroup | null,
    structureType: StructureType,
    section: { path: string[]; text: string; metadata: Record<string, unknown> }
  ): boolean {
    if (!currentGroup) return true

    // Always start new group for headings
    if (structureType === 'heading_group') return true

    // Start new group if structure type changes
    if (currentGroup.type !== structureType) return true

    // Start new group for major code boundaries
    if (structureType === 'code_group' && section.metadata.type === 'class') return true

    // Start new group if path depth changes significantly
    const currentDepth = currentGroup.sections[0].path.length
    const newDepth = section.path.length
    if (Math.abs(currentDepth - newDepth) > 2) return true

    return false
  }

  /**
   * Chunk a structure group
   */
  private async chunkStructureGroup(
    documentId: string,
    group: StructureGroup,
    policy: ChunkingPolicy,
    startIndex: number
  ): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = []

    switch (group.type) {
      case 'heading_group':
        chunks.push(...this.chunkHeadingGroup(documentId, group, startIndex, policy))
        break

      case 'code_group':
        chunks.push(...this.chunkCodeGroup(documentId, group, startIndex, policy))
        break

      case 'list_group':
        chunks.push(...this.chunkListGroup(documentId, group, startIndex, policy))
        break

      case 'table_group':
        chunks.push(...this.chunkTableGroup(documentId, group, startIndex, policy))
        break

      case 'data_group':
        chunks.push(...this.chunkDataGroup(documentId, group, startIndex, policy))
        break

      case 'content_group':
      default:
        chunks.push(...this.chunkContentGroup(documentId, group, startIndex, policy))
        break
    }

    return chunks
  }

  /**
   * Chunk heading group (heading + following content)
   */
  private chunkHeadingGroup(
    documentId: string,
    group: StructureGroup,
    startIndex: number,
    policy: ChunkingPolicy
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    let currentContent = ''
    let currentPath: string[] = []
    let currentMetadata: Record<string, unknown> = {}

    for (const section of group.sections) {
      if (section.metadata.type === 'heading') {
        // Save previous content if exists
        if (currentContent.trim()) {
          chunks.push(this.createChunk(
            documentId,
            currentContent,
            currentPath,
            startIndex + chunks.length,
            currentMetadata
          ))
        }

        // Start new chunk with heading
        currentContent = section.text
        currentPath = section.path
        currentMetadata = {
          type: 'heading_group',
          heading_level: section.metadata.level,
          heading_title: section.metadata.title,
          ...group.metadata
        }
      } else {
        // Add content to current chunk
        currentContent += (currentContent ? '\n\n' : '') + section.text
      }
    }

    // Add final content
    if (currentContent.trim()) {
      chunks.push(this.createChunk(
        documentId,
        currentContent,
        currentPath,
        startIndex + chunks.length,
        currentMetadata
      ))
    }

    return chunks
  }

  /**
   * Chunk code group (functions, classes, etc.)
   */
  private chunkCodeGroup(
    documentId: string,
    group: StructureGroup,
    startIndex: number,
    policy: ChunkingPolicy
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []

    for (let i = 0; i < group.sections.length; i++) {
      const section = group.sections[i]
      const sectionType = section.metadata.type as string

      // Keep major code elements together
      if (['class', 'function', 'method', 'interface'].includes(sectionType)) {
        chunks.push(this.createChunk(
          documentId,
          section.text,
          section.path,
          startIndex + chunks.length,
          {
            type: 'code_element',
            element_type: sectionType,
            element_name: section.metadata.name,
            language: section.metadata.language,
            ...group.metadata
          }
        ))
      } else {
        // Handle smaller code elements
        const combinedText = this.combineRelatedCodeElements(group.sections, i)
        if (combinedText.text.length <= policy.maxChunkSize) {
          chunks.push(this.createChunk(
            documentId,
            combinedText.text,
            combinedText.path,
            startIndex + chunks.length,
            {
              type: 'code_related',
              related_count: combinedText.count,
              language: section.metadata.language,
              ...group.metadata
            }
          ))
          i += combinedText.count - 1 // Skip combined elements
        } else {
          chunks.push(this.createChunk(
            documentId,
            section.text,
            section.path,
            startIndex + chunks.length,
            {
              type: 'code_fragment',
              element_type: sectionType,
              language: section.metadata.language,
              ...group.metadata
            }
          ))
        }
      }
    }

    return chunks
  }

  /**
   * Combine related code elements
   */
  private combineRelatedCodeElements(
    sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>,
    startIndex: number
  ): { text: string; path: string[]; count: number } {
    const relatedSections = [sections[startIndex]]
    let i = startIndex + 1

    // Combine consecutive small code elements
    while (i < sections.length && relatedSections.length < 3) {
      const nextSection = sections[i]
      const nextType = nextSection.metadata.type as string

      // Only combine small, related elements
      if (nextSection.text.length < 200 && 
          ['variable', 'comment', 'import'].includes(nextType)) {
        relatedSections.push(nextSection)
        i++
      } else {
        break
      }
    }

    return {
      text: relatedSections.map(s => s.text).join('\n'),
      path: relatedSections[0].path,
      count: relatedSections.length
    }
  }

  /**
   * Chunk list group
   */
  private chunkListGroup(
    documentId: string,
    group: StructureGroup,
    startIndex: number,
    policy: ChunkingPolicy
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    const allListItems = group.sections.map(s => s.text).join('\n')

    // If entire list fits in one chunk, keep it together
    if (allListItems.length <= policy.maxChunkSize) {
      chunks.push(this.createChunk(
        documentId,
        allListItems,
        group.sections[0].path,
        startIndex,
        {
          type: 'list_group',
          item_count: group.sections.length,
          ...group.metadata
        }
      ))
    } else {
      // Split large lists into logical subgroups
      const subLists = this.splitList(allListItems, policy.maxChunkSize)
      subLists.forEach((subList, index) => {
        chunks.push(this.createChunk(
          documentId,
          subList,
          group.sections[0].path,
          startIndex + index,
          {
            type: 'list_subgroup',
            subgroup_index: index + 1,
            total_subgroups: subLists.length,
            ...group.metadata
          }
        ))
      })
    }

    return chunks
  }

  /**
   * Split large list into sublists
   */
  private splitList(listText: string, maxSize: number): string[] {
    const items = listText.split('\n').filter(item => item.trim().length > 0)
    const subLists: string[] = []
    let currentSubList: string[] = []
    let currentLength = 0

    for (const item of items) {
      const itemLength = item.length
      if (currentLength + itemLength + 1 > maxSize && currentSubList.length > 0) {
        subLists.push(currentSubList.join('\n'))
        currentSubList = [item]
        currentLength = itemLength
      } else {
        currentSubList.push(item)
        currentLength += itemLength + 1
      }
    }

    if (currentSubList.length > 0) {
      subLists.push(currentSubList.join('\n'))
    }

    return subLists
  }

  /**
   * Chunk table group
   */
  private chunkTableGroup(
    documentId: string,
    group: StructureGroup,
    startIndex: number,
    policy: ChunkingPolicy
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []

    for (const section of group.sections) {
      chunks.push(this.createChunk(
        documentId,
        section.text,
        section.path,
        startIndex + chunks.length,
        {
          type: 'table_group',
          ...section.metadata,
          ...group.metadata
        }
      ))
    }

    return chunks
  }

  /**
   * Chunk data group (JSON properties, etc.)
   */
  private chunkDataGroup(
    documentId: string,
    group: StructureGroup,
    startIndex: number,
    policy: ChunkingPolicy
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    let currentData = ''
    let currentPath: string[] = []
    let currentCount = 0

    for (const section of group.sections) {
      const potentialData = currentData + (currentData ? '\n' : '') + section.text

      if (potentialData.length <= policy.maxChunkSize) {
        currentData = potentialData
        currentPath = section.path
        currentCount++
      } else {
        // Save current data and start new chunk
        if (currentData.trim()) {
          chunks.push(this.createChunk(
            documentId,
            currentData,
            currentPath,
            startIndex + chunks.length,
            {
              type: 'data_group',
              property_count: currentCount,
              ...group.metadata
            }
          ))
        }

        currentData = section.text
        currentPath = section.path
        currentCount = 1
      }
    }

    // Add remaining data
    if (currentData.trim()) {
      chunks.push(this.createChunk(
        documentId,
        currentData,
        currentPath,
        startIndex + chunks.length,
        {
          type: 'data_group',
          property_count: currentCount,
          ...group.metadata
        }
      ))
    }

    return chunks
  }

  /**
   * Chunk content group (paragraphs, etc.)
   */
  private chunkContentGroup(
    documentId: string,
    group: StructureGroup,
    startIndex: number,
    policy: ChunkingPolicy
  ): DocumentChunk[] {
    const chunks: DocumentChunk[] = []
    let currentContent = ''
    let currentPath: string[] = []
    let currentCount = 0

    for (const section of group.sections) {
      const potentialContent = currentContent + (currentContent ? '\n\n' : '') + section.text

      if (potentialContent.length <= policy.maxChunkSize) {
        currentContent = potentialContent
        currentPath = section.path
        currentCount++
      } else {
        // Save current content and start new chunk
        if (currentContent.trim()) {
          chunks.push(this.createChunk(
            documentId,
            currentContent,
            currentPath,
            startIndex + chunks.length,
            {
              type: 'content_group',
              element_count: currentCount,
              ...group.metadata
            }
          ))
        }

        currentContent = section.text
        currentPath = section.path
        currentCount = 1
      }
    }

    // Add remaining content
    if (currentContent.trim()) {
      chunks.push(this.createChunk(
        documentId,
        currentContent,
        currentPath,
        startIndex + chunks.length,
        {
          type: 'content_group',
          element_count: currentCount,
          ...group.metadata
        }
      ))
    }

    return chunks
  }

  /**
   * Post-process structure chunks
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
   * Analyze structure chunking results
   */
  analyzeChunking(chunks: DocumentChunk[]): {
    strategy: 'document_structure'
    structureDistribution: Record<string, number>
    avgElementsPerChunk: number
    structurePreservation: number
  } {
    const structureDistribution: Record<string, number> = {}
    let totalElements = 0

    chunks.forEach(chunk => {
      const chunkType = chunk.metadata.type as string
      structureDistribution[chunkType] = (structureDistribution[chunkType] || 0) + 1
      
      const elementCount = chunk.metadata.element_count as number || 
                           chunk.metadata.property_count as number || 
                           chunk.metadata.item_count as number || 1
      totalElements += elementCount
    })

    return {
      strategy: 'document_structure',
      structureDistribution,
      avgElementsPerChunk: chunks.length > 0 ? totalElements / chunks.length : 0,
      structurePreservation: this.calculateStructurePreservation(chunks)
    }
  }

  /**
   * Calculate how well document structure was preserved
   */
  private calculateStructurePreservation(chunks: DocumentChunk[]): number {
    let preservedElements = 0
    let totalElements = 0

    chunks.forEach(chunk => {
      const chunkType = chunk.metadata.type as string
      
      // Elements that preserve structure well
      if (['heading_group', 'code_element', 'list_group', 'table_group'].includes(chunkType)) {
        preservedElements++
      }
      
      totalElements++
    })

    return totalElements > 0 ? preservedElements / totalElements : 0
  }
}

// Types for structure chunking
type StructureType = 
  | 'heading_group'
  | 'content_group'
  | 'code_group'
  | 'list_group'
  | 'table_group'
  | 'data_group'

interface StructureGroup {
  type: StructureType
  sections: Array<{ path: string[]; text: string; metadata: Record<string, unknown> }>
  metadata: Record<string, unknown>
}
