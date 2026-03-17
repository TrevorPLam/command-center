/**
 * Plain Text Document Parser
 * 
 * Parses plain text documents with basic structure detection,
 * paragraph separation, and content analysis.
 */

import { ParsedDocument, DocumentStructure, DocumentElement, DocumentSection } from '../types'

export class TextParser {
  /**
   * Parse plain text content
   */
  static async parse(content: string): Promise<ParsedDocument> {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []
    
    // Split content into paragraphs
    const paragraphs = this.splitIntoParagraphs(content)
    
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim().length > 0) {
        const sectionPath = ['paragraph', `p-${index}`]
        sections.push({
          path: sectionPath,
          text: paragraph.trim(),
          metadata: {
            type: 'paragraph',
            index,
            char_count: paragraph.length,
            word_count: this.countWords(paragraph)
          }
        })

        elements.push({
          type: 'paragraph',
          content: paragraph.trim(),
          metadata: {
            element_type: 'paragraph',
            index,
            char_count: paragraph.length,
            word_count: this.countWords(paragraph)
          }
        })
      }
    })

    // Detect potential structure (headings, lists, etc.)
    const structureAnalysis = this.analyzeStructure(content)
    
    // Create document structure
    const structure: DocumentStructure = {
      type: 'flat',
      elements
    }

    return {
      content,
      metadata: {
        ...structureAnalysis,
        paragraphs_count: sections.length,
        elements_count: elements.length
      },
      sections,
      structure
    }
  }

  /**
   * Split content into paragraphs
   */
  private static splitIntoParagraphs(content: string): string[] {
    // Split on double newlines or multiple consecutive newlines
    return content.split(/\n\s*\n+/).filter(p => p.trim().length > 0)
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length
  }

  /**
   * Analyze document structure
   */
  private static analyzeStructure(content: string): Record<string, unknown> {
    const lines = content.split('\n')
    const analysis: Record<string, unknown> = {
      line_count: lines.length,
      char_count: content.length,
      word_count: this.countWords(content),
      avg_line_length: lines.reduce((sum, line) => sum + line.length, 0) / lines.length,
      max_line_length: Math.max(...lines.map(line => line.length)),
      empty_lines: lines.filter(line => line.trim().length === 0).length
    }

    // Detect potential headings (all caps, underlined, etc.)
    const potentialHeadings = this.detectPotentialHeadings(lines)
    analysis.potential_headings = potentialHeadings
    analysis.heading_count = potentialHeadings.length

    // Detect lists
    const potentialLists = this.detectPotentialLists(lines)
    analysis.potential_lists = potentialLists
    analysis.list_count = potentialLists.length

    // Detect tables (simple tab-separated)
    const potentialTables = this.detectPotentialTables(content)
    analysis.potential_tables = potentialTables
    analysis.table_count = potentialTables.length

    return analysis
  }

  /**
   * Detect potential headings in text
   */
  private static detectPotentialHeadings(lines: string[]): Array<{
    line: number
    text: string
    type: string
  }> {
    const headings: Array<{ line: number; text: string; type: string }> = []

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      
      if (trimmed.length === 0) return

      // All caps (likely heading)
      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && /[A-Z]/.test(trimmed)) {
        headings.push({
          line: index + 1,
          text: trimmed,
          type: 'all_caps'
        })
      }

      // Underlined heading (next line is all dashes or equals)
      if (index < lines.length - 1) {
        const nextLine = lines[index + 1].trim()
        if ((nextLine.match(/^[-=]{3,}$/) || nextLine.match(/^\.{3,}$/)) && trimmed.length > 0) {
          headings.push({
            line: index + 1,
            text: trimmed,
            type: 'underlined'
          })
        }
      }

      // Numbered heading (1., 2., etc.)
      if (/^\d+\.\s+/.test(trimmed)) {
        headings.push({
          line: index + 1,
          text: trimmed,
          type: 'numbered'
        })
      }
    })

    return headings
  }

  /**
   * Detect potential lists in text
   */
  private static detectPotentialLists(lines: string[]): Array<{
    startLine: number
    type: string
    items: string[]
  }> {
    const lists: Array<{ startLine: number; type: string; items: string[] }> = []
    let currentList: { startLine: number; type: string; items: string[] } | null = null

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      
      if (trimmed.length === 0) {
        if (currentList && currentList.items.length > 0) {
          lists.push(currentList)
          currentList = null
        }
        return
      }

      // Bullet points
      if (/^[-*+]\s+/.test(trimmed)) {
        if (!currentList) {
          currentList = {
            startLine: index + 1,
            type: 'bullet',
            items: []
          }
        }
        currentList.items.push(trimmed)
        return
      }

      // Numbered list
      if (/^\d+\.\s+/.test(trimmed)) {
        if (!currentList) {
          currentList = {
            startLine: index + 1,
            type: 'numbered',
            items: []
          }
        }
        currentList.items.push(trimmed)
        return
      }

      // Lettered list (a., b., etc.)
      if (/^[a-zA-Z]\.\s+/.test(trimmed)) {
        if (!currentList) {
          currentList = {
            startLine: index + 1,
            type: 'lettered',
            items: []
          }
        }
        currentList.items.push(trimmed)
        return
      }

      // If we're in a list but this line doesn't match list patterns, end the list
      if (currentList) {
        lists.push(currentList)
        currentList = null
      }
    })

    // Add final list if it exists
    if (currentList && currentList.items.length > 0) {
      lists.push(currentList)
    }

    return lists
  }

  /**
   * Detect potential tables (tab-separated or pipe-separated)
   */
  private static detectPotentialTables(content: string): Array<{
    startLine: number
    rows: string[][]
    type: string
  }> {
    const tables: Array<{ startLine: number; rows: string[][]; type: string }> = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.length === 0) continue

      // Tab-separated table
      if (line.includes('\t')) {
        const rows: string[][] = []
        let currentRow = i

        // Collect consecutive lines with tabs
        while (currentRow < lines.length && lines[currentRow].trim().includes('\t')) {
          rows.push(lines[currentRow].trim().split('\t'))
          currentRow++
        }

        if (rows.length >= 2) { // At least header + one row
          tables.push({
            startLine: i + 1,
            rows,
            type: 'tab_separated'
          })
          i = currentRow - 1 // Skip processed lines
        }
      }

      // Pipe-separated table (Markdown-style)
      if (line.includes('|')) {
        const rows: string[][] = []
        let currentRow = i

        // Collect consecutive lines with pipes
        while (currentRow < lines.length && lines[currentRow].trim().includes('|')) {
          const pipeLine = lines[currentRow].trim()
          // Remove leading/trailing pipes and split
          const cells = pipeLine.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
          rows.push(cells)
          currentRow++
        }

        if (rows.length >= 2) {
          tables.push({
            startLine: i + 1,
            rows,
            type: 'pipe_separated'
          })
          i = currentRow - 1 // Skip processed lines
        }
      }
    }

    return tables
  }

  /**
   * Extract key phrases (simple keyword extraction)
   */
  static extractKeyPhrases(content: string, maxPhrases: number = 10): string[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))

    // Count word frequency
    const frequency: Record<string, number> = {}
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1
    })

    // Extract common phrases (2-3 word combinations)
    const phrases: Record<string, number> = {}
    const wordsArray = content.toLowerCase().split(/\s+/)
    
    for (let i = 0; i < wordsArray.length - 1; i++) {
      // 2-word phrases
      const phrase2 = `${wordsArray[i]} ${wordsArray[i + 1]}`.replace(/[^\w\s]/g, ' ').trim()
      if (phrase2.split(/\s+/).every(word => word.length > 2 && !this.isStopWord(word))) {
        phrases[phrase2] = (phrases[phrase2] || 0) + 1
      }

      // 3-word phrases
      if (i < wordsArray.length - 2) {
        const phrase3 = `${wordsArray[i]} ${wordsArray[i + 1]} ${wordsArray[i + 2]}`.replace(/[^\w\s]/g, ' ').trim()
        if (phrase3.split(/\s+/).every(word => word.length > 2 && !this.isStopWord(word))) {
          phrases[phrase3] = (phrases[phrase3] || 0) + 1
        }
      }
    }

    // Return top phrases
    return Object.entries(phrases)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxPhrases)
      .map(([phrase]) => phrase)
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

  /**
   * Estimate reading time
   */
  static getReadingTime(content: string): number {
    const wordsPerMinute = 200
    const wordCount = this.countWords(content)
    return Math.ceil(wordCount / wordsPerMinute)
  }

  /**
   * Detect language (basic heuristic)
   */
  static detectLanguage(content: string): string {
    const text = content.toLowerCase()
    
    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'to', 'of', 'in', 'that', 'is', 'was', 'he', 'for']
    const spanishWords = ['el', 'la', 'de', 'que', 'y', 'en', 'un', 'es', 'se', 'no']
    const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir']
    const germanWords = ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich']

    const words = text.split(/\s+/).slice(0, 100) // Sample first 100 words

    const englishCount = words.filter(word => englishWords.includes(word)).length
    const spanishCount = words.filter(word => spanishWords.includes(word)).length
    const frenchCount = words.filter(word => frenchWords.includes(word)).length
    const germanCount = words.filter(word => germanWords.includes(word)).length

    const counts = { english: englishCount, spanish: spanishCount, french: frenchCount, german: germanCount }
    const maxCount = Math.max(...Object.values(counts))
    
    if (maxCount === 0) return 'unknown'
    
    const detectedLang = Object.entries(counts).find(([, count]) => count === maxCount)?.[0] || 'unknown'
    return detectedLang
  }
}
