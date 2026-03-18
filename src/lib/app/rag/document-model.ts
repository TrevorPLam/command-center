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

    // Add advanced content analysis
    const contentAnalysis = this.analyzeContentComplexity(document)
    Object.assign(enriched.metadata, contentAnalysis)

    // Add section-specific metadata
    enriched.sections = document.sections.map((section, index) => ({
      ...section,
      metadata: {
        ...section.metadata,
        section_index: index,
        char_count: section.text.length,
        word_count: section.text.split(/\s+/).filter(w => w.length > 0).length,
        readability_score: this.calculateReadabilityScore(section.text),
        density_score: this.calculateContentDensity(section.text)
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

    // Advanced keyword extraction with TF-IDF-like scoring
    const keywords = this.extractAdvancedKeywords(document)
    
    // Generate comprehensive tags
    const tags = this.generateAdvancedTags(document)
    
    // Add semantic metadata
    const semanticMetadata = this.extractSemanticMetadata(document)

    enriched.metadata = {
      ...document.metadata,
      search_snippets: snippets,
      keywords: keywords.topKeywords,
      keyword_scores: keywords.keywordScores,
      tags,
      semantic_categories: semanticMetadata.categories,
      entity_mentions: semanticMetadata.entities,
      topic_modeling: semanticMetadata.topics,
      content_summary: this.generateContentSummary(document),
      question_potential: this.assessQuestionPotential(document)
    }

    return enriched
  }

  /**
   * Analyze content complexity and quality metrics
   */
  private static analyzeContentComplexity(document: NormalizedDocument): Record<string, unknown> {
    const allText = document.sections.map(s => s.text).join(' ')
    const words = allText.split(/\s+/).filter(w => w.length > 0)
    const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 0)
    
    // Vocabulary richness (unique words / total words)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()))
    const vocabularyRichness = words.length > 0 ? uniqueWords.size / words.length : 0
    
    // Average sentence length
    const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0
    
    // Content density (information per character)
    const contentDensity = this.calculateContentDensity(allText)
    
    // Structure complexity
    const headingLevels = [...new Set(document.sections
      .filter(s => s.level)
      .map(s => s.level)
    )]
    
    return {
      word_count: words.length,
      sentence_count: sentences.length,
      paragraph_count: document.sections.length,
      vocabulary_richness: vocabularyRichness,
      avg_sentence_length: avgSentenceLength,
      avg_word_length: words.length > 0 ? allText.length / words.length : 0,
      content_density: contentDensity,
      structure_complexity: headingLevels.length,
      heading_depth: Math.max(...headingLevels, 0),
      readability_level: this.assessReadabilityLevel(avgSentenceLength, vocabularyRichness),
      technical_complexity: this.assessTechnicalComplexity(allText)
    }
  }

  /**
   * Calculate readability score using Flesch-Kincaid inspired metrics
   */
  private static calculateReadabilityScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = text.split(/\s+/).filter(w => w.length > 0)
    
    if (sentences.length === 0 || words.length === 0) return 0
    
    const avgSentenceLength = words.length / sentences.length
    const avgSyllablesPerWord = words.reduce((sum, word) => 
      sum + this.countSyllables(word), 0) / words.length
    
    // Simplified Flesch score (0-100, higher = easier to read)
    const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord)
    return Math.max(0, Math.min(100, fleschScore))
  }

  /**
   * Calculate content density (information per character)
   */
  private static calculateContentDensity(text: string): number {
    if (!text || text.length === 0) return 0
    
    // Remove common words and measure meaningful content
    const meaningfulWords = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word.toLowerCase()))
    
    return meaningfulWords.length / text.length
  }

  /**
   * Advanced keyword extraction with TF-IDF-like scoring
   */
  private static extractAdvancedKeywords(document: NormalizedDocument): {
    topKeywords: string[]
    keywordScores: Record<string, number>
  } {
    const text = document.sections.map(s => s.text).join(' ').toLowerCase()
    const words = text.split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word))
    
    // Calculate TF-IDF inspired scores
    const wordFrequency: Record<string, number> = {}
    const totalWords = words.length
    
    words.forEach(word => {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1
    })
    
    // Apply TF-IDF-like scoring (frequency * importance factor)
    const keywordScores: Record<string, number> = {}
    Object.entries(wordFrequency).forEach(([word, freq]) => {
      const tf = freq / totalWords
      const importanceFactor = this.calculateWordImportance(word)
      keywordScores[word] = tf * importanceFactor * 100
    })
    
    // Sort by score and return top keywords
    const sortedKeywords = Object.entries(keywordScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([word]) => word)
    
    return {
      topKeywords: sortedKeywords,
      keywordScores
    }
  }

  /**
   * Calculate word importance based on various factors
   */
  private static calculateWordImportance(word: string): number {
    let importance = 1.0
    
    // Capitalized words might be important
    if (word[0] === word[0].toUpperCase()) importance *= 1.5
    
    // Longer words might be more specific
    importance *= Math.min(2.0, word.length / 5)
    
    // Technical indicators
    if (/\d/.test(word)) importance *= 1.2 // Contains numbers
    if (/[A-Z]{2,}/.test(word)) importance *= 1.3 // Acronym
    
    return importance
  }

  /**
   * Generate advanced tags including semantic and structural tags
   */
  private static generateAdvancedTags(document: NormalizedDocument): string[] {
    const tags: string[] = []
    const text = document.sections.map(s => s.text).join(' ').toLowerCase()
    
    // Content type tags
    tags.push(document.contentType.split('/')[1] || 'text')
    
    // Language tags
    if (document.metadata.detected_language) {
      tags.push(document.metadata.detected_language as string)
    }
    
    // Size-based tags
    if (document.size > 1000000) tags.push('large')
    else if (document.size > 10000) tags.push('medium')
    else tags.push('small')
    
    // Structure tags
    if (document.sections.some(s => s.metadata.type === 'heading')) {
      tags.push('structured')
    }
    
    // Content characteristics tags
    if (text.includes('step') || text.includes('tutorial') || text.includes('guide')) {
      tags.push('instructional')
    }
    
    if (text.includes('example') || text.includes('demo')) {
      tags.push('example')
    }
    
    if (/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/.test(text)) {
      tags.push('time-sensitive')
    }
    
    if (/\$\d+|\d+\s*dollars?|€\d+|\d+\s*euros?/.test(text)) {
      tags.push('financial')
    }
    
    // Technical content tags
    if (/\b(function|class|const|let|var|import|export|def|return)\b/.test(text)) {
      tags.push('code')
    }
    
    if (/\b(http|https|www\.|\.com|\.org|\.io)\b/.test(text)) {
      tags.push('web')
    }
    
    // Document quality tags
    const avgReadability = document.sections.reduce((sum, s) => {
      const score = s.metadata.readability_score as number
      return sum + (score || 0)
    }, 0) / document.sections.length
    
    if (avgReadability > 70) tags.push('easy-to-read')
    else if (avgReadability < 40) tags.push('complex')
    
    return [...new Set(tags)] // Remove duplicates
  }

  /**
   * Extract semantic metadata using pattern matching
   */
  private static extractSemanticMetadata(document: NormalizedDocument): {
    categories: string[]
    entities: string[]
    topics: string[]
  } {
    const text = document.sections.map(s => s.text).join(' ')
    
    // Simple pattern-based entity extraction
    const entities: string[] = []
    
    // Email addresses
    const emails = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []
    entities.push(...emails.map(e => `email:${e}`))
    
    // URLs
    const urls = text.match(/\bhttps?:\/\/[^\s<>"]+/g) || []
    entities.push(...urls.map(u => `url:${u}`))
    
    // Dates
    const dates = text.match(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g) || []
    entities.push(...dates.map(d => `date:${d}`))
    
    // Simple categorization based on content
    const categories = this.categorizeContent(text)
    
    // Topic modeling (simplified)
    const topics = this.extractTopics(text)
    
    return {
      categories,
      entities: [...new Set(entities)],
      topics
    }
  }

  /**
   * Categorize content based on patterns and keywords
   */
  private static categorizeContent(text: string): string[] {
    const categories: string[] = []
    const lowerText = text.toLowerCase()
    
    // Technical documentation
    if (/\b(api|endpoint|request|response|json|xml|http|rest)\b/.test(lowerText)) {
      categories.push('technical-docs')
    }
    
    // Educational content
    if (/\b(learn|study|course|lesson|tutorial|education)\b/.test(lowerText)) {
      categories.push('educational')
    }
    
    // Business content
    if (/\b(business|company|revenue|profit|market|customer)\b/.test(lowerText)) {
      categories.push('business')
    }
    
    // Legal content
    if (/\b(legal|law|contract|agreement|terms|conditions)\b/.test(lowerText)) {
      categories.push('legal')
    }
    
    // Medical/Health
    if (/\b(medical|health|patient|treatment|diagnosis|medicine)\b/.test(lowerText)) {
      categories.push('medical')
    }
    
    return categories
  }

  /**
   * Extract topics using simplified keyword clustering
   */
  private static extractTopics(text: string): string[] {
    const topicKeywords = {
      'technology': ['computer', 'software', 'programming', 'code', 'algorithm', 'data'],
      'business': ['market', 'revenue', 'customer', 'strategy', 'management', 'finance'],
      'science': ['research', 'experiment', 'study', 'analysis', 'hypothesis', 'theory'],
      'education': ['learning', 'teaching', 'student', 'course', 'knowledge', 'skill'],
      'health': ['medical', 'health', 'treatment', 'patient', 'diagnosis', 'therapy']
    }
    
    const topics: string[] = []
    const lowerText = text.toLowerCase()
    
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      const matches = keywords.filter(keyword => lowerText.includes(keyword)).length
      if (matches >= 2) { // At least 2 keywords to qualify
        topics.push(topic)
      }
    })
    
    return topics
  }

  /**
   * Generate content summary
   */
  private static generateContentSummary(document: NormalizedDocument): string {
    const text = document.sections.map(s => s.text).join(' ')
    
    // Extract first and last sentences as a simple summary
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
    
    if (sentences.length <= 2) {
      return text.slice(0, 200) + (text.length > 200 ? '...' : '')
    }
    
    return `${sentences[0].trim()}. ... ${sentences[sentences.length - 1].trim()}.`
  }

  /**
   * Assess potential for answering questions
   */
  private static assessQuestionPotential(document: NormalizedDocument): {
    qa_potential: number
    question_types: string[]
  } {
    const text = document.sections.map(s => s.text).join(' ').toLowerCase()
    
    const questionIndicators = {
      'what': /\b(what|define|describe|explain)\b/g,
      'how': /\b(how|process|method|procedure|steps)\b/g,
      'why': /\b(why|reason|cause|purpose|because)\b/g,
      'when': /\b(when|time|date|period|schedule)\b/g,
      'where': /\b(where|location|place|position|address)\b/g,
      'who': /\b(who|person|people|author|creator)\b/g
    }
    
    const questionTypes: string[] = []
    let totalMatches = 0
    
    Object.entries(questionIndicators).forEach(([type, regex]) => {
      const matches = (text.match(regex) || []).length
      if (matches > 0) {
        questionTypes.push(type)
        totalMatches += matches
      }
    })
    
    // Calculate QA potential (0-1 scale)
    const qaPotential = Math.min(1.0, totalMatches / (text.length / 1000))
    
    return {
      qa_potential: qaPotential,
      question_types: questionTypes
    }
  }

  /**
   * Helper methods
   */
  private static countSyllables(word: string): number {
    word = word.toLowerCase()
    const vowels = 'aeiouy'
    let count = 0
    let prevWasVowel = false
    
    for (const char of word) {
      const isVowel = vowels.includes(char)
      if (isVowel && !prevWasVowel) {
        count++
      }
      prevWasVowel = isVowel
    }
    
    return Math.max(1, count)
  }

  private static assessReadabilityLevel(avgSentenceLength: number, vocabularyRichness: number): string {
    if (avgSentenceLength < 15 && vocabularyRichness > 0.5) return 'easy'
    if (avgSentenceLength < 20 && vocabularyRichness > 0.4) return 'moderate'
    if (avgSentenceLength < 25 && vocabularyRichness > 0.3) return 'difficult'
    return 'very_difficult'
  }

  private static assessTechnicalComplexity(text: string): number {
    const technicalIndicators = [
      /\b(function|class|algorithm|method|parameter)\b/g,
      /\b(api|endpoint|request|response)\b/g,
      /\b(database|query|index|schema)\b/g,
      /\b(protocol|network|socket|port)\b/g
    ]
    
    const matches = technicalIndicators.reduce((sum, regex) => 
      sum + (text.match(regex) || []).length, 0
    )
    
    return Math.min(1.0, matches / (text.length / 500))
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
