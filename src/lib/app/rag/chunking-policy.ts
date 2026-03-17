/**
 * Chunking Policy Service
 * 
 * Manages chunking policies, validation, and optimization.
 * Provides intelligent policy recommendations and management.
 */

import { 
  ChunkingPolicy, 
  ChunkStrategy, 
  DocumentContentType,
  NormalizedDocument 
} from './types'
import { ChunkerRegistry } from './chunkers'

export interface PolicyTemplate {
  id: string
  name: string
  description: string
  strategy: ChunkStrategy
  maxChunkSize: number
  chunkOverlap: number
  minChunkSize?: number
  separators?: string[]
  preserveFormatting: boolean
  recommendedFor: DocumentContentType[]
  tags: string[]
}

export interface PolicyOptimization {
  originalPolicy: ChunkingPolicy
  optimizedPolicy: ChunkingPolicy
  improvements: string[]
  expectedImpact: {
    chunkCount: number
    avgChunkSize: number
    qualityScore: number
  }
}

export class ChunkingPolicyService {
  private static templates: Map<string, PolicyTemplate> = new Map()

  static {
    // Initialize default templates
    this.initializeDefaultTemplates()
  }

  /**
   * Get all available policy templates
   */
  static getTemplates(): PolicyTemplate[] {
    return Array.from(this.templates.values())
  }

  /**
   * Get policy template by ID
   */
  static getTemplate(id: string): PolicyTemplate | undefined {
    return this.templates.get(id)
  }

  /**
   * Create custom policy template
   */
  static createTemplate(template: Omit<PolicyTemplate, 'id'>): PolicyTemplate {
    const id = this.generateTemplateId(template.name)
    const fullTemplate: PolicyTemplate = { ...template, id }
    this.templates.set(id, fullTemplate)
    return fullTemplate
  }

  /**
   * Apply template to create policy
   */
  static applyTemplate(templateId: string, customizations?: Partial<ChunkingPolicy>): ChunkingPolicy {
    const template = this.getTemplate(templateId)
    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const policy: ChunkingPolicy = {
      strategy: template.strategy,
      maxChunkSize: template.maxChunkSize,
      chunkOverlap: template.chunkOverlap,
      minChunkSize: template.minChunkSize,
      separators: template.separators,
      preserveFormatting: template.preserveFormatting,
      ...customizations
    }

    return policy
  }

  /**
   * Get optimal policy for document
   */
  static getOptimalPolicy(document: NormalizedDocument): ChunkingPolicy {
    return ChunkerRegistry.getOptimalPolicy(document)
  }

  /**
   * Optimize existing policy for document
   */
  static optimizePolicy(
    policy: ChunkingPolicy,
    document: NormalizedDocument
  ): PolicyOptimization {
    const optimizedPolicy = this.getOptimalPolicy(document)
    const improvements = this.comparePolicies(policy, optimizedPolicy)
    const expectedImpact = this.calculateExpectedImpact(optimizedPolicy, document)

    return {
      originalPolicy: policy,
      optimizedPolicy,
      improvements,
      expectedImpact
    }
  }

  /**
   * Validate policy
   */
  static validatePolicy(policy: ChunkingPolicy): {
    isValid: boolean
    issues: string[]
    warnings: string[]
  } {
    const validation = ChunkerRegistry.validatePolicy(policy)
    const warnings: string[] = []

    // Add additional warnings
    if (policy.chunkOverlap > policy.maxChunkSize * 0.5) {
      warnings.push('High overlap may result in redundant content')
    }

    if (policy.minChunkSize && policy.minChunkSize > policy.maxChunkSize * 0.8) {
      warnings.push('High minimum size may limit chunking flexibility')
    }

    if (policy.maxChunkSize > 4000) {
      warnings.push('Large chunk size may impact retrieval performance')
    }

    if (policy.maxChunkSize < 200) {
      warnings.push('Small chunk size may result in too many chunks')
    }

    return {
      ...validation,
      warnings
    }
  }

  /**
   * Get policy recommendations for document type
   */
  static getRecommendations(contentType: DocumentContentType): PolicyTemplate[] {
    return this.getTemplates()
      .filter(template => template.recommendedFor.includes(contentType))
      .sort((a, b) => {
        // Prioritize templates that are specifically designed for this content type
        const aScore = this.calculateTemplateScore(a, contentType)
        const bScore = this.calculateTemplateScore(b, contentType)
        return bScore - aScore
      })
  }

  /**
   * Analyze policy performance
   */
  static analyzePolicyPerformance(
    policy: ChunkingPolicy,
    document: NormalizedDocument,
    actualChunks: any[] // Would be DocumentChunk[] in practice
  ): {
    efficiency: number
    quality: number
    coverage: number
    recommendations: string[]
  } {
    const expectedChunks = this.estimateChunkCount(document, policy)
    const actualChunkCount = actualChunks.length
    const efficiency = expectedChunks > 0 ? actualChunkCount / expectedChunks : 0

    const quality = this.calculateChunkQuality(actualChunks, policy)
    const coverage = this.calculateCoverage(document, actualChunks)

    const recommendations = this.generatePerformanceRecommendations(
      efficiency,
      quality,
      coverage,
      policy
    )

    return {
      efficiency,
      quality,
      coverage,
      recommendations
    }
  }

  /**
   * Compare two policies
   */
  private static comparePolicies(original: ChunkingPolicy, optimized: ChunkingPolicy): string[] {
    const improvements: string[] = []

    if (original.strategy !== optimized.strategy) {
      improvements.push(`Strategy changed from ${original.strategy} to ${optimized.strategy}`)
    }

    if (original.maxChunkSize !== optimized.maxChunkSize) {
      improvements.push(`Max chunk size optimized from ${original.maxChunkSize} to ${optimized.maxChunkSize}`)
    }

    if (original.chunkOverlap !== optimized.chunkOverlap) {
      improvements.push(`Chunk overlap adjusted from ${original.chunkOverlap} to ${optimized.chunkOverlap}`)
    }

    if (original.minChunkSize !== optimized.minChunkSize) {
      improvements.push(`Min chunk size updated from ${original.minChunkSize} to ${optimized.minChunkSize}`)
    }

    if (JSON.stringify(original.separators) !== JSON.stringify(optimized.separators)) {
      improvements.push('Separators optimized for content type')
    }

    if (original.preserveFormatting !== optimized.preserveFormatting) {
      improvements.push(`Formatting preservation ${optimized.preserveFormatting ? 'enabled' : 'disabled'}`)
    }

    return improvements
  }

  /**
   * Calculate expected impact of policy
   */
  private static calculateExpectedImpact(policy: ChunkingPolicy, document: NormalizedDocument): {
    chunkCount: number
    avgChunkSize: number
    qualityScore: number
  } {
    const chunkCount = this.estimateChunkCount(document, policy)
    const avgChunkSize = document.size / chunkCount
    const qualityScore = this.calculatePolicyQualityScore(policy, document)

    return {
      chunkCount,
      avgChunkSize,
      qualityScore
    }
  }

  /**
   * Estimate chunk count for policy
   */
  private static estimateChunkCount(document: NormalizedDocument, policy: ChunkingPolicy): number {
    const effectiveSize = policy.maxChunkSize - policy.chunkOverlap
    return Math.ceil(document.size / effectiveSize)
  }

  /**
   * Calculate policy quality score
   */
  private static calculatePolicyQualityScore(policy: ChunkingPolicy, document: NormalizedDocument): number {
    let score = 0

    // Strategy appropriateness (40 points)
    const optimalStrategy = ChunkerRegistry.getOptimalPolicy(document).strategy
    if (policy.strategy === optimalStrategy) {
      score += 40
    } else if (this.isCompatibleStrategy(policy.strategy, document.contentType)) {
      score += 25
    } else {
      score += 10
    }

    // Chunk size appropriateness (30 points)
    const optimalSize = this.getOptimalChunkSize(document.contentType, document.size)
    const sizeDiff = Math.abs(policy.maxChunkSize - optimalSize) / optimalSize
    if (sizeDiff < 0.1) score += 30
    else if (sizeDiff < 0.3) score += 20
    else if (sizeDiff < 0.5) score += 10

    // Overlap appropriateness (20 points)
    const optimalOverlap = this.getOptimalOverlap(document.contentType, policy.maxChunkSize)
    const overlapDiff = Math.abs(policy.chunkOverlap - optimalOverlap) / optimalOverlap
    if (overlapDiff < 0.2) score += 20
    else if (overlapDiff < 0.5) score += 10

    // Additional features (10 points)
    if (policy.preserveFormatting && this.shouldPreserveFormatting(document.contentType)) {
      score += 5
    }
    if (policy.separators && policy.separators.length > 0) {
      score += 5
    }

    return Math.min(100, score)
  }

  /**
   * Check if strategy is compatible with content type
   */
  private static isCompatibleStrategy(strategy: ChunkStrategy, contentType: DocumentContentType): boolean {
    const chunker = ChunkerRegistry.getChunker(strategy)
    return chunker ? chunker.getSupportedContentTypes().includes(contentType) : false
  }

  /**
   * Get optimal chunk size for content type
   */
  private static getOptimalChunkSize(contentType: DocumentContentType, documentSize: number): number {
    const baseSize = 1000
    
    // Adjust for content type
    if (contentType.startsWith('text/') && 
        ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'sql']
          .some(lang => contentType.includes(lang))) {
      return baseSize * 1.5 // Code benefits from larger chunks
    }

    if (contentType === 'text/csv') {
      return 500 // CSV works well with smaller chunks
    }

    // Adjust for document size
    if (documentSize < 1000) return Math.min(baseSize, documentSize)
    if (documentSize > 50000) return baseSize * 1.2

    return baseSize
  }

  /**
   * Get optimal overlap for content type
   */
  private static getOptimalOverlap(contentType: DocumentContentType, chunkSize: number): number {
    const baseOverlap = Math.floor(chunkSize * 0.2)
    
    // Code benefits from less overlap
    if (contentType.startsWith('text/') && 
        ['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'sql']
          .some(lang => contentType.includes(lang))) {
      return Math.floor(baseOverlap * 0.5)
    }

    // Plain text benefits from more overlap
    if (contentType === 'text/plain') {
      return Math.floor(baseOverlap * 1.2)
    }

    return baseOverlap
  }

  /**
   * Check if formatting should be preserved
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
   * Calculate template score for content type
   */
  private static calculateTemplateScore(template: PolicyTemplate, contentType: DocumentContentType): number {
    let score = 0

    // Direct recommendation (50 points)
    if (template.recommendedFor.includes(contentType)) {
      score += 50
    }

    // Strategy compatibility (30 points)
    if (this.isCompatibleStrategy(template.strategy, contentType)) {
      score += 30
    }

    // Tag relevance (20 points)
    const contentTags = this.getContentTags(contentType)
    const matchingTags = template.tags.filter(tag => contentTags.includes(tag))
    score += Math.min(20, matchingTags.length * 5)

    return score
  }

  /**
   * Get content tags for content type
   */
  private static getContentTags(contentType: DocumentContentType): string[] {
    const tagMap: Record<DocumentContentType, string[]> = {
      'text/markdown': ['structured', 'headings', 'semantic'],
      'text/html': ['structured', 'semantic', 'markup'],
      'text/plain': ['simple', 'unstructured'],
      'text/csv': ['tabular', 'structured', 'data'],
      'application/json': ['structured', 'data', 'nested'],
      'text/javascript': ['code', 'structured', 'functions'],
      'text/typescript': ['code', 'structured', 'functions', 'types'],
      'text/python': ['code', 'structured', 'functions', 'classes'],
      'text/java': ['code', 'structured', 'classes', 'methods'],
      'text/cpp': ['code', 'structured', 'functions', 'classes'],
      'text/csharp': ['code', 'structured', 'classes', 'methods'],
      'text/go': ['code', 'structured', 'functions', 'types'],
      'text/rust': ['code', 'structured', 'functions', 'structs'],
      'text/sql': ['code', 'structured', 'queries', 'tables']
    }

    return tagMap[contentType] || ['general']
  }

  /**
   * Calculate chunk quality
   */
  private static calculateChunkQuality(chunks: any[], policy: ChunkingPolicy): number {
    if (chunks.length === 0) return 0

    let totalScore = 0

    chunks.forEach(chunk => {
      let chunkScore = 0

      // Size appropriateness (40 points)
      const size = chunk.text.length
      if (size <= policy.maxChunkSize) {
        if (policy.minChunkSize && size >= policy.minChunkSize) {
          chunkScore += 40
        } else if (!policy.minChunkSize) {
          chunkScore += 40
        } else {
          chunkScore += 20
        }
      }

      // Content quality (30 points)
      if (chunk.text.trim().length > 0) {
        chunkScore += 30
      }

      // Structure preservation (30 points)
      if (chunk.metadata.type && chunk.metadata.type !== 'generic') {
        chunkScore += 30
      }

      totalScore += chunkScore
    })

    return totalScore / chunks.length
  }

  /**
   * Calculate coverage
   */
  private static calculateCoverage(document: NormalizedDocument, chunks: any[]): number {
    const totalChunkedContent = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0)
    return document.size > 0 ? totalChunkedContent / document.size : 0
  }

  /**
   * Generate performance recommendations
   */
  private static generatePerformanceRecommendations(
    efficiency: number,
    quality: number,
    coverage: number,
    policy: ChunkingPolicy
  ): string[] {
    const recommendations: string[] = []

    if (efficiency > 1.2) {
      recommendations.push('Consider increasing chunk size to reduce chunk count')
    } else if (efficiency < 0.8) {
      recommendations.push('Consider decreasing chunk size to improve coverage')
    }

    if (quality < 70) {
      recommendations.push('Consider using semantic or structure-aware chunking')
    }

    if (coverage < 0.9) {
      recommendations.push('Adjust minimum chunk size or overlap to improve coverage')
    }

    if (policy.chunkOverlap > policy.maxChunkSize * 0.3) {
      recommendations.push('Consider reducing overlap to avoid redundancy')
    }

    return recommendations
  }

  /**
   * Generate template ID
   */
  private static generateTemplateId(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  /**
   * Initialize default templates
   */
  private static initializeDefaultTemplates(): void {
    const defaultTemplates: Omit<PolicyTemplate, 'id'>[] = [
      {
        name: 'Default Semantic',
        description: 'Balanced semantic chunking for general documents',
        strategy: 'semantic',
        maxChunkSize: 1000,
        chunkOverlap: 200,
        minChunkSize: 100,
        preserveFormatting: true,
        recommendedFor: ['text/plain', 'text/markdown', 'text/html'],
        tags: ['balanced', 'semantic', 'general']
      },
      {
        name: 'Code Structure',
        description: 'Structure-aware chunking for code files',
        strategy: 'document_structure',
        maxChunkSize: 1500,
        chunkOverlap: 100,
        minChunkSize: 50,
        preserveFormatting: true,
        recommendedFor: [
          'text/javascript', 'text/typescript', 'text/python', 'text/java',
          'text/cpp', 'text/csharp', 'text/go', 'text/rust', 'text/sql'
        ],
        tags: ['code', 'structure', 'functions', 'classes']
      },
      {
        name: 'Fixed Size',
        description: 'Predictable fixed-size chunking',
        strategy: 'fixed_size',
        maxChunkSize: 800,
        chunkOverlap: 100,
        minChunkSize: 200,
        preserveFormatting: false,
        recommendedFor: ['text/csv', 'application/pdf', 'text/plain'],
        tags: ['predictable', 'uniform', 'tabular']
      },
      {
        name: 'Recursive Markdown',
        description: 'Hierarchical chunking for markdown documents',
        strategy: 'recursive',
        maxChunkSize: 1200,
        chunkOverlap: 200,
        minChunkSize: 100,
        separators: ['\n# ', '\n## ', '\n### ', '\n\n', '\n', '. '],
        preserveFormatting: true,
        recommendedFor: ['text/markdown'],
        tags: ['markdown', 'hierarchical', 'structured']
      },
      {
        name: 'Large Document',
        description: 'Optimized for large documents',
        strategy: 'semantic',
        maxChunkSize: 1500,
        chunkOverlap: 250,
        minChunkSize: 200,
        preserveFormatting: true,
        recommendedFor: ['text/plain', 'text/markdown'],
        tags: ['large', 'efficient', 'balanced']
      }
    ]

    defaultTemplates.forEach(template => {
      this.createTemplate(template)
    })
  }
}
