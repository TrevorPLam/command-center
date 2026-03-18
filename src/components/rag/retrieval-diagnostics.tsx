/**
 * Retrieval Diagnostics Component
 * 
 * Provides detailed diagnostics and analytics for retrieval operations.
 * Shows performance metrics, search statistics, and quality indicators.
 */

'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Search, 
  Clock, 
  Database, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Target,
  Zap,
  Filter,
  FileText,
  Users,
  Calendar
} from 'lucide-react'

interface RetrievalDiagnosticsProps {
  diagnostics: RetrievalDiagnosticsData
  className?: string
}

interface RetrievalDiagnosticsData {
  query: string
  searchType: 'vector' | 'fulltext' | 'hybrid'
  totalResults: number
  queryTime: number
  indexVersion: string
  metadata: {
    fusionStrategy?: string
    vectorResults?: number
    textResults?: number
    fusionConfig?: any
    vectorMetadata?: any
    textMetadata?: any
  }
  performance: PerformanceMetrics
  quality: QualityMetrics
  index: IndexMetrics
  usage: UsageMetrics
}

interface PerformanceMetrics {
  queryTime: number
  indexingTime?: number
  embeddingTime?: number
  fusionTime?: number
  totalTime: number
  memoryUsage?: number
  cacheHitRate?: number
}

interface QualityMetrics {
  relevanceScore: number
  diversityScore: number
  coverageScore: number
  freshnessScore: number
  averageChunkLength: number
  uniqueDocuments: number
  duplicateRate: number
}

interface IndexMetrics {
  totalChunks: number
  totalDocuments: number
  indexSize: number
  lastUpdated: string
  status: 'ready' | 'building' | 'error' | 'updating'
  health: 'healthy' | 'warning' | 'critical'
}

interface UsageMetrics {
  dailyQueries: number
  averageQueryTime: number
  popularQueries: Array<{ query: string; count: number }>
  errorRate: number
  successRate: number
}

export function RetrievalDiagnostics({ diagnostics, className }: RetrievalDiagnosticsProps) {
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'critical': return <AlertTriangle className="h-4 w-4" />
      default: return <Database className="h-4 w-4" />
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Query Performance */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Query Time</p>
                <p className="text-2xl font-bold">{formatTime(diagnostics.queryTime)}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <Progress 
                value={Math.min((diagnostics.queryTime / 1000) * 100, 100)} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Results</p>
                <p className="text-2xl font-bold">{formatNumber(diagnostics.totalResults)}</p>
              </div>
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <Badge variant={diagnostics.totalResults > 0 ? 'default' : 'secondary'}>
                {diagnostics.searchType.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quality Score */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Quality Score</p>
                <p className={`text-2xl font-bold ${getQualityColor(diagnostics.quality.relevanceScore)}`}>
                  {(diagnostics.quality.relevanceScore * 100).toFixed(1)}%
                </p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="mt-2">
              <Progress value={diagnostics.quality.relevanceScore * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Index Health */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Index Health</p>
                <p className={`text-2xl font-bold capitalize ${getHealthColor(diagnostics.index.health)}`}>
                  {diagnostics.index.health}
                </p>
              </div>
              {getHealthIcon(diagnostics.index.health)}
            </div>
            <div className="mt-2">
              <Badge variant={diagnostics.index.status === 'ready' ? 'default' : 'secondary'}>
                {diagnostics.index.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Diagnostics */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="index">Index</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Timing Breakdown */}
                <div>
                  <h4 className="font-medium mb-4">Timing Breakdown</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Query Time</span>
                        <span className="text-sm font-mono">{formatTime(diagnostics.performance.totalTime)}</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Search Time</span>
                        <span className="text-sm font-mono">{formatTime(diagnostics.queryTime)}</span>
                      </div>
                    </div>
                    {diagnostics.performance.embeddingTime && (
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Embedding Time</span>
                          <span className="text-sm font-mono">{formatTime(diagnostics.performance.embeddingTime)}</span>
                        </div>
                      </div>
                    )}
                    {diagnostics.performance.fusionTime && (
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Fusion Time</span>
                          <span className="text-sm font-mono">{formatTime(diagnostics.performance.fusionTime)}</span>
                        </div>
                      </div>
                    )}
                    {diagnostics.performance.indexingTime && (
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Indexing Time</span>
                          <span className="text-sm font-mono">{formatTime(diagnostics.performance.indexingTime)}</span>
                        </div>
                      </div>
                    )}
                    {diagnostics.performance.memoryUsage && (
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Memory Usage</span>
                          <span className="text-sm font-mono">{formatBytes(diagnostics.performance.memoryUsage)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cache Performance */}
                {diagnostics.performance.cacheHitRate !== undefined && (
                  <div>
                    <h4 className="font-medium mb-4">Cache Performance</h4>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Cache Hit Rate</span>
                        <span className="text-sm font-mono">{(diagnostics.performance.cacheHitRate * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={diagnostics.performance.cacheHitRate * 100} className="h-2" />
                    </div>
                  </div>
                )}

                {/* Search Metadata */}
                {diagnostics.metadata && (
                  <div>
                    <h4 className="font-medium mb-4">Search Metadata</h4>
                    <ScrollArea className="h-[200px]">
                      <div className="p-4 border rounded-lg">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {JSON.stringify(diagnostics.metadata, null, 2)}
                        </pre>
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Tab */}
        <TabsContent value="quality">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Quality Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Quality Scores */}
                <div>
                  <h4 className="font-medium mb-4">Quality Scores</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Relevance</span>
                        <span className={`text-sm font-mono ${getQualityColor(diagnostics.quality.relevanceScore)}`}>
                          {(diagnostics.quality.relevanceScore * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={diagnostics.quality.relevanceScore * 100} className="h-2" />
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Diversity</span>
                        <span className={`text-sm font-mono ${getQualityColor(diagnostics.quality.diversityScore)}`}>
                          {(diagnostics.quality.diversityScore * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={diagnostics.quality.diversityScore * 100} className="h-2" />
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Coverage</span>
                        <span className={`text-sm font-mono ${getQualityColor(diagnostics.quality.coverageScore)}`}>
                          {(diagnostics.quality.coverageScore * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={diagnostics.quality.coverageScore * 100} className="h-2" />
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Freshness</span>
                        <span className={`text-sm font-mono ${getQualityColor(diagnostics.quality.freshnessScore)}`}>
                          {(diagnostics.quality.freshnessScore * 100).toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={diagnostics.quality.freshnessScore * 100} className="h-2" />
                    </div>
                  </div>
                </div>

                {/* Content Statistics */}
                <div>
                  <h4 className="font-medium mb-4">Content Statistics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Unique Documents</span>
                        <span className="text-sm font-mono">{formatNumber(diagnostics.quality.uniqueDocuments)}</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Avg Chunk Length</span>
                        <span className="text-sm font-mono">{formatNumber(diagnostics.quality.averageChunkLength)}</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Duplicate Rate</span>
                        <span className={`text-sm font-mono ${getQualityColor(1 - diagnostics.quality.duplicateRate)}`}>
                          {(diagnostics.quality.duplicateRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Tokens</span>
                        <span className="text-sm font-mono">{formatNumber(diagnostics.quality.uniqueDocuments * diagnostics.quality.averageChunkLength)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Index Tab */}
        <TabsContent value="index">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Index Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Index Overview */}
                <div>
                  <h4 className="font-medium mb-4">Index Overview</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Chunks</span>
                        <span className="text-sm font-mono">{formatNumber(diagnostics.index.totalChunks)}</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Documents</span>
                        <span className="text-sm font-mono">{formatNumber(diagnostics.index.totalDocuments)}</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Index Size</span>
                        <span className="text-sm font-mono">{formatBytes(diagnostics.index.indexSize)}</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Version</span>
                        <span className="text-sm font-mono">{diagnostics.indexVersion}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Index Health */}
                <div>
                  <h4 className="font-medium mb-4">Index Health</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status</span>
                        <Badge variant={diagnostics.index.status === 'ready' ? 'default' : 'secondary'}>
                          {diagnostics.index.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Health</span>
                        <Badge variant={diagnostics.index.health === 'healthy' ? 'default' : 'destructive'}>
                          {diagnostics.index.health.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg md:col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Last Updated</span>
                        <span className="text-sm font-mono">{new Date(diagnostics.index.lastUpdated).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Usage Overview */}
                <div>
                  <h4 className="font-medium mb-4">Usage Overview</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Daily Queries</span>
                        <span className="text-sm font-mono">{formatNumber(diagnostics.usage.dailyQueries)}</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Avg Query Time</span>
                        <span className="text-sm font-mono">{formatTime(diagnostics.usage.averageQueryTime)}</span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Success Rate</span>
                        <span className={`text-sm font-mono ${getQualityColor(diagnostics.usage.successRate)}`}>
                          {(diagnostics.usage.successRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Error Rate</span>
                        <span className={`text-sm font-mono ${getQualityColor(1 - diagnostics.usage.errorRate)}`}>
                          {(diagnostics.usage.errorRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Popular Queries */}
                <div>
                  <h4 className="font-medium mb-4">Popular Queries</h4>
                  <div className="space-y-2">
                    {diagnostics.usage.popularQueries.map((query, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm truncate flex-1">{query.query}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{query.count}</Badge>
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default RetrievalDiagnostics
