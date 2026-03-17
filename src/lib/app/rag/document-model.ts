/**
 * Document Model and Normalization
 * 
 * Handles document normalization, metadata enrichment, and section/span mapping.
 * Converts raw parsed documents into the canonical NormalizedDocument format.
 */

import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'
import { 
  NormalizedDocument,
  DocumentSection,
  ParsedDocument,
  DocumentStructure,
  DocumentElement,
  DocumentContentType
} from './types'

export class DocumentNormalizer {
  /**
   * Convert a parsed document into a normalized document
   */
  static async normalize(
    sourcePath: string,
    contentType: DocumentContentType,
    parsed: ParsedDocument
  ): Promise<NormalizedDocument> {
    const id = uuidv4()
    const checksum = this.calculateChecksum(parsed.content)
    const size = Buffer.byteLength(parsed.content, 'utf8')
    
    // Extract sections from structure or create default sections
    const sections = this.extractSections(parsed)
    
    // Enrich metadata
    const metadata = this.enrichMetadata(sourcePath, contentType, parsed.metadata)
    
    // Extract title from content or metadata
    const title = this.extractTitle(parsed, metadata)

    return {
      id,
      sourcePath,
      contentType,
      title,
      sections,
      metadata,
      checksum,
      size,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  /**
   * Calculate SHA-256 checksum of document content
   */
  private static calculateChecksum(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex')
  }

  /**
   * Extract sections from parsed document structure
   */
  private static extractSections(parsed: ParsedDocument): DocumentSection[] {
    const sections: DocumentSection[] = []

    if (parsed.sections && parsed.sections.length > 0) {
      // Use pre-parsed sections
      return parsed.sections
    }

    if (parsed.structure) {
      // Extract from document structure
      this.extractSectionsFromStructure(parsed.structure, [], sections)
    } else {
      // Create single section from full content
      sections.push({
        path: ['root'],
        text: parsed.content,
        metadata: { type: 'full_content' }
      })
    }

    return sections
  }

  /**
   * Recursively extract sections from document structure
   */
  private static extractSectionsFromStructure(
    structure: DocumentStructure,
    currentPath: string[],
    sections: DocumentSection[]
  ): void {
    for (const element of structure.elements) {
      const elementPath = [...currentPath, element.type]
      
      if (element.type === 'heading' && element.level) {
        // Create section for heading
        const sectionPath = [...currentPath, `h${element.level}`, element.content.slice(0, 50)]
        sections.push({
          path: sectionPath,
          text: element.content,
          metadata: {
            type: 'heading',
            level: element.level,
            element_type: element.type
          },
          level: element.level,
          title: element.content
        })
      } else if (element.type === 'paragraph' || element.type === 'code') {
        // Add to current section or create new one
        const lastSection = sections[sections.length - 1]
        if (lastSection && lastSection.metadata.type !== 'code') {
          lastSection.text += '\n\n' + element.content
        } else {
          sections.push({
            path: elementPath,
            text: element.content,
            metadata: {
              type: element.type,
              element_type: element.type,
              language: element.language
            }
          })
        }
      }
    }
  }

  /**
   * Enrich document metadata with extracted information
   */
  private static enrichMetadata(
    sourcePath: string,
    contentType: DocumentContentType,
    existingMetadata: Record<string, unknown>
  ): Record<string, unknown> {
    const enriched = { ...existingMetadata }

    // File system metadata
    const pathInfo = this.extractPathInfo(sourcePath)
    Object.assign(enriched, pathInfo)

    // Content type specific metadata
    Object.assign(enriched, this.extractContentTypeMetadata(contentType))

    // Content statistics
    const stats = this.extractContentStats(enriched.content as string)
    Object.assign(enriched, stats)

    // Language detection (basic)
    const language = this.detectLanguage(enriched.content as string, sourcePath)
    if (language) {
      enriched.detected_language = language
    }

    return enriched
  }

  /**
   * Extract path information from source path
   */
  private static extractPathInfo(sourcePath: string): Record<string, unknown> {
    const pathParts = sourcePath.split(/[/\\]/)
    const filename = pathParts[pathParts.length - 1]
    const extension = filename.includes('.') ? filename.split('.').pop() : ''
    
    return {
      filename,
      extension,
      directory: pathParts.slice(0, -1).join('/'),
      basename: filename.includes('.') ? filename.split('.').slice(0, -1).join('.') : filename
    }
  }

  /**
   * Extract content type specific metadata
   */
  private static extractContentTypeMetadata(contentType: DocumentContentType): Record<string, unknown> {
    switch (contentType) {
      case 'text/markdown':
        return { document_type: 'markdown', supports_headings: true }
      case 'text/html':
        return { document_type: 'html', supports_headings: true }
      case 'application/pdf':
        return { document_type: 'pdf', binary_format: true }
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return { document_type: 'docx', binary_format: true }
      case 'text/csv':
        return { document_type: 'csv', structured_data: true }
      case 'application/json':
        return { document_type: 'json', structured_data: true }
      case 'text/javascript':
      case 'text/typescript':
      case 'text/python':
      case 'text/java':
      case 'text/cpp':
      case 'text/csharp':
      case 'text/go':
      case 'text/rust':
      case 'text/sql':
        return { document_type: 'code', programming_language: contentType.split('/')[1] }
      default:
        return { document_type: 'plain_text' }
    }
  }

  /**
   * Extract content statistics
   */
  private static extractContentStats(content: string): Record<string, unknown> {
    if (!content) return {}

    const words = content.split(/\s+/).filter(word => word.length > 0)
    const lines = content.split('\n')
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0)

    return {
      char_count: content.length,
      word_count: words.length,
      line_count: lines.length,
      sentence_count: sentences.length,
      paragraph_count: paragraphs.length,
      avg_words_per_sentence: sentences.length > 0 ? words.length / sentences.length : 0,
      avg_words_per_paragraph: paragraphs.length > 0 ? words.length / paragraphs.length : 0
    }
  }

  /**
   * Basic language detection
   */
  private static detectLanguage(content: string, sourcePath: string): string | null {
    // Check file extension first
    const ext = sourcePath.split('.').pop()?.toLowerCase()
    const extensionMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'sql': 'sql',
      'md': 'markdown',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml'
    }

    if (ext && extensionMap[ext]) {
      return extensionMap[ext]
    }

    // Basic content-based detection for code
    if (content.includes('def ') && content.includes(':')) return 'python'
    if (content.includes('function ') && content.includes('{')) return 'javascript'
    if (content.includes('public class ') && content.includes('{')) return 'java'
    if (content.includes('package ') && content.includes('import ')) return 'java'
    if (content.includes('#include') && content.includes('int main')) return 'cpp'
    if (content.includes('using ') && content.includes('namespace')) return 'csharp'
    if (content.includes('package ') && content.includes('func ')) return 'go'
    if (content.includes('fn ') && content.includes('->')) return 'rust'
    if (content.includes('SELECT ') || content.includes('FROM ')) return 'sql'

    return null
  }

  /**
   * Extract title from document content or metadata
   */
  private static extractTitle(parsed: ParsedDocument, metadata: Record<string, unknown>): string | undefined {
    // Check explicit title in metadata
    if (metadata.title && typeof metadata.title === 'string') {
      return metadata.title
    }

    // Extract from filename
    if (metadata.filename && typeof metadata.filename === 'string') {
      const filename = metadata.filename as string
      const basename = filename.includes('.') ? filename.split('.').slice(0, -1).join('.') : filename
      if (basename && basename !== filename) {
        return basename.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      }
    }

    // Extract from first heading for structured documents
    if (parsed.sections) {
      const firstHeading = parsed.sections.find(section => 
        section.metadata.type === 'heading' || section.title
      )
      if (firstHeading?.title) {
        return firstHeading.title
      }
    }

    // Extract from first line of content (if it looks like a title)
    const firstLine = parsed.content.split('\n')[0]?.trim()
    if (firstLine && firstLine.length < 100 && !firstLine.includes(' ')) {
      return firstLine
    }

    return undefined
  }
}

/**
 * Document metadata enrichment service
 */
export class MetadataEnricher {
  /**
   * Add additional metadata to normalized document
   */
  static enrich(document: NormalizedDocument): NormalizedDocument {
    const enriched = { ...document }
    
    // Add processing metadata
    enriched.metadata = {
      ...document.metadata,
      processed_at: new Date().toISOString(),
      processor_version: '1.0.0',
      section_count: document.sections.length,
      total_section_chars: document.sections.reduce((sum, section) => sum + section.text.length, 0)
    }

    // Add section-specific metadata
    enriched.sections = document.sections.map((section, index) => ({
      ...section,
      metadata: {
        ...section.metadata,
        section_index: index,
        char_count: section.text.length,
        word_count: section.text.split(/\s+/).filter(w => w.length > 0).length
      }
    }))

    return enriched
  }

  /**
   * Add search-friendly metadata
   */
  static addSearchMetadata(document: NormalizedDocument): NormalizedDocument {
    const enriched = { ...document }
    
    // Create searchable text snippets
    const snippets = document.sections
      .filter(section => section.text.length > 50)
      .slice(0, 5)
      .map(section => section.text.slice(0, 200) + (section.text.length > 200 ? '...' : ''))

    enriched.metadata = {
      ...document.metadata,
      search_snippets: snippets,
      keywords: this.extractKeywords(document),
      tags: this.generateTags(document)
    }

    return enriched
  }

  /**
   * Extract keywords from document
   */
  private static extractKeywords(document: NormalizedDocument): string[] {
    const text = document.sections.map(s => s.text).join(' ').toLowerCase()
    
    // Simple keyword extraction (would use NLP library in production)
    const words = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))
    
    // Count frequency and return top keywords
    const frequency: Record<string, number> = {}
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1
    })

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word)
  }

  /**
   * Generate tags for document
   */
  private static generateTags(document: NormalizedDocument): string[] {
    const tags: string[] = []
    
    // Content type tags
    tags.push(document.contentType.split('/')[1] || 'text')
    
    // Language tags
    if (document.metadata.detected_language) {
      tags.push(document.metadata.detected_language as string)
    }
    
    // Size tags
    if (document.size > 1000000) tags.push('large')
    else if (document.size > 10000) tags.push('medium')
    else tags.push('small')
    
    // Structure tags
    if (document.sections.some(s => s.metadata.type === 'heading')) {
      tags.push('structured')
    }
    
    return tags
  }

  /**
   * Simple stop word detection
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
      'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
      'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
      'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all',
      'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
      'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make',
      'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
      'people', 'into', 'year', 'your', 'good', 'some', 'could',
      'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only',
      'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use',
      'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
      'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most',
      'is', 'was', 'are', 'been', 'has', 'had', 'were', 'said', 'did',
      'having', 'may', 'am'
    ])
    
    return stopWords.has(word)
  }
}
