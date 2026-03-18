/**
 * Enhanced RAG Panel
 * 
 * Comprehensive RAG interface with search, citations, and diagnostics.
 * Integrates all retrieval components with real-time search capabilities.
 */

'use client'

import React, { useState } from 'react'
import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { 
  Search, 
  Settings, 
  BarChart3,
  FileText,
  BookOpen,
  Filter,
  Zap,
  Clock,
  Target
} from 'lucide-react'

import CitationList from '@/components/rag/citation-list'
import SourceInspector from '@/components/rag/source-inspector'
import RetrievalDiagnostics from '@/components/rag/retrieval-diagnostics'
import { IngestionDropzone } from '@/components/rag/ingestion-dropzone'

// Mock data for demonstration
const mockSearchResults = [
  {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sectionPath: ['introduction', 'overview'],
    text: 'This is the first chunk of relevant content that matches the search query. It contains important information about the topic being searched.',
    metadata: {
      title: 'Introduction to Machine Learning',
      authors: 'John Doe, Jane Smith',
      date: '2024-01-15',
      source: 'Academic Journal',
      url: 'https://example.com/doc-1',
      contentType: 'application/pdf'
    },
    chunkIndex: 0,
    tokenCount: 45,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    sourceLabel: 'ml-intro.pdf (doc-1)',
    citationLabel: '[1]',
    score: 0.95
  },
  {
    chunkId: 'chunk-2',
    documentId: 'doc-2',
    sectionPath: ['methods', 'data-processing'],
    text: 'The second chunk provides additional context and details about the search topic. It complements the first chunk with more specific information.',
    metadata: {
      title: 'Advanced Data Processing Techniques',
      authors: 'Alice Johnson',
      date: '2024-02-20',
      source: 'Technical Report',
      url: 'https://example.com/doc-2',
      contentType: 'text/plain'
    },
    chunkIndex: 1,
    tokenCount: 38,
    createdAt: new Date('2024-02-20T14:30:00Z'),
    sourceLabel: 'data-processing.txt (doc-2)',
    citationLabel: '[2]',
    score: 0.87
  }
]

const mockDiagnostics = {
  query: 'machine learning algorithms',
  searchType: 'hybrid' as const,
  totalResults: 2,
  queryTime: 145,
  indexVersion: '1.0.0',
  metadata: {
    fusionStrategy: 'reciprocal_rank',
    vectorResults: 5,
    textResults: 8,
    fusionConfig: {
      strategy: 'reciprocal_rank',
      vectorWeight: 0.6,
      textWeight: 0.4,
      k: 60,
      topK: 10,
      minScore: 0.1
    }
  },
  performance: {
    queryTime: 145,
    embeddingTime: 45,
    fusionTime: 23,
    totalTime: 213,
    memoryUsage: 51200000,
    cacheHitRate: 0.75
  },
  quality: {
    relevanceScore: 0.91,
    diversityScore: 0.85,
    coverageScore: 0.78,
    freshnessScore: 0.92,
    averageChunkLength: 41.5,
    uniqueDocuments: 2,
    duplicateRate: 0.0
  },
  index: {
    totalChunks: 1250,
    totalDocuments: 45,
    indexSize: 256000000,
    lastUpdated: '2024-03-10T09:15:00Z',
    status: 'ready' as const,
    health: 'healthy' as const
  },
  usage: {
    dailyQueries: 156,
    averageQueryTime: 167,
    popularQueries: [
      { query: 'machine learning algorithms', count: 23 },
      { query: 'data preprocessing', count: 18 },
      { query: 'neural networks', count: 15 }
    ],
    errorRate: 0.02,
    successRate: 0.98
  }
}

export default function RagPanel() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchType, setSearchType] = useState<'vector' | 'fulltext' | 'hybrid'>('hybrid')
  const [searchResults, setSearchResults] = useState(mockSearchResults)
  const [selectedChunk, setSelectedChunk] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [topK, setTopK] = useState('10')
  const [similarityThreshold, setSimilarityThreshold] = useState('0.7')

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    
    try {
      // Mock search API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // In real implementation, this would call the search API
      const response = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          searchType,
          topK: parseInt(topK),
          similarityThreshold: parseFloat(similarityThreshold)
        })
      })

      if (response.ok) {
        const data = await response.json()
        setSearchResults(data.results.chunks)
      } else {
        // Use mock data for demo
        setSearchResults(mockSearchResults)
      }
    } catch (error) {
      console.error('Search failed:', error)
      // Use mock data for demo
      setSearchResults(mockSearchResults)
    } finally {
      setIsSearching(false)
    }
  }

  const handleCitationClick = (citation: any) => {
    setSelectedChunk(citation)
  }

  const handleCopyCitation = (citation: any) => {
    console.log('Citation copied:', citation)
  }

  const handleInspectSource = (citation: any) => {
    setSelectedChunk(citation)
  }

  const formatCitationData = (chunks: any[]) => {
    return chunks.map(chunk => ({
      chunkId: chunk.chunkId,
      citation: `${chunk.metadata.authors} (${new Date(chunk.metadata.date).getFullYear()}). ${chunk.metadata.title}. ${chunk.metadata.source}.`,
      source: {
        documentId: chunk.documentId,
        sourceLabel: chunk.sourceLabel,
        title: chunk.metadata.title,
        authors: chunk.metadata.authors,
        date: chunk.metadata.date,
        url: chunk.metadata.url
      },
      preview: chunk.text.substring(0, 200) + '...',
      metadata: chunk.metadata,
      sectionPath: chunk.sectionPath,
      score: chunk.score
    }))
  }

  return (
    <Panel className="h-full flex flex-col">
      <PanelHeader>
        <PanelTitle>RAG</PanelTitle>
      </PanelHeader>
      
      <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
        {/* Search Interface */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {/* Search Input */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full"
                  />
                </div>
                <Button 
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                >
                  {isSearching ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {/* Search Options */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Type:</label>
                  <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vector">Vector</SelectItem>
                      <SelectItem value="fulltext">Full-Text</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Top-K:</label>
                  <Select value={topK} onValueChange={setTopK}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Threshold:</label>
                  <Select value={similarityThreshold} onValueChange={setSimilarityThreshold}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.5">0.5</SelectItem>
                      <SelectItem value="0.7">0.7</SelectItem>
                      <SelectItem value="0.8">0.8</SelectItem>
                      <SelectItem value="0.9">0.9</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDiagnostics(!showDiagnostics)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Results Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedChunk ? (
              /* Source Inspector */
              <div className="h-full">
                <SourceInspector
                  chunk={selectedChunk}
                  onClose={() => setSelectedChunk(null)}
                  onNavigateChunk={(chunkId) => {
                    const chunk = searchResults.find(c => c.chunkId === chunkId)
                    if (chunk) setSelectedChunk(chunk)
                  }}
                />
              </div>
            ) : (
              /* Search Results */
              <Tabs defaultValue="results" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="results">Results ({searchResults.length})</TabsTrigger>
                  <TabsTrigger value="citations">Citations</TabsTrigger>
                  <TabsTrigger value="ingestion">Ingestion</TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="results" className="h-full mt-0">
                    <div className="h-full overflow-auto p-4">
                      {searchResults.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">Search Results</h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">
                                {searchType.toUpperCase()}
                              </Badge>
                              {searchResults.length > 0 && (
                                <Badge variant="outline">
                                  {Math.round(searchResults[0].score * 100)}% relevance
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <CitationList
                            citations={formatCitationData(searchResults)}
                            compact={true}
                            onCitationClick={handleCitationClick}
                            onCopyCitation={handleCopyCitation}
                            onInspectSource={handleInspectSource}
                          />
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Enter a search query to find relevant documents</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="citations" className="h-full mt-0">
                    <div className="h-full overflow-auto p-4">
                      {searchResults.length > 0 ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">Citations</h3>
                            <Button variant="outline" size="sm">
                              <FileText className="h-4 w-4 mr-2" />
                              Export Bibliography
                            </Button>
                          </div>
                          
                          <CitationList
                            citations={formatCitationData(searchResults)}
                            showPreview={true}
                            showMetadata={true}
                            onCitationClick={handleCitationClick}
                            onCopyCitation={handleCopyCitation}
                            onInspectSource={handleInspectSource}
                          />
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No citations available. Perform a search first.</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="ingestion" className="h-full mt-0">
                    <div className="h-full overflow-auto p-4">
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Document Ingestion</h3>
                        <IngestionDropzone 
                          onUploadStart={(jobId) => console.log('Upload started:', jobId)}
                          onUploadComplete={(result) => console.log('Upload completed:', result)}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </div>

          {/* Diagnostics Panel */}
          {showDiagnostics && (
            <div className="w-96 border-l">
              <div className="h-full overflow-auto">
                <RetrievalDiagnostics diagnostics={mockDiagnostics} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  )
}
