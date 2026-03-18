/**
 * Source Inspector Component
 * 
 * Provides detailed inspection of document sources and chunks.
 * Shows full context, metadata, and navigation within documents.
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  FileText, 
  Copy, 
  ExternalLink, 
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Hash,
  Bookmark,
  Eye,
  Download,
  Share
} from 'lucide-react'
import { IndexedChunk } from '@/lib/app/rag/types'

interface SourceInspectorProps {
  chunk: IndexedChunk
  document?: DocumentData
  relatedChunks?: IndexedChunk[]
  onClose?: () => void
  onNavigateChunk?: (chunkId: string) => void
  onExportChunk?: (chunk: IndexedChunk) => void
  onShareChunk?: (chunk: IndexedChunk) => void
}

interface DocumentData {
  id: string
  title: string
  sourcePath: string
  contentType: string
  sections: DocumentSection[]
  metadata: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

interface DocumentSection {
  path: string[]
  text: string
  metadata: Record<string, any>
  level?: number
  title?: string
}

export function SourceInspector({
  chunk,
  document,
  relatedChunks = [],
  onClose,
  onNavigateChunk,
  onExportChunk,
  onShareChunk
}: SourceInspectorProps) {
  const [activeTab, setActiveTab] = useState('content')
  const [copiedText, setCopiedText] = useState<string | null>(null)

  const handleCopyText = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(type)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }

  const formatTokenCount = (tokens: number) => {
    return tokens.toLocaleString()
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case 'application/pdf':
        return '📄'
      case 'text/markdown':
        return '📝'
      case 'text/plain':
        return '📄'
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '📋'
      default:
        return '📄'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{getContentTypeIcon(chunk.metadata?.contentType || 'text/plain')}</span>
                <Badge variant="outline" className="text-xs">
                  {chunk.citationLabel}
                </Badge>
                {chunk.score && (
                  <Badge variant="secondary" className="text-xs">
                    Score: {(chunk.score * 100).toFixed(1)}%
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg leading-tight mb-2">
                {document?.title || chunk.sourceLabel}
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span>{chunk.sourceLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Hash className="h-4 w-4" />
                  <span>{formatTokenCount(chunk.tokenCount || 0)} tokens</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(chunk.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleCopyText(chunk.text, 'content')}
                className={copiedText === 'content' ? 'text-green-600' : ''}
              >
                <Copy className="h-4 w-4" />
                {copiedText === 'content' && <span className="text-xs ml-1">Copied!</span>}
              </Button>
              {onExportChunk && (
                <Button size="sm" variant="ghost" onClick={() => onExportChunk(chunk)}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
              {onShareChunk && (
                <Button size="sm" variant="ghost" onClick={() => onShareChunk(chunk)}>
                  <Share className="h-4 w-4" />
                </Button>
              )}
              {onClose && (
                <Button size="sm" variant="ghost" onClick={onClose}>
                  ×
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
          <TabsTrigger value="context">Context</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
        </TabsList>

        <div className="flex-1 mt-4">
          {/* Content Tab */}
          <TabsContent value="content" className="h-full mt-0">
            <Card className="h-full">
              <CardContent className="p-6">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {/* Section path */}
                    {chunk.sectionPath && chunk.sectionPath.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Bookmark className="h-4 w-4" />
                        <span>{chunk.sectionPath.join(' > ')}</span>
                      </div>
                    )}

                    {/* Main content */}
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {chunk.text}
                      </p>
                    </div>

                    {/* Chunk info */}
                    <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
                      <div>
                        <span>Chunk ID: </span>
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">
                          {chunk.chunkId}
                        </code>
                      </div>
                      <div>
                        <span>Chunk Index: </span>
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">
                          {chunk.chunkIndex}
                        </code>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="h-full mt-0">
            <Card className="h-full">
              <CardContent className="p-6">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-6">
                    {/* Chunk metadata */}
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Chunk Metadata
                      </h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Document ID:</span>
                          <p className="text-muted-foreground font-mono text-xs break-all">
                            {chunk.documentId}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Chunk ID:</span>
                          <p className="text-muted-foreground font-mono text-xs break-all">
                            {chunk.chunkId}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Token Count:</span>
                          <p className="text-muted-foreground">
                            {formatTokenCount(chunk.tokenCount || 0)}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Embedding ID:</span>
                          <p className="text-muted-foreground font-mono text-xs">
                            {chunk.embeddingId || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Created:</span>
                          <p className="text-muted-foreground">
                            {formatDate(chunk.createdAt)}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Score:</span>
                          <p className="text-muted-foreground">
                            {chunk.score ? (chunk.score * 100).toFixed(2) + '%' : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Additional metadata */}
                    {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          Additional Metadata
                        </h4>
                        <div className="space-y-3">
                          {Object.entries(chunk.metadata).map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-medium">{key}:</span>
                              <div className="mt-1 p-2 bg-muted rounded text-muted-foreground break-all">
                                {typeof value === 'object' 
                                  ? (
                                      <details className="cursor-pointer">
                                        <summary className="font-mono text-xs">
                                          {JSON.stringify(value, null, 2).substring(0, 100)}...
                                        </summary>
                                        <pre className="mt-2 text-xs">
                                          {JSON.stringify(value, null, 2)}
                                        </pre>
                                      </details>
                                    )
                                  : (
                                      <span className="font-mono text-xs">
                                        {String(value)}
                                      </span>
                                    )
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Document metadata if available */}
                    {document && (
                      <>
                        <Separator />
                        <div>
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Document Metadata
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Title:</span>
                              <p className="text-muted-foreground">{document.title}</p>
                            </div>
                            <div>
                              <span className="font-medium">Source Path:</span>
                              <p className="text-muted-foreground font-mono text-xs break-all">
                                {document.sourcePath}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium">Content Type:</span>
                              <p className="text-muted-foreground">{document.contentType}</p>
                            </div>
                            <div>
                              <span className="font-medium">Sections:</span>
                              <p className="text-muted-foreground">{document.sections.length}</p>
                            </div>
                            <div>
                              <span className="font-medium">Created:</span>
                              <p className="text-muted-foreground">{formatDate(document.createdAt)}</p>
                            </div>
                            <div>
                              <span className="font-medium">Updated:</span>
                              <p className="text-muted-foreground">{formatDate(document.updatedAt)}</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Context Tab */}
          <TabsContent value="context" className="h-full mt-0">
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <h4 className="font-medium">Document Context</h4>
                  </div>
                  
                  {document && document.sections.length > 0 ? (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-4">
                        {document.sections.map((section, index) => {
                          const isCurrentSection = JSON.stringify(section.path) === JSON.stringify(chunk.sectionPath)
                          
                          return (
                            <div
                              key={index}
                              className={`p-4 rounded-lg border ${
                                isCurrentSection 
                                  ? 'bg-primary/10 border-primary/30' 
                                  : 'bg-muted/30'
                              }`}
                            >
                              {section.title && (
                                <h5 className="font-medium mb-2">{section.title}</h5>
                              )}
                              {section.level && (
                                <Badge variant="outline" className="text-xs mb-2">
                                  Level {section.level}
                                </Badge>
                              )}
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {section.text}
                              </p>
                              {isCurrentSection && (
                                <Badge className="mt-2" variant="default">
                                  Current Section
                                </Badge>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No additional context available</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Related Chunks Tab */}
          <TabsContent value="related" className="h-full mt-0">
            <Card className="h-full">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <h4 className="font-medium">
                      Related Chunks ({relatedChunks.length})
                    </h4>
                  </div>
                  
                  {relatedChunks.length > 0 ? (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {relatedChunks.map((relatedChunk, index) => (
                          <div
                            key={relatedChunk.chunkId}
                            className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => onNavigateChunk?.(relatedChunk.chunkId)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    {relatedChunk.citationLabel}
                                  </Badge>
                                  {relatedChunk.score && (
                                    <Badge variant="secondary" className="text-xs">
                                      {(relatedChunk.score * 100).toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium truncate">
                                  {relatedChunk.sourceLabel}
                                </p>
                              </div>
                              <Button size="sm" variant="ghost">
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            {relatedChunk.sectionPath && relatedChunk.sectionPath.length > 0 && (
                              <p className="text-xs text-muted-foreground mb-2">
                                {relatedChunk.sectionPath.join(' > ')}
                              </p>
                            )}
                            
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {relatedChunk.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No related chunks found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default SourceInspector
