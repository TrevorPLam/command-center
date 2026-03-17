/**
 * Markdown Document Parser
 * 
 * Parses markdown documents and extracts structured content with headings,
 * code blocks, lists, and other markdown elements.
 */

import { ParsedDocument, DocumentStructure, DocumentElement, DocumentSection } from '../types'

export class MarkdownParser {
  /**
   * Parse markdown content into structured document
   */
  static async parse(content: string): Promise<ParsedDocument> {
    const lines = content.split('\n')
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []
    
    let currentSection: DocumentSection | null = null
    let currentCodeBlock: string[] = []
    let inCodeBlock = false
    let codeBlockLanguage = ''
    let codeBlockStartLine = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmedLine = line.trim()

      // Handle code blocks
      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          // End code block
          const codeContent = currentCodeBlock.join('\n')
          elements.push({
            type: 'code',
            content: codeContent,
            language: codeBlockLanguage || 'text',
            metadata: {
              start_line: codeBlockStartLine,
              end_line: i,
              language: codeBlockLanguage
            }
          })

          // Add to current section or create new one
          if (currentSection) {
            currentSection.text += '\n\n' + codeContent
          } else {
            currentSection = this.createSection(['code', `block-${i}`], codeContent, {
              type: 'code',
              language: codeBlockLanguage,
              line_range: [codeBlockStartLine, i]
            })
            sections.push(currentSection)
          }

          // Reset code block state
          inCodeBlock = false
          currentCodeBlock = []
          codeBlockLanguage = ''
        } else {
          // Start code block
          inCodeBlock = true
          codeBlockStartLine = i
          codeBlockLanguage = trimmedLine.slice(3).trim() || 'text'
        }
        continue
      }

      // If inside code block, just collect lines
      if (inCodeBlock) {
        currentCodeBlock.push(line)
        continue
      }

      // Handle headings
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
      if (headingMatch) {
        const level = headingMatch[1].length
        const title = headingMatch[2].trim()

        // Save previous section if it exists
        if (currentSection && currentSection.text.trim()) {
          sections.push(currentSection)
        }

        // Create new heading section
        const sectionPath = ['heading', `h${level}`, title]
        currentSection = this.createSection(sectionPath, title, {
          type: 'heading',
          level,
          title,
          line_number: i + 1
        })

        elements.push({
          type: 'heading',
          content: title,
          level,
          metadata: {
            line_number: i + 1,
            title
          }
        })
        continue
      }

      // Handle lists
      if (this.isListItem(trimmedLine)) {
        const listContent = this.parseListItem(trimmedLine)
        
        elements.push({
          type: 'list',
          content: listContent,
          metadata: {
            line_number: i + 1,
            indent: line.length - line.trimStart().length
          }
        })

        if (currentSection) {
          currentSection.text += '\n' + line
        } else {
          currentSection = this.createSection(['list', `item-${i}`], line, {
            type: 'list',
            line_number: i + 1
          })
          sections.push(currentSection)
        }
        continue
      }

      // Handle blockquotes
      if (trimmedLine.startsWith('>')) {
        const quoteContent = line.replace(/^>\s?/, '').trim()
        
        elements.push({
          type: 'paragraph',
          content: quoteContent,
          metadata: {
            line_number: i + 1,
            blockquote: true
          }
        })

        if (currentSection) {
          currentSection.text += '\n' + quoteContent
        } else {
          currentSection = this.createSection(['blockquote', `block-${i}`], quoteContent, {
            type: 'blockquote',
            line_number: i + 1
          })
          sections.push(currentSection)
        }
        continue
      }

      // Handle horizontal rules
      if (this.isHorizontalRule(trimmedLine)) {
        elements.push({
          type: 'other',
          content: line,
          metadata: {
            line_number: i + 1,
            element_type: 'horizontal_rule'
          }
        })
        continue
      }

      // Handle regular paragraphs
      if (trimmedLine.length > 0) {
        elements.push({
          type: 'paragraph',
          content: trimmedLine,
          metadata: {
            line_number: i + 1
          }
        })

        if (currentSection) {
          currentSection.text += (currentSection.text ? '\n' : '') + trimmedLine
        } else {
          currentSection = this.createSection(['paragraph', `p-${i}`], trimmedLine, {
            type: 'paragraph',
            line_number: i + 1
          })
          sections.push(currentSection)
        }
      } else if (currentSection && currentSection.text.trim()) {
        // Empty line ends current section
        sections.push(currentSection)
        currentSection = null
      }
    }

    // Add final section if it exists
    if (currentSection && currentSection.text.trim()) {
      sections.push(currentSection)
    }

    // Create document structure
    const structure: DocumentStructure = {
      type: 'hierarchical',
      elements
    }

    return {
      content,
      metadata: {
        sections_count: sections.length,
        elements_count: elements.length,
        has_code_blocks: elements.some(e => e.type === 'code'),
        has_headings: elements.some(e => e.type === 'heading'),
        max_heading_level: Math.max(...elements
          .filter(e => e.type === 'heading')
          .map(e => e.level || 0))
      },
      sections,
      structure
    }
  }

  /**
   * Create a document section
   */
  private static createSection(
    path: string[],
    text: string,
    metadata: Record<string, unknown>
  ): DocumentSection {
    return {
      path,
      text,
      metadata
    }
  }

  /**
   * Check if line is a list item
   */
  private static isListItem(line: string): boolean {
    return /^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(line)
  }

  /**
   * Parse list item content
   */
  private static parseListItem(line: string): string {
    return line.replace(/^(\s*[-*+]\s+|\s*\d+\.\s+)/, '').trim()
  }

  /**
   * Check if line is a horizontal rule
   */
  private static isHorizontalRule(line: string): boolean {
    return /^(-{3,}|_{3,|\*{3,})$/.test(line)
  }

  /**
   * Extract front matter from markdown
   */
  static extractFrontMatter(content: string): { frontMatter: Record<string, any>; content: string } {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/
    const match = content.match(frontMatterRegex)
    
    if (!match) {
      return { frontMatter: {}, content }
    }

    try {
      // Simple YAML parsing (would use proper YAML parser in production)
      const frontMatterText = match[1]
      const frontMatter: Record<string, any> = {}
      
      frontMatterText.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
          const key = line.slice(0, colonIndex).trim()
          const value = line.slice(colonIndex + 1).trim()
          frontMatter[key] = value
        }
      })

      return {
        frontMatter,
        content: match[2]
      }
    } catch (error) {
      return { frontMatter: {}, content }
    }
  }

  /**
   * Extract table of contents from headings
   */
  static extractTableOfContents(sections: DocumentSection[]): Array<{
    level: number
    title: string
    path: string[]
    line_number?: number
  }> {
    return sections
      .filter(section => section.metadata.type === 'heading')
      .map(section => ({
        level: section.metadata.level as number || 1,
        title: section.metadata.title as string || section.text,
        path: section.path,
        line_number: section.metadata.line_number as number
      }))
  }

  /**
   * Get word count for markdown content
   */
  static getWordCount(content: string): number {
    // Remove code blocks to avoid counting code
    const withoutCodeBlocks = content.replace(/```[\s\S]*?```/g, '')
    
    // Remove markdown syntax
    const cleanText = withoutCodeBlocks
      .replace(/^#{1,6}\s+/gm, '') // Headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/^\s*[-*+]\s+/gm, '') // List markers
      .replace(/^\s*\d+\.\s+/gm, '') // Numbered list markers
      .replace(/^\s*>\s+/gm, '') // Blockquotes
      .replace(/\n{3,}/g, '\n') // Multiple newlines

    return cleanText.split(/\s+/).filter(word => word.length > 0).length
  }

  /**
   * Estimate reading time in minutes
   */
  static getReadingTime(content: string): number {
    const wordsPerMinute = 200
    const wordCount = this.getWordCount(content)
    return Math.ceil(wordCount / wordsPerMinute)
  }
}
