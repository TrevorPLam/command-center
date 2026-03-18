/**
 * Citation List Component
 * 
 * Renders a list of citations with various formats and interactions.
 * Supports different citation styles and provides source inspection.
 */

'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ChevronDown, 
  ChevronRight, 
  Copy, 
  ExternalLink, 
  FileText,
  User,
  Calendar,
  BookOpen
} from 'lucide-react'
import { IndexedChunk } from '@/lib/app/rag/types'

interface CitationListProps {
  citations: CitationData[]
  format?: 'apa' | 'mla' | 'chicago' | 'harvard' | 'vancouver' | 'ieee'
  showPreview?: boolean
  showMetadata?: boolean
  compact?: boolean
  onCitationClick?: (citation: CitationData) => void
  onCopyCitation?: (citation: CitationData) => void
  onInspectSource?: (citation: CitationData) => void
}

interface CitationData {
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
  preview?: string
  metadata?: Record<string, any>
  sectionPath: string[]
  score?: number
}

export function CitationList({
  citations,
  format = 'apa',
  showPreview = true,
  showMetadata = true,
  compact = false,
  onCitationClick,
  onCopyCitation,
  onInspectSource
}: CitationListProps) {
  const [expandedCitations, setExpandedCitations] = useState<Set<string>>(new Set())
  const [copiedCitation, setCopiedCitation] = useState<string | null>(null)

  const toggleExpanded = (chunkId: string) => {
    const newExpanded = new Set(expandedCitations)
    if (newExpanded.has(chunkId)) {
      newExpanded.delete(chunkId)
    } else {
      newExpanded.add(chunkId)
    }
    setExpandedCitations(newExpanded)
  }

  const handleCopyCitation = async (citation: CitationData) => {
    try {
      await navigator.clipboard.writeText(citation.citation)
      setCopiedCitation(citation.chunkId)
      onCopyCitation?.(citation)
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedCitation(null), 2000)
    } catch (error) {
      console.error('Failed to copy citation:', error)
    }
  }

  const formatScore = (score?: number) => {
    if (!score) return null
    return (score * 100).toFixed(1)
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {citations.map((citation, index) => (
          <div
            key={citation.chunkId}
            className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => onCitationClick?.(citation)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                [{index + 1}] {citation.source.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {citation.source.authors}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {citation.score && (
                <Badge variant="secondary" className="text-xs">
                  {formatScore(citation.score)}%
                </Badge>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  handleCopyCitation(citation)
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {citations.map((citation, index) => {
        const isExpanded = expandedCitations.has(citation.chunkId)
        const isCopied = copiedCitation === citation.chunkId

        return (
          <Card key={citation.chunkId} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      [{index + 1}]
                    </Badge>
                    {citation.score && (
                      <Badge variant="secondary" className="text-xs">
                        Relevance: {formatScore(citation.score)}%
                      </Badge>
                  )}
                  </div>
                  <CardTitle className="text-base leading-tight">
                    {citation.source.title}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{citation.source.authors}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{citation.source.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopyCitation(citation)}
                    className={isCopied ? 'text-green-600' : ''}
                  >
                    <Copy className="h-4 w-4" />
                    {isCopied && <span className="text-xs ml-1">Copied!</span>}
                  </Button>
                  {citation.source.url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(citation.source.url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleExpanded(citation.chunkId)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                {/* Citation text */}
                <div className="p-3 bg-muted/30 rounded-md">
                  <p className="text-sm font-mono">{citation.citation}</p>
                </div>

                {/* Preview */}
                {showPreview && citation.preview && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">Preview</span>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      "{citation.preview}"
                    </p>
                  </div>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="space-y-3 pt-3 border-t">
                    {/* Source details */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Source:</span>
                        <p className="text-muted-foreground">{citation.source.sourceLabel}</p>
                      </div>
                      <div>
                        <span className="font-medium">Document ID:</span>
                        <p className="text-muted-foreground font-mono text-xs">
                          {citation.source.documentId}
                        </p>
                      </div>
                      {citation.sectionPath && citation.sectionPath.length > 0 && (
                        <div className="col-span-2">
                          <span className="font-medium">Section:</span>
                          <p className="text-muted-foreground">
                            {citation.sectionPath.join(' > ')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    {showMetadata && citation.metadata && Object.keys(citation.metadata).length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-4 w-4" />
                          <span className="text-sm font-medium">Metadata</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(citation.metadata).map(([key, value]) => (
                            <div key={key}>
                              <span className="font-medium">{key}:</span>
                              <p className="text-muted-foreground break-all">
                                {typeof value === 'object' 
                                  ? JSON.stringify(value, null, 2)
                                  : String(value)
                                }
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onInspectSource?.(citation)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Inspect Source
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCitationClick?.(citation)}
                      >
                        View Context
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default CitationList
