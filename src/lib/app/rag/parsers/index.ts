/**
 * Parser Registry
 * 
 * Coordinates all document parsers and provides a unified interface
 * for parsing different document types.
 */

import { ParsedDocument, DocumentContentType } from '../types'
import { MarkdownParser } from './markdown-parser'
import { CodeParser } from './code-parser'
import { TextParser } from './text-parser'
import { CsvParser } from './csv-parser'
import { PdfParser } from './pdf-parser'
import { DocxParser } from './docx-parser'

export interface Parser {
  parse(content: string | Buffer | ArrayBuffer, language?: string): Promise<ParsedDocument>
}

export class ParserRegistry {
  private static parsers = new Map<DocumentContentType, Parser>()

  static {
    // Register parsers for different content types
    this.register('text/markdown', new MarkdownParser())
    this.register('text/plain', new TextParser())
    this.register('text/csv', new CsvParser())
    this.register('application/json', new JsonParser())
    this.register('text/html', new HtmlParser())
    this.register('application/pdf', new PdfParser())
    this.register('application/vnd.openxmlformats-officedocument.wordprocessingml.document', new DocxParser())
    
    // Register code parsers
    const codeTypes = [
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
    
    codeTypes.forEach(type => {
      this.register(type, new CodeParser())
    })
  }

  /**
   * Register a parser for a content type
   */
  static register(contentType: DocumentContentType, parser: Parser): void {
    this.parsers.set(contentType, parser)
  }

  /**
   * Get parser for content type
   */
  static getParser(contentType: DocumentContentType): Parser | null {
    return this.parsers.get(contentType) || null
  }

  /**
   * Parse document using appropriate parser
   */
  static async parse(
    content: string,
    contentType: DocumentContentType,
    language?: string
  ): Promise<ParsedDocument> {
    const parser = this.getParser(contentType)
    
    if (!parser) {
      // Fallback to text parser
      console.warn(`No parser found for content type: ${contentType}, falling back to text parser`)
      return new TextParser().parse(content)
    }

    try {
      return await parser.parse(content, language)
    } catch (error) {
      console.error(`Parser failed for content type ${contentType}:`, error)
      // Fallback to text parser on error
      return new TextParser().parse(content)
    }
  }

  /**
   * Get list of supported content types
   */
  static getSupportedContentTypes(): DocumentContentType[] {
    return Array.from(this.parsers.keys())
  }

  /**
   * Check if content type is supported
   */
  static isSupported(contentType: DocumentContentType): boolean {
    return this.parsers.has(contentType)
  }
}

/**
 * JSON Parser
 */
class JsonParser implements Parser {
  async parse(content: string): Promise<ParsedDocument> {
    try {
      const parsed = JSON.parse(content)
      
      // Extract structure from JSON
      const structure = this.analyzeJsonStructure(parsed)
      
      // Create sections for major JSON elements
      const sections = this.createJsonSections(parsed)
      
      return {
        content: JSON.stringify(parsed, null, 2),
        metadata: {
          type: 'json',
          ...structure,
          pretty_printed: true
        },
        sections,
        structure: {
          type: 'flat',
          elements: []
        }
      }
    } catch (error) {
      throw new Error(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private analyzeJsonStructure(obj: any, depth = 0): Record<string, unknown> {
    const analysis: Record<string, unknown> = {
      max_depth: depth,
      total_keys: 0,
      total_values: 0,
      data_types: {} as Record<string, number>
    }

    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        analysis.array_length = obj.length
        analysis.total_values = obj.length
        
        obj.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            const nested = this.analyzeJsonStructure(item, depth + 1)
            analysis.max_depth = Math.max(analysis.max_depth as number, nested.max_depth as number)
            analysis.total_keys = (analysis.total_keys as number) + (nested.total_keys as number)
            analysis.total_values = (analysis.total_values as number) + (nested.total_values as number)
          } else {
            const type = typeof item
            analysis.data_types[type] = ((analysis.data_types as Record<string, number>)[type] || 0) + 1
          }
        })
      } else {
        analysis.total_keys = Object.keys(obj).length
        
        Object.entries(obj).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            const nested = this.analyzeJsonStructure(value, depth + 1)
            analysis.max_depth = Math.max(analysis.max_depth as number, nested.max_depth as number)
            analysis.total_keys = (analysis.total_keys as number) + (nested.total_keys as number)
            analysis.total_values = (analysis.total_values as number) + (nested.total_values as number)
          } else {
            const type = typeof value
            analysis.data_types[type] = ((analysis.data_types as Record<string, number>)[type] || 0) + 1
            analysis.total_values = (analysis.total_values as number) + 1
          }
        })
      }
    } else {
      const type = typeof obj
      analysis.data_types[type] = 1
      analysis.total_values = 1
    }

    return analysis
  }

  private createJsonSections(obj: any, path: string[] = []): any[] {
    const sections = []

    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        sections.push({
          path: ['array', ...path],
          text: `Array with ${obj.length} items`,
          metadata: {
            type: 'array',
            length: obj.length,
            path
          }
        })

        // Add sections for first few array items
        obj.slice(0, 5).forEach((item, index) => {
          const itemPath = [...path, `item-${index}`]
          if (typeof item === 'object' && item !== null) {
            sections.push(...this.createJsonSections(item, itemPath))
          } else {
            sections.push({
              path: ['array_item', ...itemPath],
              text: String(item),
              metadata: {
                type: 'array_item',
                index,
                value_type: typeof item,
                path: itemPath
              }
            })
          }
        })
      } else {
        sections.push({
          path: ['object', ...path],
          text: `Object with ${Object.keys(obj).length} keys`,
          metadata: {
            type: 'object',
            key_count: Object.keys(obj).length,
            path
          }
        })

        Object.entries(obj).forEach(([key, value]) => {
          const keyPath = [...path, key]
          if (typeof value === 'object' && value !== null) {
            sections.push(...this.createJsonSections(value, keyPath))
          } else {
            sections.push({
              path: ['property', ...keyPath],
              text: `${key}: ${JSON.stringify(value)}`,
              metadata: {
                type: 'property',
                key,
                value_type: typeof value,
                path: keyPath
              }
            })
          }
        })
      }
    } else {
      sections.push({
        path: ['value', ...path],
        text: JSON.stringify(obj),
        metadata: {
          type: 'value',
          value_type: typeof obj,
          path
        }
      })
    }

    return sections
  }
}

/**
 * HTML Parser (basic implementation)
 */
class HtmlParser implements Parser {
  async parse(content: string): Promise<ParsedDocument> {
    // Extract text content from HTML
    const textContent = this.extractTextContent(content)
    
    // Extract metadata
    const metadata = this.extractHtmlMetadata(content)
    
    // Create sections based on HTML structure
    const sections = this.createHtmlSections(content)
    
    return {
      content: textContent,
      metadata: {
        type: 'html',
        original_length: content.length,
        text_length: textContent.length,
        ...metadata
      },
      sections,
      structure: {
        type: 'hierarchical',
        elements: []
      }
    }
  }

  private extractTextContent(html: string): string {
    // Remove script and style tags
    let content = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    
    // Remove HTML tags
    content = content.replace(/<[^>]*>/g, ' ')
    
    // Normalize whitespace
    content = content.replace(/\s+/g, ' ').trim()
    
    return content
  }

  private extractHtmlMetadata(html: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {}
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    if (titleMatch) {
      metadata.title = titleMatch[1].trim()
    }
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    if (descMatch) {
      metadata.description = descMatch[1].trim()
    }
    
    // Extract headings
    const headings = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi) || []
    metadata.heading_count = headings.length
    
    // Extract links
    const links = html.match(/<a[^>]*href=["']([^"']*)["'][^>]*>/gi) || []
    metadata.link_count = links.length
    
    // Extract images
    const images = html.match(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi) || []
    metadata.image_count = images.length
    
    return metadata
  }

  private createHtmlSections(html: string): any[] {
    const sections = []
    
    // Extract headings and following content
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>([\s\S]*?)(?=<h[1-6]|$)/gi
    let match
    
    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1])
      const title = match[2].replace(/<[^>]*>/g, '').trim()
      const content = this.extractTextContent(match[3])
      
      if (content.trim()) {
        sections.push({
          path: ['heading', `h${level}`, title],
          text: `${title}\n\n${content}`,
          metadata: {
            type: 'heading_section',
            level,
            title,
            content_length: content.length
          }
        })
      }
    }
    
    // If no headings found, create a single section with all content
    if (sections.length === 0) {
      const textContent = this.extractTextContent(html)
      if (textContent) {
        sections.push({
          path: ['content'],
          text: textContent,
          metadata: {
            type: 'content',
            length: textContent.length
          }
        })
      }
    }
    
    return sections
  }
}

// PDF and DOCX parsers are now imported as separate classes
