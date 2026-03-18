/**
 * PDF Document Parser
 * 
 * Parses PDF documents and extracts text content with structure preservation.
 * Uses pdf-parse library for text extraction and analyzes document structure.
 */

import { ParsedDocument, DocumentSection, DocumentStructure, DocumentElement } from '../types'

export class PdfParser {
  /**
   * Parse PDF content and extract structured information
   */
  async parse(buffer: Buffer | ArrayBuffer): Promise<ParsedDocument> {
    try {
      // Dynamic import to avoid SSR issues
      const pdfParse = (await import('pdf-parse')).default
      
      const pdfData = await pdfParse(buffer)
      
      // Extract text content
      const content = pdfData.text
      
      // Analyze PDF structure
      const structure = this.analyzePdfStructure(pdfData)
      
      // Create sections based on structure
      const sections = this.createPdfSections(pdfData, structure)
      
      // Extract metadata
      const metadata = this.extractPdfMetadata(pdfData)
      
      return {
        content,
        metadata: {
          type: 'pdf',
          page_count: pdfData.numpages,
          info: pdfData.info,
          metadata: pdfData.metadata,
          ...metadata
        },
        sections,
        structure
      }
      
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Analyze PDF document structure
   */
  private analyzePdfStructure(pdfData: any): DocumentStructure {
    const elements: DocumentElement[] = []
    const text = pdfData.text
    
    // Extract headings (lines that look like titles)
    const lines = text.split('\n')
    let currentSection = ''
    
    lines.forEach((line: string, index: number) => {
      const trimmed = line.trim()
      
      if (!trimmed) return
      
      // Check if line looks like a heading
      if (this.isHeading(trimmed)) {
        if (currentSection) {
          // Add previous section as paragraph
          elements.push({
            type: 'paragraph',
            content: currentSection.trim(),
            metadata: { line_start: index - currentSection.split('\n').length }
          })
        }
        
        elements.push({
          type: 'heading',
          content: trimmed,
          level: this.estimateHeadingLevel(trimmed),
          metadata: { line_number: index }
        })
        
        currentSection = ''
      } else {
        currentSection += line + '\n'
      }
    })
    
    // Add final section
    if (currentSection.trim()) {
      elements.push({
        type: 'paragraph',
        content: currentSection.trim(),
        metadata: {}
      })
    }
    
    return {
      type: 'hierarchical',
      elements
    }
  }

  /**
   * Create sections from PDF structure
   */
  private createPdfSections(pdfData: any, structure: DocumentStructure): DocumentSection[] {
    const sections: DocumentSection[] = []
    const text = pdfData.text
    
    // Split by pages if page info is available
    if (pdfData.numpages > 1) {
      // Simple page-based splitting (in a real implementation, 
      // you'd use page-by-page parsing)
      const pageLength = Math.ceil(text.length / pdfData.numpages)
      
      for (let i = 0; i < pdfData.numpages; i++) {
        const start = i * pageLength
        const end = Math.min(start + pageLength, text.length)
        const pageText = text.slice(start, end).trim()
        
        if (pageText) {
          sections.push({
            path: ['page', `page-${i + 1}`],
            text: pageText,
            metadata: {
              type: 'page',
              page_number: i + 1,
              char_count: pageText.length
            }
          })
        }
      }
    } else {
      // Single page - create sections based on structure
      let currentSection: { text: string; path: string[]; level?: number } | null = null
      
      structure.elements.forEach(element => {
        if (element.type === 'heading') {
          // Save previous section
          if (currentSection && currentSection.text.trim()) {
            sections.push({
              path: currentSection.path,
              text: currentSection.text.trim(),
              metadata: {
                type: 'section',
                level: currentSection.level,
                char_count: currentSection.text.length
              },
              level: currentSection.level,
              title: currentSection.path[currentSection.path.length - 1]
            })
          }
          
          // Start new section
          const headingText = element.content.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 50)
          currentSection = {
            text: '',
            path: ['section', `h${element.level || 1}`, headingText],
            level: element.level
          }
        } else if (element.type === 'paragraph' && currentSection) {
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
            char_count: currentSection.text.length
          },
          level: currentSection.level,
          title: currentSection.path[currentSection.path.length - 1]
        })
      }
    }
    
    // If no sections were created, create a default section
    if (sections.length === 0) {
      sections.push({
        path: ['content'],
        text: text,
        metadata: {
          type: 'content',
          char_count: text.length
        }
      })
    }
    
    return sections
  }

  /**
   * Extract PDF metadata
   */
  private extractPdfMetadata(pdfData: any): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      page_count: pdfData.numpages,
      text_length: pdfData.text.length,
      has_info: !!pdfData.info,
      has_metadata: !!pdfData.metadata
    }
    
    // Extract PDF info if available
    if (pdfData.info) {
      Object.assign(metadata, {
        title: pdfData.info.Title,
        author: pdfData.info.Author,
        subject: pdfData.info.Subject,
        creator: pdfData.info.Creator,
        producer: pdfData.info.Producer,
        creation_date: pdfData.info.CreationDate,
        modification_date: pdfData.info.ModDate
      })
    }
    
    // Analyze content statistics
    const text = pdfData.text
    const words = text.split(/\s+/).filter(word => word.length > 0)
    const lines = text.split('\n')
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)
    
    Object.assign(metadata, {
      word_count: words.length,
      line_count: lines.length,
      paragraph_count: paragraphs.length,
      avg_words_per_paragraph: paragraphs.length > 0 ? words.length / paragraphs.length : 0,
      avg_line_length: lines.length > 0 ? text.length / lines.length : 0
    })
    
    return metadata
  }

  /**
   * Check if a line looks like a heading
   */
  private isHeading(line: string): boolean {
    const trimmed = line.trim()
    
    // Skip very short or very long lines
    if (trimmed.length < 3 || trimmed.length > 100) return false
    
    // Check for common heading patterns
    const headingPatterns = [
      /^[A-Z][A-Z\s]+$/, // ALL CAPS
      /^[A-Z][a-z\s]+:$/, // Title case with colon
      /^\d+\.\s+[A-Z]/, // Numbered list (1. Title)
      /^[IVXLCDM]+\.\s+[A-Z]/, // Roman numeral
      /^[A-Z][a-z\s]+$/, // Title case
    ]
    
    return headingPatterns.some(pattern => pattern.test(trimmed))
  }

  /**
   * Estimate heading level based on formatting
   */
  private estimateHeadingLevel(line: string): number {
    const trimmed = line.trim()
    
    // ALL CAPS is usually level 1
    if (/^[A-Z\s]+$/.test(trimmed)) return 1
    
    // Numbered sections are usually level 2
    if (/^\d+\.\s+/.test(trimmed)) return 2
    
    // Roman numerals are usually level 2
    if (/^[IVXLCDM]+\.\s+/.test(trimmed)) return 2
    
    // Title case with colon is usually level 2
    if (trimmed.endsWith(':')) return 2
    
    // Default to level 3
    return 3
  }
}
