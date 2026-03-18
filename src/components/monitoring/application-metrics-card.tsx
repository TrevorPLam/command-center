/**
 * Application metrics card component
 * Implements CC-011-4: Build monitoring dashboards and cards in the UI
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { ApplicationMetrics } from '@/lib/app/monitoring/types'
import { formatDuration } from '@/lib/utils'

interface ApplicationMetricsCardProps {
  metrics: ApplicationMetrics
  className?: string
}

export function ApplicationMetricsCard({ metrics, className }: ApplicationMetricsCardProps) {
  const getSuccessRate = (successful: number, total: number) => {
    if (total === 0) return 0
    return (successful / total) * 100
  }

  const getErrorRateColor = (rate: number) => {
    if (rate < 5) return 'text-green-600'
    if (rate < 15) return 'text-yellow-600'
    if (rate < 25) return 'text-orange-600'
    return 'text-red-600'
  }

  const inferenceSuccessRate = getSuccessRate(metrics.inference.successfulRequests, metrics.inference.totalRequests)
  const inferenceErrorRate = 100 - inferenceSuccessRate
  const toolSuccessRate = getSuccessRate(metrics.tools.successfulExecutions, metrics.tools.totalExecutions)
  const toolErrorRate = 100 - toolSuccessRate

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Application Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inference Metrics */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Inference</h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Requests</span>
              <div className="font-medium">{metrics.inference.totalRequests.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Success Rate</span>
              <div className={`font-medium ${getErrorRateColor(inferenceErrorRate)}`}>
                {inferenceSuccessRate.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Avg Latency</span>
              <div className="font-medium">{formatDuration(metrics.inference.averageLatency)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Tokens Generated</span>
              <div className="font-medium">{metrics.inference.tokensGenerated.toLocaleString()}</div>
            </div>
          </div>

          {/* Success/Error Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Success: {metrics.inference.successfulRequests}</span>
              <span>Failed: {metrics.inference.failedRequests}</span>
            </div>
            <Progress value={inferenceSuccessRate} className="h-2" />
          </div>
        </div>

        {/* Retrieval Metrics */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Retrieval</h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Queries</span>
              <div className="font-medium">{metrics.retrieval.totalQueries.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Avg Latency</span>
              <div className="font-medium">{formatDuration(metrics.retrieval.averageLatency)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Documents Retrieved</span>
              <div className="font-medium">{metrics.retrieval.documentsRetrieved.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Chunks Retrieved</span>
              <div className="font-medium">{metrics.retrieval.chunksRetrieved.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Queue Metrics */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Job Queue</h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Pending</span>
              <div className="font-medium">{metrics.queue.pendingJobs}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Running</span>
              <div className="font-medium">{metrics.queue.runningJobs}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Completed</span>
              <div className="font-medium text-green-600">{metrics.queue.completedJobs.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Failed</span>
              <div className="font-medium text-red-600">{metrics.queue.failedJobs.toLocaleString()}</div>
            </div>
          </div>

          {/* Queue Status */}
          <div className="flex items-center gap-2">
            <Badge 
              variant={metrics.queue.pendingJobs > 100 ? "destructive" : metrics.queue.pendingJobs > 10 ? "secondary" : "default"}
              className="text-xs"
            >
              {metrics.queue.pendingJobs === 0 ? 'Queue Empty' : `${metrics.queue.pendingJobs} pending`}
            </Badge>
            {metrics.queue.runningJobs > 0 && (
              <Badge variant="outline" className="text-xs">
                {metrics.queue.runningJobs} running
              </Badge>
            )}
          </div>
        </div>

        {/* Tool Metrics */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Tool Execution</h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Executions</span>
              <div className="font-medium">{metrics.tools.totalExecutions.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Success Rate</span>
              <div className={`font-medium ${getErrorRateColor(toolErrorRate)}`}>
                {toolSuccessRate.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Avg Execution Time</span>
            <div className="font-medium">{formatDuration(metrics.tools.averageExecutionTime)}</div>
          </div>

          {/* Tool Success/Error Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Success: {metrics.tools.successfulExecutions}</span>
              <span>Failed: {metrics.tools.failedExecutions}</span>
            </div>
            <Progress value={toolSuccessRate} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
