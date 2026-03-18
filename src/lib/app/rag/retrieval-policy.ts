/**
 * Retrieval Policy Service
 * 
 * Manages retrieval policies, filtering rules, and access controls.
 * Handles trust labels, allowlists, and content filtering.
 */

import { RetrievalQuery, IndexedChunk, DocumentContentType } from '../types'

export interface RetrievalPolicy {
  id: string
  name: string
  description: string
  enabled: boolean
  priority: number
  rules: RetrievalRule[]
  metadataFilters: MetadataFilter[]
  trustFilters: TrustFilter[]
  contentFilters: ContentFilter[]
  createdAt: Date
  updatedAt: Date
}

export interface RetrievalRule {
  id: string
  type: 'include' | 'exclude' | 'transform' | 'boost'
  condition: RuleCondition
  action: RuleAction
  priority: number
}

export interface RuleCondition {
  field: string
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'in' | 'not_in' | 'gt' | 'lt' | 'gte' | 'lte'
  value: any
  caseSensitive?: boolean
}

export interface RuleAction {
  type: 'filter' | 'modify' | 'boost' | 'penalize'
  parameters?: Record<string, any>
}

export interface MetadataFilter {
  field: string
  operator: 'equals' | 'contains' | 'in' | 'not_in' | 'exists' | 'not_exists' | 'range'
  value?: any
  required?: boolean
}

export interface TrustFilter {
  type: 'source_trust' | 'content_trust' | 'author_trust' | 'date_trust'
  level: 'high' | 'medium' | 'low' | 'block'
  criteria: TrustCriteria
}

export interface TrustCriteria {
  allowlist?: string[]
  blocklist?: string[]
  minDate?: Date
  maxDate?: Date
  requiredAttributes?: string[]
}

export interface ContentFilter {
  type: 'language' | 'quality' | 'length' | 'format' | 'safety'
  criteria: ContentCriteria
}

export interface ContentCriteria {
  minLength?: number
  maxLength?: number
  languages?: string[]
  qualityThreshold?: number
  safetyLevel?: 'strict' | 'moderate' | 'permissive'
  allowedFormats?: string[]
}

export interface PolicyEvaluationResult {
  policyId: string
  policyName: string
  originalCount: number
  filteredCount: number
  blockedCount: number
  boostedCount: number
  modifiedCount: number
  appliedRules: string[]
  executionTime: number
}

export class RetrievalPolicyService {
  private policies: Map<string, RetrievalPolicy> = new Map()
  private defaultPolicy: RetrievalPolicy

  constructor() {
    this.initializeDefaultPolicies()
  }

  /**
   * Initialize default policies
   */
  private initializeDefaultPolicies(): void {
    // Default policy for general use
    this.defaultPolicy = {
      id: 'default',
      name: 'Default Retrieval Policy',
      description: 'Standard policy for general document retrieval',
      enabled: true,
      priority: 0,
      rules: [
        {
          id: 'boost-recent',
          type: 'boost',
          condition: {
            field: 'createdAt',
            operator: 'gte',
            value: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last year
          },
          action: {
            type: 'boost',
            parameters: { factor: 1.2 }
          },
          priority: 1
        }
      ],
      metadataFilters: [
        {
          field: 'contentType',
          operator: 'in',
          value: ['text/plain', 'text/markdown', 'application/pdf'],
          required: true
        }
      ],
      trustFilters: [
        {
          type: 'date_trust',
          level: 'medium',
          criteria: {
            minDate: new Date(2000, 0, 1)
          }
        }
      ],
      contentFilters: [
        {
          type: 'length',
          criteria: {
            minLength: 50,
            maxLength: 10000
          }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.policies.set('default', this.defaultPolicy)

    // Add specialized policies
    this.addPolicy(this.createAcademicPolicy())
    this.addPolicy(this.createCorporatePolicy())
    this.addPolicy(this.createSafetyPolicy())
  }

  /**
   * Apply policies to retrieved chunks
   */
  async applyPolicies(
    chunks: IndexedChunk[],
    query: RetrievalQuery,
    policyIds?: string[]
  ): Promise<{ chunks: IndexedChunk[], results: PolicyEvaluationResult[] }> {
    const startTime = Date.now()
    const results: PolicyEvaluationResult[] = []
    let processedChunks = [...chunks]

    // Get policies to apply
    const policies = policyIds 
      ? this.getPoliciesByIds(policyIds)
      : [this.defaultPolicy]

    // Apply each policy in priority order
    for (const policy of policies.sort((a, b) => a.priority - b.priority)) {
      if (!policy.enabled) continue

      const result = await this.applySinglePolicy(processedChunks, query, policy)
      processedChunks = result.chunks
      results.push(result.evaluation)
    }

    return {
      chunks: processedChunks,
      results
    }
  }

  /**
   * Apply a single policy
   */
  private async applySinglePolicy(
    chunks: IndexedChunk[],
    query: RetrievalQuery,
    policy: RetrievalPolicy
  ): Promise<{ chunks: IndexedChunk[], evaluation: PolicyEvaluationResult }> {
    const startTime = Date.now()
    let processedChunks = [...chunks]
    const appliedRules: string[] = []

    // Apply metadata filters
    const metadataResult = this.applyMetadataFilters(processedChunks, policy.metadataFilters)
    processedChunks = metadataResult.chunks
    if (metadataResult.filtered > 0) {
      appliedRules.push(`metadata_filters: ${metadataResult.filtered}`)
    }

    // Apply trust filters
    const trustResult = this.applyTrustFilters(processedChunks, policy.trustFilters)
    processedChunks = trustResult.chunks
    if (trustResult.blocked > 0) {
      appliedRules.push(`trust_filters: ${trustResult.blocked} blocked`)
    }

    // Apply content filters
    const contentResult = this.applyContentFilters(processedChunks, policy.contentFilters)
    processedChunks = contentResult.chunks
    if (contentResult.filtered > 0) {
      appliedRules.push(`content_filters: ${contentResult.filtered}`)
    }

    // Apply rules
    const ruleResult = this.applyRules(processedChunks, policy.rules)
    processedChunks = ruleResult.chunks
    appliedRules.push(...ruleResult.appliedRules)

    const executionTime = Date.now() - startTime

    const evaluation: PolicyEvaluationResult = {
      policyId: policy.id,
      policyName: policy.name,
      originalCount: chunks.length,
      filteredCount: chunks.length - processedChunks.length,
      blockedCount: trustResult.blocked,
      boostedCount: ruleResult.boosted,
      modifiedCount: ruleResult.modified,
      appliedRules,
      executionTime
    }

    return { chunks: processedChunks, evaluation }
  }

  /**
   * Apply metadata filters
   */
  private applyMetadataFilters(
    chunks: IndexedChunk[],
    filters: MetadataFilter[]
  ): { chunks: IndexedChunk[], filtered: number } {
    let filtered = 0

    const filteredChunks = chunks.filter(chunk => {
      for (const filter of filters) {
        if (!this.matchesMetadataFilter(chunk, filter)) {
          if (filter.required) {
            filtered++
            return false
          }
        }
      }
      return true
    })

    return { chunks: filteredChunks, filtered }
  }

  /**
   * Apply trust filters
   */
  private applyTrustFilters(
    chunks: IndexedChunk[],
    filters: TrustFilter[]
  ): { chunks: IndexedChunk[], blocked: number } {
    let blocked = 0

    const filteredChunks = chunks.filter(chunk => {
      for (const filter of filters) {
        if (!this.matchesTrustFilter(chunk, filter)) {
          if (filter.level === 'block') {
            blocked++
            return false
          }
        }
      }
      return true
    })

    return { chunks: filteredChunks, blocked }
  }

  /**
   * Apply content filters
   */
  private applyContentFilters(
    chunks: IndexedChunk[],
    filters: ContentFilter[]
  ): { chunks: IndexedChunk[], filtered: number } {
    let filtered = 0

    const filteredChunks = chunks.filter(chunk => {
      for (const filter of filters) {
        if (!this.matchesContentFilter(chunk, filter)) {
          filtered++
          return false
        }
      }
      return true
    })

    return { chunks: filteredChunks, filtered }
  }

  /**
   * Apply rules
   */
  private applyRules(
    chunks: IndexedChunk[],
    rules: RetrievalRule[]
  ): { chunks: IndexedChunk[], boosted: number, modified: number, appliedRules: string[] } {
    let boosted = 0
    let modified = 0
    const appliedRules: string[] = []

    const processedChunks = chunks.map(chunk => {
      let modifiedChunk = { ...chunk }

      for (const rule of rules.sort((a, b) => a.priority - b.priority)) {
        if (this.matchesRuleCondition(modifiedChunk, rule.condition)) {
          switch (rule.type) {
            case 'include':
              // Keep the chunk (default behavior)
              break
            
            case 'exclude':
              return null as any // Exclude this chunk
            
            case 'transform':
              modifiedChunk = this.applyTransform(modifiedChunk, rule.action)
              modified++
              appliedRules.push(`transform: ${rule.id}`)
              break
            
            case 'boost':
              modifiedChunk = this.applyBoost(modifiedChunk, rule.action)
              boosted++
              appliedRules.push(`boost: ${rule.id}`)
              break
          }
        }
      }

      return modifiedChunk
    }).filter(Boolean) as IndexedChunk[]

    return { chunks: processedChunks, boosted, modified, appliedRules }
  }

  /**
   * Check if chunk matches metadata filter
   */
  private matchesMetadataFilter(chunk: IndexedChunk, filter: MetadataFilter): boolean {
    const value = this.getNestedValue(chunk.metadata, filter.field)
    
    switch (filter.operator) {
      case 'equals':
        return value === filter.value
      case 'contains':
        return typeof value === 'string' && value.includes(filter.value)
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(value)
      case 'not_in':
        return !Array.isArray(filter.value) || !filter.value.includes(value)
      case 'exists':
        return value !== undefined && value !== null
      case 'not_exists':
        return value === undefined || value === null
      case 'range':
        if (typeof filter.value === 'object' && filter.value !== null) {
          const { min, max } = filter.value
          return (min === undefined || value >= min) && 
                 (max === undefined || value <= max)
        }
        return false
      default:
        return true
    }
  }

  /**
   * Check if chunk matches trust filter
   */
  private matchesTrustFilter(chunk: IndexedChunk, filter: TrustFilter): boolean {
    switch (filter.type) {
      case 'source_trust':
        return this.checkSourceTrust(chunk, filter)
      case 'content_trust':
        return this.checkContentTrust(chunk, filter)
      case 'author_trust':
        return this.checkAuthorTrust(chunk, filter)
      case 'date_trust':
        return this.checkDateTrust(chunk, filter)
      default:
        return true
    }
  }

  /**
   * Check if chunk matches content filter
   */
  private matchesContentFilter(chunk: IndexedChunk, filter: ContentFilter): boolean {
    switch (filter.type) {
      case 'length':
        return this.checkLengthFilter(chunk, filter.criteria)
      case 'language':
        return this.checkLanguageFilter(chunk, filter.criteria)
      case 'quality':
        return this.checkQualityFilter(chunk, filter.criteria)
      case 'format':
        return this.checkFormatFilter(chunk, filter.criteria)
      case 'safety':
        return this.checkSafetyFilter(chunk, filter.criteria)
      default:
        return true
    }
  }

  /**
   * Check if chunk matches rule condition
   */
  private matchesRuleCondition(chunk: IndexedChunk, condition: RuleCondition): boolean {
    const value = this.getNestedValue(chunk, condition.field)
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value
      case 'contains':
        return typeof value === 'string' && 
               value.includes(condition.value) &&
               (condition.caseSensitive !== false || 
                value.toLowerCase().includes(condition.value.toLowerCase()))
      case 'starts_with':
        return typeof value === 'string' && 
               value.startsWith(condition.value) &&
               (condition.caseSensitive !== false || 
                value.toLowerCase().startsWith(condition.value.toLowerCase()))
      case 'ends_with':
        return typeof value === 'string' && 
               value.endsWith(condition.value) &&
               (condition.caseSensitive !== false || 
                value.toLowerCase().endsWith(condition.value.toLowerCase()))
      case 'regex':
        const regex = new RegExp(condition.value, condition.caseSensitive === false ? 'i' : '')
        return regex.test(String(value))
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value)
      case 'not_in':
        return !Array.isArray(condition.value) || !condition.value.includes(value)
      case 'gt':
        return typeof value === 'number' && value > condition.value
      case 'lt':
        return typeof value === 'number' && value < condition.value
      case 'gte':
        return typeof value === 'number' && value >= condition.value
      case 'lte':
        return typeof value === 'number' && value <= condition.value
      default:
        return true
    }
  }

  /**
   * Apply transform action
   */
  private applyTransform(chunk: IndexedChunk, action: RuleAction): IndexedChunk {
    if (action.type === 'modify' && action.parameters) {
      // Apply modifications based on parameters
      const modified = { ...chunk }
      
      if (action.parameters.redact) {
        modified.text = this.redactText(modified.text, action.parameters.redact)
      }
      
      if (action.parameters.sanitize) {
        modified.text = this.sanitizeText(modified.text)
      }
      
      return modified
    }
    
    return chunk
  }

  /**
   * Apply boost action
   */
  private applyBoost(chunk: IndexedChunk, action: RuleAction): IndexedChunk {
    if (action.type === 'boost' && action.parameters?.factor) {
      const boosted = { ...chunk }
      boosted.score = (boosted.score || 0) * action.parameters.factor
      return boosted
    }
    
    return chunk
  }

  // Helper methods for specific filter types
  private checkSourceTrust(chunk: IndexedChunk, filter: TrustFilter): boolean {
    const source = chunk.metadata?.source as string
    if (!source) return filter.level !== 'high'
    
    if (filter.criteria.allowlist && !filter.criteria.allowlist.includes(source)) {
      return filter.level !== 'block'
    }
    
    if (filter.criteria.blocklist && filter.criteria.blocklist.includes(source)) {
      return false
    }
    
    return true
  }

  private checkDateTrust(chunk: IndexedChunk, filter: TrustFilter): boolean {
    const date = new Date(chunk.metadata?.date as string || chunk.createdAt)
    
    if (filter.criteria.minDate && date < filter.criteria.minDate) {
      return false
    }
    
    if (filter.criteria.maxDate && date > filter.criteria.maxDate) {
      return false
    }
    
    return true
  }

  private checkLengthFilter(chunk: IndexedChunk, criteria: ContentCriteria): boolean {
    const length = chunk.text.length
    
    if (criteria.minLength && length < criteria.minLength) return false
    if (criteria.maxLength && length > criteria.maxLength) return false
    
    return true
  }

  private checkLanguageFilter(chunk: IndexedChunk, criteria: ContentCriteria): boolean {
    // Mock language detection - in real implementation use a language detection library
    if (!criteria.languages || criteria.languages.length === 0) return true
    
    // Assume English for now
    return criteria.languages.includes('en')
  }

  private checkQualityFilter(chunk: IndexedChunk, criteria: ContentCriteria): boolean {
    // Mock quality assessment - in real implementation use quality metrics
    if (!criteria.qualityThreshold) return true
    
    // Simple heuristic: longer text with more unique words is higher quality
    const uniqueWords = new Set(chunk.text.toLowerCase().split(/\s+/)).size
    const quality = Math.min(uniqueWords / 10, 1) // Normalized 0-1
    
    return quality >= criteria.qualityThreshold
  }

  private checkFormatFilter(chunk: IndexedChunk, criteria: ContentCriteria): boolean {
    if (!criteria.allowedFormats || criteria.allowedFormats.length === 0) return true
    
    const contentType = chunk.metadata?.contentType as DocumentContentType
    return criteria.allowedFormats.includes(contentType)
  }

  private checkSafetyFilter(chunk: IndexedChunk, criteria: ContentCriteria): boolean {
    // Mock safety check - in real implementation use content safety APIs
    if (criteria.safetyLevel === 'permissive') return true
    
    // Simple heuristic for potentially unsafe content
    const unsafePatterns = [
      /\b(password|secret|key|token)\b/i,
      /\b(virus|malware|hack)\b/i,
      /\b(illegal|criminal|fraud)\b/i
    ]
    
    const hasUnsafeContent = unsafePatterns.some(pattern => pattern.test(chunk.text))
    
    if (criteria.safetyLevel === 'strict' && hasUnsafeContent) return false
    if (criteria.safetyLevel === 'moderate' && hasUnsafeContent) return false // Could be more nuanced
    
    return true
  }

  private checkContentTrust(chunk: IndexedChunk, filter: TrustFilter): boolean {
    // Mock content trust assessment
    return true
  }

  private checkAuthorTrust(chunk: IndexedChunk, filter: TrustFilter): boolean {
    const author = chunk.metadata?.author as string
    if (!author) return filter.level !== 'high'
    
    if (filter.criteria.allowlist && !filter.criteria.allowlist.includes(author)) {
      return filter.level !== 'block'
    }
    
    if (filter.criteria.blocklist && filter.criteria.blocklist.includes(author)) {
      return false
    }
    
    return true
  }

  private redactText(text: string, patterns: string[]): string {
    let redacted = text
    patterns.forEach(pattern => {
      const regex = new RegExp(pattern, 'gi')
      redacted = redacted.replace(regex, '[REDACTED]')
    })
    return redacted
  }

  private sanitizeText(text: string): string {
    // Basic sanitization - remove potentially harmful content
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .trim()
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  // Policy management methods
  addPolicy(policy: RetrievalPolicy): void {
    this.policies.set(policy.id, policy)
  }

  getPolicy(id: string): RetrievalPolicy | undefined {
    return this.policies.get(id)
  }

  getPoliciesByIds(ids: string[]): RetrievalPolicy[] {
    return ids.map(id => this.getPolicy(id)).filter(Boolean) as RetrievalPolicy[]
  }

  getAllPolicies(): RetrievalPolicy[] {
    return Array.from(this.policies.values())
  }

  updatePolicy(id: string, updates: Partial<RetrievalPolicy>): boolean {
    const policy = this.policies.get(id)
    if (!policy) return false

    const updatedPolicy = { ...policy, ...updates, updatedAt: new Date() }
    this.policies.set(id, updatedPolicy)
    return true
  }

  deletePolicy(id: string): boolean {
    if (id === 'default') return false // Cannot delete default policy
    return this.policies.delete(id)
  }

  // Predefined policy creators
  private createAcademicPolicy(): RetrievalPolicy {
    return {
      id: 'academic',
      name: 'Academic Research Policy',
      description: 'Policy optimized for academic and research content',
      enabled: true,
      priority: 10,
      rules: [
        {
          id: 'boost-peer-reviewed',
          type: 'boost',
          condition: {
            field: 'metadata.peerReviewed',
            operator: 'equals',
            value: true
          },
          action: {
            type: 'boost',
            parameters: { factor: 1.5 }
          },
          priority: 1
        }
      ],
      metadataFilters: [
        {
          field: 'contentType',
          operator: 'in',
          value: ['application/pdf', 'text/plain'],
          required: true
        },
        {
          field: 'metadata.academic',
          operator: 'exists',
          required: true
        }
      ],
      trustFilters: [
        {
          type: 'source_trust',
          level: 'high',
          criteria: {
            allowlist: ['arxiv.org', 'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov']
          }
        }
      ],
      contentFilters: [
        {
          type: 'length',
          criteria: {
            minLength: 200,
            maxLength: 50000
          }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private createCorporatePolicy(): RetrievalPolicy {
    return {
      id: 'corporate',
      name: 'Corporate Document Policy',
      description: 'Policy for internal corporate documents',
      enabled: true,
      priority: 20,
      rules: [
        {
          id: 'boost-internal',
          type: 'boost',
          condition: {
            field: 'metadata.internal',
            operator: 'equals',
            value: true
          },
          action: {
            type: 'boost',
            parameters: { factor: 1.3 }
          },
          priority: 1
        }
      ],
      metadataFilters: [
        {
          field: 'metadata.department',
          operator: 'exists',
          required: true
        }
      ],
      trustFilters: [
        {
          type: 'source_trust',
          level: 'high',
          criteria: {
            allowlist: ['internal.company.com', 'sharepoint.company.com']
          }
        }
      ],
      contentFilters: [
        {
          type: 'safety',
          criteria: {
            safetyLevel: 'strict'
          }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  private createSafetyPolicy(): RetrievalPolicy {
    return {
      id: 'safety',
      name: 'Content Safety Policy',
      description: 'Strict policy for safe content retrieval',
      enabled: true,
      priority: 100,
      rules: [],
      metadataFilters: [],
      trustFilters: [
        {
          type: 'content_trust',
          level: 'block',
          criteria: {}
        }
      ],
      contentFilters: [
        {
          type: 'safety',
          criteria: {
            safetyLevel: 'strict'
          }
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
}

// Singleton instance
export const retrievalPolicyService = new RetrievalPolicyService()
