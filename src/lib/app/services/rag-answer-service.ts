/**
 * RAG Answer Service
 * 
 * Integrates RAG retrieval with answer generation in chat workflows.
 * Handles evidence packing, context assembly, and citation formatting.
 */

import { RetrievalQuery, RetrievalResult, EvidencePack, IndexedChunk } from '../types'
import { vectorRetrievalService } from './retrieval-service'
import { fullTextSearchService } from './fulltext-search'
import { fusionService } from './fusion'
import { evidencePackService, EvidencePackConfig } from './evidence-pack'
import { retrievalPolicyService } from './retrieval-policy'
import { VectorIndex } from '../types'

export interface RAGAnswerConfig {
  enabled: boolean
  searchType: 'vector' | 'fulltext' | 'hybrid'
  topK: number
  similarityThreshold?: number
  evidenceConfig: EvidencePackConfig
  policyIds?: string[]
  includeCitations: boolean
  citationFormat: 'apa' | 'mla' | 'chicago' | 'harvard' | 'vancouver' | 'ieee'
  maxContextTokens: number
  minEvidenceChunks: number
}

export interface RAGAnswerRequest {
  query: string
  conversationId?: string
  config?: Partial<RAGAnswerConfig>
  context?: {
    previousMessages?: Array<{ role: string; content: string }>
    systemPrompt?: string
    userPreferences?: Record<string, any>
  }
}

export interface RAGAnswerResult {
  success: boolean
  query: string
  evidence: EvidencePack
  context: string
  citations: CitationData[]
  metadata: RAGAnswerMetadata
  error?: string
}

export interface CitationData {
  chunkId: string
  citation: string
  source: {
    documentId: string
    sourceLabel: string
    title: string
    authors: string
    date: string
    url: string
  }
  sectionPath: string[]
  score?: number
}

export interface RAGAnswerMetadata {
  retrievalTime: number
  evidencePackingTime: number
  totalTime: number
  chunksRetrieved: number
  chunksUsed: number
  tokensUsed: number
  citationsGenerated: number
  searchType: string
  policiesApplied: string[]
  indexVersion: string
}

export class RAGAnswerService {
  private defaultConfig: RAGAnswerConfig = {
    enabled: true,
    searchType: 'hybrid',
    topK: 10,
    similarityThreshold: 0.1,
    evidenceConfig: evidencePackService.getDefaultConfig(),
    includeCitations: true,
    citationFormat: 'apa',
    maxContextTokens: 4000,
    minEvidenceChunks: 2
  }

  /**
   * Generate RAG-enhanced answer
   */
  async generateAnswer(request: RAGAnswerRequest): Promise<RAGAnswerResult> {
    const startTime = Date.now()
    
    try {
      // Merge config with defaults
      const config = { ...this.defaultConfig, ...request.config }
      
      if (!config.enabled) {
        return {
          success: false,
          query: request.query,
          evidence: { chunks: [], totalTokens: 0, query: request.query, indexVersion: 'none', packedAt: new Date() },
          context: '',
          citations: [],
          metadata: {
            retrievalTime: 0,
            evidencePackingTime: 0,
            totalTime: 0,
            chunksRetrieved: 0,
            chunksUsed: 0,
            tokensUsed: 0,
            citationsGenerated: 0,
            searchType: 'disabled',
            policiesApplied: [],
            indexVersion: 'none'
          },
          error: 'RAG is disabled'
        }
      }

      // Step 1: Retrieve relevant documents
      const retrievalStart = Date.now()
      const retrievalResult = await this.retrieveDocuments(request.query, config)
      const retrievalTime = Date.now() - retrievalStart

      if (retrievalResult.chunks.length === 0) {
        return {
          success: false,
          query: request.query,
          evidence: { chunks: [], totalTokens: 0, query: request.query, indexVersion: 'none', packedAt: new Date() },
          context: '',
          citations: [],
          metadata: {
            retrievalTime,
            evidencePackingTime: 0,
            totalTime: Date.now() - startTime,
            chunksRetrieved: 0,
            chunksUsed: 0,
            tokensUsed: 0,
            citationsGenerated: 0,
            searchType: config.searchType,
            policiesApplied: [],
            indexVersion: 'none'
          },
          error: 'No relevant documents found'
        }
      }

      // Step 2: Apply retrieval policies
      const policyStart = Date.now()
      let filteredChunks = retrievalResult.chunks
      let appliedPolicies: string[] = []

      if (config.policyIds && config.policyIds.length > 0) {
        const policyResult = await retrievalPolicyService.applyPolicies(
          filteredChunks,
          { query: request.query, topK: config.topK },
          config.policyIds
        )
        filteredChunks = policyResult.chunks
        appliedPolicies = policyResult.results.map(r => r.policyName)
      }
      const policyTime = Date.now() - policyStart

      // Step 3: Pack evidence
      const evidenceStart = Date.now()
      const evidencePack = await evidencePackService.packEvidence(
        filteredChunks,
        { query: request.query, topK: config.topK },
        config.evidenceConfig
      )
      const evidenceTime = Date.now() - evidenceStart

      // Check minimum evidence requirement
      if (evidencePack.chunks.length < config.minEvidenceChunks) {
        return {
          success: false,
          query: request.query,
          evidence: evidencePack,
          context: '',
          citations: [],
          metadata: {
            retrievalTime: retrievalTime + policyTime,
            evidencePackingTime: evidenceTime,
            totalTime: Date.now() - startTime,
            chunksRetrieved: retrievalResult.chunks.length,
            chunksUsed: evidencePack.chunks.length,
            tokensUsed: evidencePack.totalTokens,
            citationsGenerated: 0,
            searchType: config.searchType,
            policiesApplied: appliedPolicies,
            indexVersion: retrievalResult.indexVersion
          },
          error: `Insufficient evidence: found ${evidencePack.chunks.length} chunks, minimum required is ${config.minEvidenceChunks}`
        }
      }

      // Step 4: Assemble context
      const context = this.assembleContext(evidencePack, request.context)

      // Step 5: Generate citations
      const citations = config.includeCitations 
        ? this.generateCitations(evidencePack.chunks, config.citationFormat)
        : []

      const totalTime = Date.now() - startTime

      return {
        success: true,
        query: request.query,
        evidence: evidencePack,
        context,
        citations,
        metadata: {
          retrievalTime: retrievalTime + policyTime,
          evidencePackingTime: evidenceTime,
          totalTime,
          chunksRetrieved: retrievalResult.chunks.length,
          chunksUsed: evidencePack.chunks.length,
          tokensUsed: evidencePack.totalTokens,
          citationsGenerated: citations.length,
          searchType: config.searchType,
          policiesApplied: appliedPolicies,
          indexVersion: retrievalResult.indexVersion
        }
      }

    } catch (error) {
      return {
        success: false,
        query: request.query,
        evidence: { chunks: [], totalTokens: 0, query: request.query, indexVersion: 'error', packedAt: new Date() },
        context: '',
        citations: [],
        metadata: {
          retrievalTime: 0,
          evidencePackingTime: 0,
          totalTime: Date.now() - startTime,
          chunksRetrieved: 0,
          chunksUsed: 0,
          tokensUsed: 0,
          citationsGenerated: 0,
          searchType: 'error',
          policiesApplied: [],
          indexVersion: 'error'
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Retrieve documents using specified search type
   */
  private async retrieveDocuments(query: string, config: RAGAnswerConfig): Promise<RetrievalResult> {
    const retrievalQuery: RetrievalQuery = {
      query,
      topK: config.topK,
      similarityThreshold: config.similarityThreshold,
      rerank: true,
      includeMetadata: true
    }

    // Get default index (in real implementation, this would come from conversation/user settings)
    const index = await this.getDefaultIndex()

    switch (config.searchType) {
      case 'vector':
        return await vectorRetrievalService.search(retrievalQuery, index)
      
      case 'fulltext':
        return await fullTextSearchService.search(retrievalQuery, index)
      
      case 'hybrid':
        const fusionConfig = fusionService.getDefaultConfig()
        fusionConfig.topK = config.topK
        return await fusionService.hybridSearch(retrievalQuery, index, fusionConfig)
      
      default:
        throw new Error(`Unsupported search type: ${config.searchType}`)
    }
  }

  /**
   * Assemble context from evidence pack
   */
  private assembleContext(evidencePack: EvidencePack, requestContext?: RAGAnswerRequest['context']): string {
    let context = ''

    // Add system prompt if provided
    if (requestContext?.systemPrompt) {
      context += `System: ${requestContext.systemPrompt}\n\n`
    }

    // Add conversation context if provided
    if (requestContext?.previousMessages && requestContext.previousMessages.length > 0) {
      context += 'Previous conversation:\n'
      requestContext.previousMessages.forEach(msg => {
        context += `${msg.role}: ${msg.content}\n`
      })
      context += '\n'
    }

    // Add evidence
    context += 'Relevant information:\n'
    evidencePack.chunks.forEach((chunk, index) => {
      context += `[${index + 1}] ${chunk.text}\n`
      context += `Source: ${chunk.sourceLabel}\n`
      if (chunk.sectionPath && chunk.sectionPath.length > 0) {
        context += `Section: ${chunk.sectionPath.join(' > ')}\n`
      }
      context += '\n'
    })

    return context
  }

  /**
   * Generate citations from evidence chunks
   */
  private generateCitations(chunks: IndexedChunk[], format: string): CitationData[] {
    return chunks.map((chunk, index) => {
      const citation = this.formatCitation(chunk, format)
      
      return {
        chunkId: chunk.chunkId,
        citation,
        source: {
          documentId: chunk.documentId,
          sourceLabel: chunk.sourceLabel,
          title: this.extractTitle(chunk),
          authors: this.extractAuthors(chunk),
          date: this.extractDate(chunk),
          url: this.extractUrl(chunk)
        },
        sectionPath: chunk.sectionPath,
        score: chunk.score
      }
    })
  }

  /**
   * Format citation in specified style
   */
  private formatCitation(chunk: IndexedChunk, format: string): string {
    const authors = this.extractAuthors(chunk)
    const title = this.extractTitle(chunk)
    const date = this.extractDate(chunk)
    const source = this.extractSource(chunk)

    switch (format) {
      case 'apa':
        return `${authors} (${date}). *${title}*. ${source}.`
      
      case 'mla':
        return `${authors}. "${title}." *${source}*, ${date}.`
      
      case 'chicago':
        return `${authors}. "${title}." ${source}, ${date}.`
      
      case 'harvard':
        return `${authors} (${date}) ${title}. ${source}.`
      
      case 'ieee':
        return `[${1}] ${authors}, "${title}," ${source}, ${date}.`
      
      default:
        return `${authors} (${date}). ${title}. ${source}.`
    }
  }

  /**
   * Extract title from chunk metadata
   */
  private extractTitle(chunk: IndexedChunk): string {
    return (chunk.metadata?.title as string) || 
           chunk.sourceLabel.split(' ')[0] || 
           'Untitled Document'
  }

  /**
   * Extract authors from chunk metadata
   */
  private extractAuthors(chunk: IndexedChunk): string {
    const authors = chunk.metadata?.authors as string | string[]
    if (Array.isArray(authors)) {
      return authors.join(', ')
    }
    return authors || 'Unknown Author'
  }

  /**
   * Extract date from chunk metadata
   */
  private extractDate(chunk: IndexedChunk): string {
    return (chunk.metadata?.date as string) || 
           chunk.metadata?.year?.toString() || 
           chunk.createdAt.getFullYear().toString()
  }

  /**
   * Extract source from chunk metadata
   */
  private extractSource(chunk: IndexedChunk): string {
    return (chunk.metadata?.source as string) || 
           (chunk.metadata?.journal as string) || 
           chunk.sourceLabel
  }

  /**
   * Extract URL from chunk metadata
   */
  private extractUrl(chunk: IndexedChunk): string {
    return (chunk.metadata?.url as string) || 
           (chunk.metadata?.doi ? `https://doi.org/${chunk.metadata.doi}` : '') ||
           ''
  }

  /**
   * Get default index for retrieval
   */
  private async getDefaultIndex(): Promise<VectorIndex> {
    // Mock implementation - in real implementation this would come from database
    return {
      id: 'default-index',
      name: 'Default Document Index',
      type: 'hybrid',
      config: {
        indexType: 'hybrid',
        vectorIndexConfig: {
          metric: 'cosine',
          ivfLists: 100,
          pq: 64
        },
        keywordIndexConfig: {
          analyzer: 'standard',
          stopwords: true
        }
      },
      currentVersion: {
        version: '1.0.0',
        embeddingModel: 'nomic-embed-text',
        chunkingPolicy: {
          strategy: 'semantic',
          maxChunkSize: 1000,
          chunkOverlap: 200
        },
        indexingOptions: {
          indexType: 'hybrid'
        },
        createdAt: new Date(),
        chunkCount: 1000,
        status: 'ready',
        metadata: {}
      },
      versions: [],
      status: 'ready',
      chunkCount: 1000,
      sizeBytes: 1000000,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    }
  }

  /**
   * Get RAG configuration for different use cases
   */
  getConfigForUseCase(useCase: 'qa' | 'research' | 'creative'): Partial<RAGAnswerConfig> {
    switch (useCase) {
      case 'qa':
        return {
          searchType: 'hybrid',
          topK: 8,
          similarityThreshold: 0.2,
          evidenceConfig: evidencePackService.getConfigForUseCase('qa'),
          minEvidenceChunks: 2
        }
      
      case 'research':
        return {
          searchType: 'hybrid',
          topK: 15,
          similarityThreshold: 0.05,
          evidenceConfig: evidencePackService.getConfigForUseCase('research'),
          minEvidenceChunks: 3,
          includeCitations: true,
          citationFormat: 'apa'
        }
      
      case 'creative':
        return {
          searchType: 'vector',
          topK: 5,
          similarityThreshold: 0.3,
          evidenceConfig: evidencePackService.getConfigForUseCase('summarization'),
          minEvidenceChunks: 1,
          includeCitations: false
        }
      
      default:
        return {}
    }
  }

  /**
   * Validate RAG answer request
   */
  validateRequest(request: RAGAnswerRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!request.query || request.query.trim().length === 0) {
      errors.push('Query is required')
    }

    if (request.query.length > 1000) {
      errors.push('Query is too long (max 1000 characters)')
    }

    if (request.config?.topK && (request.config.topK < 1 || request.config.topK > 100)) {
      errors.push('topK must be between 1 and 100')
    }

    if (request.config?.similarityThreshold && 
        (request.config.similarityThreshold < 0 || request.config.similarityThreshold > 1)) {
      errors.push('similarityThreshold must be between 0 and 1')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// Singleton instance
export const ragAnswerService = new RAGAnswerService()
