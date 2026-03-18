/**
 * RAG Citations API Route
 * 
 * Handles citation requests for retrieved documents.
 * Supports citation formatting, source inspection, and citation metadata.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { IndexedChunk } from '@/lib/app/rag/types'

// Citation request schema
const CitationRequestSchema = z.object({
  chunkIds: z.array(z.string()).min(1).max(50),
  format: z.enum(['apa', 'mla', 'chicago', 'harvard', 'vancouver', 'ieee']).default('apa'),
  includeMetadata: z.boolean().default(true),
  includePreview: z.boolean().default(true),
  previewLength: z.number().min(50).max(500).default(200)
})

// Citation format configurations
const CITATION_FORMATS = {
  apa: {
    template: '{author}. ({year}). *{title}*. {source}. {url}',
    dateTemplate: 'YYYY-MM-DD',
    titleCase: true
  },
  mla: {
    template: '{author}. "{title}." *{source}*, {date}. {url}',
    dateTemplate: 'DD MMM YYYY',
    titleCase: true
  },
  chicago: {
    template: '{author}. "{title}." {source}, {date}. {url}',
    dateTemplate: 'YYYY',
    titleCase: 'title'
  },
  harvard: {
    template: '{author} ({year}) {title}. {source}. {url}',
    dateTemplate: 'YYYY',
    titleCase: true
  },
  vancouver: {
    template: '{author}. {title}. {source}; {year}. {url}',
    dateTemplate: 'YYYY',
    titleCase: false
  },
  ieee: {
    template: '[{index}] {author}, "{title}," {source}, {date}. {url}',
    dateTemplate: 'YYYY-MM-DD',
    titleCase: false
  }
} as const

// GET /api/rag/citations - Get citations for chunks
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const citationRequest = CitationRequestSchema.parse({
      chunkIds: searchParams.get('chunkIds')?.split(','),
      format: searchParams.get('format') || 'apa',
      includeMetadata: searchParams.get('includeMetadata') !== 'false',
      includePreview: searchParams.get('includePreview') !== 'false',
      previewLength: parseInt(searchParams.get('previewLength') || '200')
    })

    return handleCitations(citationRequest)

  } catch (error) {
    console.error('Citations API error:', error)
    
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

// POST /api/rag/citations - Get citations with POST body
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const citationRequest = CitationRequestSchema.parse(body)

    return handleCitations(citationRequest)

  } catch (error) {
    console.error('Citations API error:', error)
    
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
 * Handle citation request
 */
async function handleCitations(citationRequest: z.infer<typeof CitationRequestSchema>) {
  try {
    // Get chunks by IDs (mock implementation)
    const chunks = await getChunksByIds(citationRequest.chunkIds)

    // Generate citations for each chunk
    const citations = chunks.map((chunk, index) => {
      const citation = generateCitation(chunk, citationRequest.format, index + 1)
      
      return {
        chunkId: chunk.chunkId,
        citation,
        source: {
          documentId: chunk.documentId,
          sourceLabel: chunk.sourceLabel,
          title: extractTitle(chunk),
          authors: extractAuthors(chunk),
          date: extractDate(chunk),
          url: extractUrl(chunk)
        },
        preview: citationRequest.includePreview ? 
          generatePreview(chunk.text, citationRequest.previewLength) : undefined,
        metadata: citationRequest.includeMetadata ? chunk.metadata : undefined,
        sectionPath: chunk.sectionPath,
        score: chunk.score
      }
    })

    // Generate bibliography
    const bibliography = generateBibliography(citations, citationRequest.format)

    const response = {
      success: true,
      format: citationRequest.format,
      citations,
      bibliography,
      metadata: {
        totalCitations: citations.length,
        format: citationRequest.format,
        includePreview: citationRequest.includePreview,
        previewLength: citationRequest.previewLength
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Citation generation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Citation generation failed' },
      { status: 500 }
    )
  }
}

/**
 * Generate citation in specified format
 */
function generateCitation(chunk: IndexedChunk, format: keyof typeof CITATION_FORMATS, index: number): string {
  const formatConfig = CITATION_FORMATS[format]
  
  const citationData = {
    author: extractAuthors(chunk),
    title: extractTitle(chunk),
    source: extractSource(chunk),
    date: formatDate(extractDate(chunk), formatConfig.dateTemplate),
    url: extractUrl(chunk),
    index: index.toString()
  }

  let citation = formatConfig.template

  // Replace placeholders
  Object.entries(citationData).forEach(([key, value]) => {
    const placeholder = `{${key}}`
    citation = citation.replace(new RegExp(placeholder, 'g'), value || '')
  })

  // Apply title case if needed
  if (formatConfig.titleCase === true) {
    citation = toTitleCase(citation)
  } else if (formatConfig.titleCase === 'title') {
    citation = toTitleCase(citation, true)
  }

  return citation
}

/**
 * Generate bibliography from citations
 */
function generateBibliography(citations: any[], format: keyof typeof CITATION_FORMATS): string {
  if (format === 'ieee') {
    // IEEE format uses numbered list
    return citations
      .map(cit => cit.citation)
      .join('\n')
  } else {
    // Other formats use alphabetical order by author
    return citations
      .sort((a, b) => (a.source.authors || '').localeCompare(b.source.authors || ''))
      .map(cit => cit.citation)
      .join('\n')
  }
}

/**
 * Get chunks by IDs (mock implementation)
 */
async function getChunksByIds(chunkIds: string[]): Promise<IndexedChunk[]> {
  // Mock implementation - in real implementation this would query the database
  return chunkIds.map((id, index) => ({
    chunkId: id,
    documentId: `doc-${index}`,
    sectionPath: ['section', 'subsection'],
    text: `This is the text content for chunk ${id}. It contains relevant information that was retrieved during the search process.`,
    metadata: {
      title: `Document ${index + 1}`,
      authors: ['Author One', 'Author Two'],
      date: '2024-01-01',
      source: 'Academic Journal',
      url: `https://example.com/doc-${index}`
    },
    chunkIndex: index,
    tokenCount: 50,
    createdAt: new Date(),
    sourceLabel: `doc-${index}.pdf (${id.substring(0, 8)})`,
    citationLabel: `[${index + 1}]`
  }))
}

/**
 * Extract title from chunk metadata
 */
function extractTitle(chunk: IndexedChunk): string {
  return (chunk.metadata?.title as string) || 
         chunk.sourceLabel.split(' ')[0] || 
         'Untitled Document'
}

/**
 * Extract authors from chunk metadata
 */
function extractAuthors(chunk: IndexedChunk): string {
  const authors = chunk.metadata?.authors as string[]
  if (Array.isArray(authors) && authors.length > 0) {
    if (authors.length === 1) {
      return authors[0]
    } else if (authors.length <= 3) {
      return authors.join(', ')
    } else {
      return authors[0] + ' et al.'
    }
  }
  return 'Unknown Author'
}

/**
 * Extract date from chunk metadata
 */
function extractDate(chunk: IndexedChunk): string {
  return (chunk.metadata?.date as string) || 
         chunk.metadata?.year?.toString() || 
         chunk.createdAt.getFullYear().toString()
}

/**
 * Extract source from chunk metadata
 */
function extractSource(chunk: IndexedChunk): string {
  return (chunk.metadata?.source as string) || 
         (chunk.metadata?.journal as string) || 
         chunk.sourceLabel
}

/**
 * Extract URL from chunk metadata
 */
function extractUrl(chunk: IndexedChunk): string {
  return (chunk.metadata?.url as string) || 
         (chunk.metadata?.doi ? `https://doi.org/${chunk.metadata.doi}` : '') ||
         ''
}

/**
 * Format date according to template
 */
function formatDate(dateString: string, template: string): string {
  const date = new Date(dateString)
  
  const replacements = {
    'YYYY': date.getFullYear().toString(),
    'YY': date.getFullYear().toString().slice(-2),
    'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
    'DD': date.getDate().toString().padStart(2, '0'),
    'MMM': date.toLocaleDateString('en-US', { month: 'short' }),
    'MMMM': date.toLocaleDateString('en-US', { month: 'long' })
  }

  let formatted = template
  Object.entries(replacements).forEach(([key, value]) => {
    formatted = formatted.replace(new RegExp(key, 'g'), value)
  })

  return formatted
}

/**
 * Generate preview of chunk text
 */
function generatePreview(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Convert string to title case
 */
function toTitleCase(str: string, titleFormat = false): string {
  if (titleFormat) {
    // Title case for titles (only major words capitalized)
    const minorWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of']
    return str.split(' ').map((word, index) => {
      if (index === 0 || !minorWords.includes(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      }
      return word.toLowerCase()
    }).join(' ')
  } else {
    // Sentence case
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

// OPTIONS /api/rag/citations - CORS support
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
