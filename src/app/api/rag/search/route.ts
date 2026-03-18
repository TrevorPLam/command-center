/**
 * RAG Search API Route
 * 
 * Handles search requests for documents using vector, full-text, or hybrid search.
 * Supports different search strategies and filtering options.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { vectorRetrievalService } from '@/lib/app/rag/retrieval-service'
import { fullTextSearchService } from '@/lib/app/rag/fulltext-search'
import { fusionService, FusionConfig } from '@/lib/app/rag/fusion'
import { RetrievalQuery, VectorIndex } from '@/lib/app/rag/types'

// Search request schema
const SearchRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  searchType: z.enum(['vector', 'fulltext', 'hybrid']).default('hybrid'),
  topK: z.number().min(1).max(100).default(10),
  similarityThreshold: z.number().min(0).max(1).optional(),
  filters: z.record(z.any()).optional(),
  rerank: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
  fusionConfig: z.object({
    strategy: z.enum(['reciprocal_rank', 'weighted_score', 'condensed_list', 'interleaved', 'best_of_k']).optional(),
    vectorWeight: z.number().min(0).max(1).optional(),
    textWeight: z.number().min(0).max(1).optional(),
    k: z.number().min(1).optional(),
    topK: z.number().min(1).max(100).optional(),
    minScore: z.number().min(0).max(1).optional()
  }).optional()
})

// GET /api/rag/search - Perform search
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const searchRequest = SearchRequestSchema.parse({
      query: searchParams.get('query'),
      searchType: searchParams.get('searchType') || 'hybrid',
      topK: parseInt(searchParams.get('topK') || '10'),
      similarityThreshold: searchParams.get('similarityThreshold') ? 
        parseFloat(searchParams.get('similarityThreshold')!) : undefined,
      rerank: searchParams.get('rerank') === 'true',
      includeMetadata: searchParams.get('includeMetadata') !== 'false',
      filters: searchParams.get('filters') ? 
        JSON.parse(searchParams.get('filters')!) : undefined,
      fusionConfig: searchParams.get('fusionConfig') ? 
        JSON.parse(searchParams.get('fusionConfig')!) : undefined
    })

    return handleSearch(searchRequest)

  } catch (error) {
    console.error('Search API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/rag/search - Perform search with POST body
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const searchRequest = SearchRequestSchema.parse(body)

    return handleSearch(searchRequest)

  } catch (error) {
    console.error('Search API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle search request
 */
async function handleSearch(searchRequest: z.infer<typeof SearchRequestSchema>) {
  try {
    // Get the index to search (for now, use a default index)
    // In a real implementation, this would be determined by the request or user preferences
    const index: VectorIndex = await getDefaultIndex()

    // Build retrieval query
    const retrievalQuery: RetrievalQuery = {
      query: searchRequest.query,
      topK: searchRequest.topK,
      similarityThreshold: searchRequest.similarityThreshold,
      filters: searchRequest.filters,
      rerank: searchRequest.rerank,
      includeMetadata: searchRequest.includeMetadata
    }

    let result

    // Perform search based on type
    switch (searchRequest.searchType) {
      case 'vector':
        result = await vectorRetrievalService.search(retrievalQuery, index)
        break
      
      case 'fulltext':
        result = await fullTextSearchService.search(retrievalQuery, index)
        break
      
      case 'hybrid':
        // Get fusion config
        const fusionConfig: FusionConfig = searchRequest.fusionConfig ? 
          { ...fusionService.getDefaultConfig(), ...searchRequest.fusionConfig } :
          fusionService.getDefaultConfig()

        // Get recommended strategy if not specified
        if (!fusionConfig.strategy) {
          fusionConfig.strategy = fusionService.getRecommendedStrategy(searchRequest.query)
        }

        result = await fusionService.hybridSearch(retrievalQuery, index, fusionConfig)
        break
      
      default:
        throw new Error(`Unsupported search type: ${searchRequest.searchType}`)
    }

    // Format response
    const response = {
      success: true,
      query: searchRequest.query,
      searchType: searchRequest.searchType,
      results: {
        chunks: result.chunks.map(chunk => ({
          id: chunk.chunkId,
          documentId: chunk.documentId,
          sectionPath: chunk.sectionPath,
          text: chunk.text,
          metadata: searchRequest.includeMetadata ? chunk.metadata : undefined,
          score: chunk.score,
          rerankScore: chunk.rerankScore,
          sourceLabel: chunk.sourceLabel,
          citationLabel: chunk.citationLabel
        })),
        totalResults: result.totalResults,
        queryTime: result.queryTime,
        indexVersion: result.indexVersion,
        metadata: result.metadata
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Search failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}

/**
 * Get default index for search
 * In a real implementation, this would come from user preferences or request parameters
 */
async function getDefaultIndex(): Promise<VectorIndex> {
  // Mock index - in real implementation this would come from the database
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

// OPTIONS /api/rag/search - CORS support
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
