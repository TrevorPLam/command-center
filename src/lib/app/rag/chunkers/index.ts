/**
 * Chunker Registry and Policy Selection
 * 
 * Coordinates all chunkers and provides intelligent chunker selection
 * based on document type and content characteristics.
 */

import { Chunker } from './chunker-base'
import { SemanticChunker } from './semantic-chunker'
import { FixedSizeChunker } from './fixed-size-chunker'
import { RecursiveChunker } from './recursive-chunker'
import { DocumentStructureChunker } from './document-structure-chunker'
import { 
  DocumentChunk, 
  DocumentContentType, 
  ChunkingPolicy, 
  ChunkStrategy,
  NormalizedDocument 
} from '../types'

export class ChunkerRegistry {
  private static chunkers = new Map<ChunkStrategy, Chunker>()

  static {
    // Register all chunkers
    this.register('semantic', new SemanticChunker())
    this.register('fixed_size', new FixedSizeChunker())
    this.register('recursive', new RecursiveChunker())
    this.register('document_structure', new DocumentStructureChunker())
  }

  /**
   * Register a chunker for a strategy
   */
  static register(strategy: ChunkStrategy, chunker: Chunker): void {
    this.chunkers.set(strategy, chunker)
  }

  /**
   * Get chunker for strategy
   */
  static getChunker(strategy: ChunkStrategy): Chunker | null {
    return this.chunkers.get(strategy) || null
  }

  /**
   * Get available chunking strategies
   */
  static getAvailableStrategies(): ChunkStrategy[] {
    return Array.from(this.chunkers.keys())
  }

  /**
   * Chunk a document using the specified strategy
   */
  static async chunkDocument(
    document: NormalizedDocument,
    policy: ChunkingPolicy
  ): Promise<DocumentChunk[]> {
    const chunker = this.getChunker(policy.strategy)
    
    if (!chunker) {
      throw new Error(`Unknown chunking strategy: ${policy.strategy}`)
    }

    // Check if chunker supports the document content type
    const supportedTypes = chunker.getSupportedContentTypes()
    if (!supportedTypes.includes(document.contentType)) {
      console.warn(`Chunker ${policy.strategy} may not fully support content type ${document.contentType}`)
    }

    try {
      return await chunker.chunk(document.id, document.sections, policy)
    } catch (error) {
      console.error(`Chunking failed with strategy ${policy.strategy}:`, error)
      
      // Fallback to fixed-size chunking
      const fallbackChunker = this.getChunker('fixed_size')
      if (fallbackChunker) {
        console.log('Falling back to fixed-size chunking')
        return await fallbackChunker.chunk(document.id, document.sections, policy)
      }
      
      throw error
    }
  }

  /**
   * Get optimal chunking policy for document
   */
  static getOptimalPolicy(document: NormalizedDocument): ChunkingPolicy {
    const contentType = document.contentType
    const documentSize = document.size
    const sectionCount = document.sections.length
    const avgSectionSize = sectionCount > 0 ? documentSize / sectionCount : 0

    // Determine best strategy based on document characteristics
    const strategy = this.selectOptimalStrategy(contentType, documentSize, sectionCount, avgSectionSize)
    
    // Determine optimal chunk sizes
    const { maxChunkSize, chunkOverlap, minChunkSize } = this.calculateOptimalChunkSizes(
      strategy, 
      contentType, 
      documentSize
    )

    // Get strategy-specific separators if needed
    const separators = strategy === 'recursive' ? this.getOptimalSeparators(contentType) : undefined

    return {
      strategy,
      maxChunkSize,
      chunkOverlap,
      minChunkSize,
      separators,
      preserveFormatting: this.shouldPreserveFormatting(contentType)
    }
  }

  /**
   * Select optimal chunking strategy
   */
  private static selectOptimalStrategy(
    contentType: DocumentContentType,
    documentSize: number,
    sectionCount: number,
    avgSectionSize: number
  ): ChunkStrategy {
    // Code documents benefit from structure-aware chunking
    if (this.isCodeContentType(contentType)) {
      if (sectionCount > 5 && avgSectionSize < 2000) {
        return 'document_structure'
      }
      return 'semantic'
    }

    // Markdown and HTML benefit from semantic chunking
    if (contentType === 'text/markdown' || contentType === 'text/html') {
      if (sectionCount > 10) {
        return 'document_structure'
      }
      return 'semantic'
    }

    // JSON benefits from structure-aware chunking
    if (contentType === 'application/json') {
      return 'document_structure'
    }

    // CSV benefits from fixed-size chunking
    if (contentType === 'text/csv') {
      return 'fixed_size'
    }

    // Large plain text documents benefit from recursive chunking
    if (contentType === 'text/plain' && documentSize > 10000) {
      return 'recursive'
    }

    // Default to semantic for most text documents
    return 'semantic'
  }

  /**
   * Calculate optimal chunk sizes
   */
  private static calculateOptimalChunkSizes(
    strategy: ChunkStrategy,
    contentType: DocumentContentType,
    documentSize: number
  ): { maxChunkSize: number; chunkOverlap: number; minChunkSize: number } {
    let maxChunkSize = 1000
    let chunkOverlap = 200
    let minChunkSize = 100

    // Adjust based on strategy
    switch (strategy) {
      case 'semantic':
        maxChunkSize = this.isCodeContentType(contentType) ? 1500 : 1200
        chunkOverlap = 150
        minChunkSize = 50
        break

      case 'fixed_size':
        maxChunkSize = 800
        chunkOverlap = 100
        minChunkSize = 200
        break

      case 'recursive':
        maxChunkSize = 1000
        chunkOverlap = 200
        minChunkSize = 100
        break

      case 'document_structure':
        maxChunkSize = this.isCodeContentType(contentType) ? 2000 : 1500
        chunkOverlap = 100
        minChunkSize = 50
        break
    }

    // Adjust based on document size
    if (documentSize < 1000) {
      maxChunkSize = Math.min(maxChunkSize, documentSize)
      chunkOverlap = Math.min(chunkOverlap, 50)
    } else if (documentSize > 50000) {
      maxChunkSize = Math.max(maxChunkSize, 1500)
      chunkOverlap = Math.max(chunkOverlap, 200)
    }

    // Adjust based on content type
    if (this.isCodeContentType(contentType)) {
      maxChunkSize = Math.max(maxChunkSize, 1000)
      minChunkSize = Math.max(minChunkSize, 100)
    }

    return { maxChunkSize, chunkOverlap, minChunkSize }
  }

  /**
   * Get optimal separators for recursive chunking
   */
  private static getOptimalSeparators(contentType: DocumentContentType): string[] {
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
      'text/javascript':
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
      'text/java': [
        '\npublic class ', // Classes
        '\nprivate class ',
        '\nprotected class ',
        '\npublic static ', // Methods
        '\nprivate static ',
        '\nprotected static ',
        '\n\n',           // Paragraphs
        '{',              // Braces
      ],
      'text/cpp': [
        '\nclass ',    // Classes
        '\nstruct ',   // Structs
        '\nvoid ',     // Functions
        '\nint ',      // Functions
        '\n\n',       // Paragraphs
        '{',          // Braces
      ],
      'text/csharp': [
        '\npublic class ',  // Classes
        '\nprivate class ',
        '\nprotected class ',
        '\npublic void ',   // Methods
        '\nprivate void ',
        '\nprotected void ',
        '\n\n',             // Paragraphs
        '{',                // Braces
      ],
      'text/go': [
        '\nfunc ',     // Functions
        '\ntype ',     // Types
        '\nvar ',      // Variables
        '\nconst ',    // Constants
        '\n\n',       // Paragraphs
        '{',          // Braces
      ],
      'text/rust': [
        '\nfn ',       // Functions
        '\nstruct ',   // Structs
        '\nimpl ',     // Implementations
        '\nlet ',      // Variables
        '\n\n',       // Paragraphs
        '{',          // Braces
      ],
      'text/sql': [
        '\nCREATE TABLE ', // Tables
        '\nCREATE VIEW ',
        '\nCREATE INDEX ',
        '\nSELECT ',        // Queries
        '\nINSERT ',
        '\nUPDATE ',
        '\nDELETE ',
        '\n\n',            // Paragraphs
        ';',               // Statements
      ],
      default: [
        '\n\n\n', // Triple newlines
        '\n\n',   // Double newlines
        '\n',     // Single newlines
        '. ',     // Sentences
        ' ',      // Words
      ]
    }

    return separatorMap[contentType] || separatorMap.default
  }

  /**
   * Check if content type is code
   */
  private static isCodeContentType(contentType: DocumentContentType): boolean {
    return contentType.startsWith('text/') && 
           ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'sql']
             .some(lang => contentType.includes(lang))
  }

  /**
   * Determine if formatting should be preserved
   */
  private static shouldPreserveFormatting(contentType: DocumentContentType): boolean {
    const preserveTypes = [
      'text/markdown',
      'text/html',
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

    return preserveTypes.includes(contentType)
  }

  /**
   * Validate chunking policy
   */
  static validatePolicy(policy: ChunkingPolicy): {
    isValid: boolean
    issues: string[]
  } {
    const issues: string[] = []

    if (policy.maxChunkSize <= 0) {
      issues.push('maxChunkSize must be greater than 0')
    }

    if (policy.chunkOverlap < 0) {
      issues.push('chunkOverlap cannot be negative')
    }

    if (policy.chunkOverlap >= policy.maxChunkSize) {
      issues.push('chunkOverlap must be less than maxChunkSize')
    }

    if (policy.minChunkSize && policy.minChunkSize <= 0) {
      issues.push('minChunkSize must be greater than 0')
    }

    if (policy.minChunkSize && policy.minChunkSize >= policy.maxChunkSize) {
      issues.push('minChunkSize must be less than maxChunkSize')
    }

    if (policy.separators && policy.separators.length === 0) {
      issues.push('separators array cannot be empty')
    }

    return {
      isValid: issues.length === 0,
      issues
    }
  }

  /**
   * Get chunking recommendations
   */
  static getRecommendations(document: NormalizedDocument): {
    recommendedStrategy: ChunkStrategy
    alternativeStrategies: ChunkStrategy[]
    reasoning: string[]
    estimatedChunks: number
  } {
    const contentType = document.contentType
    const documentSize = document.size
    const sectionCount = document.sections.length

    const recommendedStrategy = this.selectOptimalStrategy(contentType, documentSize, sectionCount, 0)
    const alternativeStrategies = this.getAvailableStrategies()
      .filter(s => s !== recommendedStrategy)
      .slice(0, 2)

    const reasoning = this.generateReasoning(contentType, documentSize, sectionCount, recommendedStrategy)
    const estimatedChunks = this.estimateChunkCount(document, recommendedStrategy)

    return {
      recommendedStrategy,
      alternativeStrategies,
      reasoning,
      estimatedChunks
    }
  }

  /**
   * Generate reasoning for strategy recommendation
   */
  private static generateReasoning(
    contentType: DocumentContentType,
    documentSize: number,
    sectionCount: number,
    strategy: ChunkStrategy
  ): string[] {
    const reasoning: string[] = []

    reasoning.push(`Document type: ${contentType}`)
    reasoning.push(`Document size: ${documentSize} characters`)
    reasoning.push(`Section count: ${sectionCount}`)

    switch (strategy) {
      case 'semantic':
        reasoning.push('Semantic chunking preserves meaning and context boundaries')
        if (this.isCodeContentType(contentType)) {
          reasoning.push('Good for code with natural function/class boundaries')
        }
        break

      case 'document_structure':
        reasoning.push('Document structure chunking preserves logical organization')
        if (this.isCodeContentType(contentType)) {
          reasoning.push('Excellent for code with clear structural elements')
        }
        break

      case 'recursive':
        reasoning.push('Recursive chunking handles hierarchical content well')
        if (documentSize > 10000) {
          reasoning.push('Suitable for large documents with nested structure')
        }
        break

      case 'fixed_size':
        reasoning.push('Fixed-size chunking provides predictable, uniform chunks')
        if (contentType === 'text/csv') {
          reasoning.push('Ideal for tabular data and structured formats')
        }
        break
    }

    return reasoning
  }

  /**
   * Estimate number of chunks for a strategy
   */
  private static estimateChunkCount(document: NormalizedDocument, strategy: ChunkStrategy): number {
    const policy = this.getOptimalPolicy(document)
    const avgChunkSize = policy.maxChunkSize * 0.8 // Assume 80% utilization
    
    return Math.ceil(document.size / avgChunkSize)
  }

  /**
   * Get chunker statistics
   */
  static getChunkerStats(): Array<{
    strategy: ChunkStrategy
    supportedContentTypes: DocumentContentType[]
    description: string
    bestFor: string[]
  }> {
    return [
      {
        strategy: 'semantic',
        supportedContentTypes: new SemanticChunker().getSupportedContentTypes(),
        description: 'Chunks based on semantic boundaries and meaning',
        bestFor: ['Documents with clear sections', 'Code with natural boundaries', 'Mixed content types']
      },
      {
        strategy: 'fixed_size',
        supportedContentTypes: new FixedSizeChunker().getSupportedContentTypes(),
        description: 'Chunks based on fixed character limits with overlap',
        bestFor: ['Tabular data', 'Large plain text', 'Predictable chunking needs']
      },
      {
        strategy: 'recursive',
        supportedContentTypes: new RecursiveChunker().getSupportedContentTypes(),
        description: 'Recursively splits using hierarchy of separators',
        bestFor: ['Hierarchical documents', 'Markdown with nested structure', 'Code with nested blocks']
      },
      {
        strategy: 'document_structure',
        supportedContentTypes: new DocumentStructureChunker().getSupportedContentTypes(),
        description: 'Preserves document structure and logical boundaries',
        bestFor: ['Code files', 'Structured documents', 'JSON/XML data', 'Well-organized content']
      }
    ]
  }
}
