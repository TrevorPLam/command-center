/**
 * DOCX Document Parser
 * 
 * Parses Microsoft Word DOCX documents and extracts text content with structure preservation.
 * Uses xlsx library to extract content from DOCX files (which are ZIP archives).
 */

import { ParsedDocument, DocumentSection, DocumentStructure, DocumentElement } from '../types'

export class DocxParser {
  /**
   * Parse DOCX content and extract structured information
   */
  async parse(buffer: Buffer | ArrayBuffer): Promise<ParsedDocument> {
    try {
      // Dynamic import to avoid SSR issues
      const { utils: xlsxUtils, read: xlsxRead } = await import('xlsx')
      
      // DOCX files are ZIP archives - we need to extract the document.xml
      const content = await this.extractDocxContent(buffer)
      
      if (!content) {
        throw new Error('Could not extract content from DOCX file')
      }
      
      // Parse the XML content
      const parsedContent = this.parseDocxXml(content)
      
      // Analyze document structure
      const structure = this.analyzeDocxStructure(parsedContent)
      
      // Create sections based on structure
      const sections = this.createDocxSections(parsedContent, structure)
      
      // Extract metadata
      const metadata = this.extractDocxMetadata(parsedContent)
      
      return {
        content: parsedContent.text,
        metadata: {
          type: 'docx',
          ...metadata
        },
        sections,
        structure
      }
      
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract content from DOCX ZIP archive
   */
  private async extractDocxContent(buffer: Buffer | ArrayBuffer): Promise<string | null> {
    try {
      // In a browser environment, we'd use JSZip
      // For Node.js, we can use the built-in zlib or a streaming approach
      // For now, we'll implement a simplified version that works with common DOCX structures
      
      // This is a simplified implementation - in production, you'd use a proper
      // DOCX parsing library like 'docx-parser' or 'mammoth.js'
      const content = buffer.toString('utf8', 0, Math.min(buffer.byteLength, 1000000))
      
      // Look for XML content patterns
      const textMatch = content.match(/<w:t[^>]*>(.*?)<\/w:t>/gs)
      if (textMatch) {
        return textMatch.join('')
      }
      
      // Fallback: try to extract any readable text
      const readableText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      return readableText.length > 100 ? readableText : null
      
    } catch (error) {
      console.error('Failed to extract DOCX content:', error)
      return null
    }
  }

  /**
   * Parse DOCX XML content
   */
  private parseDocxXml(xmlContent: string): {
    text: string
    paragraphs: string[]
    headings: Array<{ text: string; level: number; index: number }>
    tables: Array<{ rows: number; cols: number; content: string }>
  } {
    // Extract text content
    const text = xmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    
    // Extract paragraphs
    const paragraphMatches = xmlContent.match(/<w:p[^>]*>.*?<\/w:p>/gs) || []
    const paragraphs = paragraphMatches.map(p => 
      p.replace(/<w:t[^>]*>(.*?)<\/w:t>/g, '$1').replace(/<[^>]*>/g, ' ').trim()
    ).filter(p => p.length > 0)
    
    // Extract headings (simplified - looks for styled text)
    const headings: Array<{ text: string; level: number; index: number }> = []
    paragraphs.forEach((para, index) => {
      // Simple heading detection - short, capitalized paragraphs
      if (para.length < 100 && para === para.toUpperCase()) {
        headings.push({ text: para, level: 1, index })
      } else if (para.length < 80 && /^[A-Z][a-z\s]+$/.test(para)) {
        headings.push({ text: para, level: 2, index })
      } else if (/^\d+\.\s+/.test(para)) {
        headings.push({ text: para, level: 2, index })
      }
    })
    
    // Extract tables (simplified)
    const tableMatches = xmlContent.match(/<w:tbl[^>]*>.*?<\/w:tbl>/gs) || []
    const tables = tableMatches.map(table => {
      const rowMatches = table.match(/<w:tr[^>]*>.*?<\/w:tr>/gs) || []
      const rows = rowMatches.length
      const cellMatches = table.match(/<w:tc[^>]*>.*?<\/w:tc>/gs) || []
      const cols = rows > 0 ? Math.ceil(cellMatches.length / rows) : 0
      const content = cellMatches.map(cell => 
        cell.replace(/<w:t[^>]*>(.*?)<\/w:t>/g, '$1').replace(/<[^>]*>/g, ' ').trim()
      ).join(' | ')
      
      return { rows, cols, content }
    })
    
    return {
      text,
      paragraphs,
      headings,
      tables
    }
  }

  /**
   * Analyze DOCX document structure
   */
  private analyzeDocxStructure(parsedContent: any): DocumentStructure {
    const elements: DocumentElement[] = []
    
    // Add headings
    parsedContent.headings.forEach((heading: any) => {
      elements.push({
        type: 'heading',
        content: heading.text,
        level: heading.level,
        metadata: { paragraph_index: heading.index }
      })
    })
    
    // Add paragraphs that aren't headings
    parsedContent.paragraphs.forEach((para: string, index: number) => {
      const isHeading = parsedContent.headings.some((h: any) => h.index === index)
      if (!isHeading && para.trim()) {
        elements.push({
          type: 'paragraph',
          content: para,
          metadata: { paragraph_index: index }
        })
      }
    })
    
    // Add tables
    parsedContent.tables.forEach((table: any, index: number) => {
      if (table.content.trim()) {
        elements.push({
          type: 'table',
          content: table.content,
          metadata: { 
            table_index: index,
            rows: table.rows,
            cols: table.cols
          }
        })
      }
    })
    
    return {
      type: 'hierarchical',
      elements
    }
  }

  /**
   * Create sections from DOCX structure
   */
  private createDocxSections(parsedContent: any, structure: DocumentStructure): DocumentSection[] {
    const sections: DocumentSection[] = []
    
    // Group content by headings
    let currentSection: { text: string; path: string[]; level?: number } | null = null
    
    structure.elements.forEach((element, index) => {
      if (element.type === 'heading') {
        // Save previous section
        if (currentSection && currentSection.text.trim()) {
          sections.push({
            path: currentSection.path,
            text: currentSection.text.trim(),
            metadata: {
              type: 'section',
              level: currentSection.level,
              char_count: currentSection.text.length,
              element_count: currentSection.text.split('\n').length
            },
            level: currentSection.level,
            title: element.content
          })
        }
        
        // Start new section
        const headingText = element.content.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 50)
        currentSection = {
          text: '',
          path: ['section', `h${element.level || 1}`, headingText],
          level: element.level
        }
      } else if ((element.type === 'paragraph' || element.type === 'table') && currentSection) {
        currentSection.text += element.content + '\n\n'
      }
    })
    
    // Add final section
    if (currentSection && currentSection.text.trim()) {
      sections.push({
        path: currentSection.path,
        text: currentSection.text.trim(),
        metadata: {
          type: 'section',
          level: currentSection.level,
          char_count: currentSection.text.length,
          element_count: currentSection.text.split('\n').length
        },
        level: currentSection.level
      })
    }
    
    // If no sections were created, create sections from paragraphs
    if (sections.length === 0 && parsedContent.paragraphs.length > 0) {
      // Group paragraphs into logical chunks
      const chunkSize = 5 // paragraphs per section
      for (let i = 0; i < parsedContent.paragraphs.length; i += chunkSize) {
        const chunk = parsedContent.paragraphs.slice(i, i + chunkSize)
        const sectionText = chunk.join('\n\n')
        
        sections.push({
          path: ['paragraphs', `chunk-${Math.floor(i / chunkSize) + 1}`],
          text: sectionText,
          metadata: {
            type: 'paragraph_chunk',
            paragraph_start: i,
            paragraph_end: Math.min(i + chunkSize, parsedContent.paragraphs.length),
            char_count: sectionText.length
          }
        })
      }
    }
    
    // If still no sections, create a default section
    if (sections.length === 0) {
      sections.push({
        path: ['content'],
        text: parsedContent.text,
        metadata: {
          type: 'content',
          char_count: parsedContent.text.length
        }
      })
    }
    
    return sections
  }

  /**
   * Extract DOCX metadata
   */
  private extractDocxMetadata(parsedContent: any): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      paragraph_count: parsedContent.paragraphs.length,
      heading_count: parsedContent.headings.length,
      table_count: parsedContent.tables.length,
      text_length: parsedContent.text.length
    }
    
    // Analyze content statistics
    const words = parsedContent.text.split(/\s+/).filter(word => word.length > 0)
    const sentences = parsedContent.text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    Object.assign(metadata, {
      word_count: words.length,
      sentence_count: sentences.length,
      avg_words_per_sentence: sentences.length > 0 ? words.length / sentences.length : 0,
      avg_paragraph_length: parsedContent.paragraphs.length > 0 ? 
        parsedContent.text.length / parsedContent.paragraphs.length : 0
    })
    
    // Table statistics
    if (parsedContent.tables.length > 0) {
      const totalCells = parsedContent.tables.reduce((sum: number, table: any) => 
        sum + (table.rows * table.cols), 0
      )
      Object.assign(metadata, {
        total_table_cells: totalCells,
        avg_table_rows: parsedContent.tables.reduce((sum: number, table: any) => 
          sum + table.rows, 0) / parsedContent.tables.length,
        avg_table_cols: parsedContent.tables.reduce((sum: number, table: any) => 
          sum + table.cols, 0) / parsedContent.tables.length
      })
    }
    
    // Heading analysis
    if (parsedContent.headings.length > 0) {
      const headingLevels = parsedContent.headings.map((h: any) => h.level)
      Object.assign(metadata, {
        heading_levels: [...new Set(headingLevels)],
        max_heading_level: Math.max(...headingLevels),
        min_heading_level: Math.min(...headingLevels)
      })
    }
    
    return metadata
  }
}
