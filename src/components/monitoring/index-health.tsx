/**
 * RAG Index health monitoring component
 * Implements CC-011-6: Add queue and RAG index status views to monitoring
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Button } from '@/components/ui/button'
import { formatBytes, formatDistanceToNow } from '@/lib/utils'

interface IndexHealth {
  name: string
  status: 'healthy' | 'degraded' | 'error' | 'building'
  documentCount: number
  chunkCount: number
  vectorCount: number
  size: number
  lastUpdated: Date
  buildProgress?: number
  error?: string
  embeddingModel: string
  dimensions: number
}

interface IndexHealthProps {
  className?: string
}

export function IndexHealth({ className }: IndexHealthProps) {
  const [indexes, setIndexes] = useState<IndexHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchIndexHealth = async () => {
      try {
        // This would typically call an API endpoint
        // For now, we'll simulate with mock data
        const mockData: IndexHealth[] = [
          {
            name: 'main',
            status: 'healthy',
            documentCount: 1247,
            chunkCount: 8934,
            vectorCount: 8934,
            size: 234567890,
            lastUpdated: new Date(Date.now() - 3600000),
            embeddingModel: 'nomic-embed-text',
            dimensions: 768
          },
          {
            name: 'code',
            status: 'building',
            documentCount: 456,
            chunkCount: 2341,
            vectorCount: 1234,
            size: 123456789,
            lastUpdated: new Date(Date.now() - 1800000),
            buildProgress: 52.7,
            embeddingModel: 'nomic-embed-text',
            dimensions: 768
          },
          {
            name: 'docs',
            status: 'degraded',
            documentCount: 89,
            chunkCount: 567,
            vectorCount: 567,
            size: 45678901,
            lastUpdated: new Date(Date.now() - 86400000),
            embeddingModel: 'nomic-embed-text',
            dimensions: 768,
            error: 'Some chunks failed to embed'
          }
        ]
        
        setIndexes(mockData)
        setError(null)
      } catch (err) {
        setError('Failed to fetch index health')
        console.error('Error fetching index health:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchIndexHealth()
    const interval = setInterval(fetchIndexHealth, 15000) // Update every 15 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusVariant = (status: IndexHealth['status']) => {
    switch (status) {
      case 'healthy':
        return 'online'
      case 'degraded':
        return 'busy'
      case 'error':
        return 'error'
      case 'building':
        return 'busy'
      default:
        return 'offline'
    }
  }

  const getStatusBadgeVariant = (status: IndexHealth['status']) => {
    switch (status) {
      case 'healthy':
        return 'default'
      case 'degraded':
        return 'secondary'
      case 'error':
        return 'destructive'
      case 'building':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getTotalStats = () => {
    return indexes.reduce(
      (acc, index) => ({
        documents: acc.documents + index.documentCount,
        chunks: acc.chunks + index.chunkCount,
        vectors: acc.vectors + index.vectorCount,
        size: acc.size + index.size
      }),
      { documents: 0, chunks: 0, vectors: 0, size: 0 }
    )
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Index Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Index Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalStats = getTotalStats()

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Index Health</CardTitle>
          <Badge variant="outline">{indexes.length} indexes</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Stats */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Documents</span>
            <div className="font-medium">{totalStats.documents.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Chunks</span>
            <div className="font-medium">{totalStats.chunks.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Vectors</span>
            <div className="font-medium">{totalStats.vectors.toLocaleString()}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Size</span>
            <div className="font-medium">{formatBytes(totalStats.size)}</div>
          </div>
        </div>

        {/* Individual Indexes */}
        <div className="space-y-3">
          {indexes.map((index) => (
            <div key={index.name} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusIndicator status={getStatusVariant(index.status)} />
                  <span className="font-medium">{index.name}</span>
                  <Badge variant={getStatusBadgeVariant(index.status)} className="text-xs">
                    {index.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(index.lastUpdated)} ago
                </div>
              </div>

              {/* Build Progress */}
              {index.status === 'building' && index.buildProgress && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Building index...</span>
                    <span>{index.buildProgress.toFixed(1)}%</span>
                  </div>
                  <Progress value={index.buildProgress} className="h-1" />
                </div>
              )}

              {/* Error Message */}
              {index.error && (
                <div className="mb-2 text-xs text-destructive bg-destructive/10 p-2 rounded">
                  {index.error}
                </div>
              )}

              {/* Index Stats */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Documents</span>
                  <div className="font-medium">{index.documentCount.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Chunks</span>
                  <div className="font-medium">{index.chunkCount.toLocaleString()}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Size</span>
                  <div className="font-medium">{formatBytes(index.size)}</div>
                </div>
              </div>

              {/* Embedding Info */}
              <div className="flex justify-between text-xs text-muted-foreground mt-2 pt-2 border-t">
                <span>{index.embeddingModel}</span>
                <span>{index.dimensions} dimensions</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm">
            Rebuild All
          </Button>
          <Button variant="outline" size="sm">
            Optimize
          </Button>
          <Button variant="outline" size="sm">
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
