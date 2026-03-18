/**
 * Runtime metrics card component
 * Implements CC-011-4: Build monitoring dashboards and cards in the UI
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Progress } from '@/components/ui/progress'
import type { RuntimeMetrics } from '@/lib/app/monitoring/types'
import { formatDuration, formatBytes } from '@/lib/utils'

interface RuntimeMetricsCardProps {
  metrics: RuntimeMetrics
  className?: string
}

export function RuntimeMetricsCard({ metrics, className }: RuntimeMetricsCardProps) {
  const getOllamaStatus = (status: RuntimeMetrics['ollama']['status']) => {
    switch (status) {
      case 'healthy':
        return { status: 'online' as const, text: 'Healthy', variant: 'default' as const }
      case 'degraded':
        return { status: 'busy' as const, text: 'Degraded', variant: 'secondary' as const }
      case 'error':
        return { status: 'error' as const, text: 'Error', variant: 'destructive' as const }
      default:
        return { status: 'offline' as const, text: 'Unknown', variant: 'outline' as const }
    }
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-600'
    if (latency < 500) return 'text-yellow-600'
    if (latency < 2000) return 'text-orange-600'
    return 'text-red-600'
  }

  const ollamaStatus = getOllamaStatus(metrics.ollama.status)

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Runtime Status</CardTitle>
          <StatusIndicator status={ollamaStatus.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ollama Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Ollama Runtime</span>
            <Badge variant={ollamaStatus.variant}>{ollamaStatus.text}</Badge>
          </div>

          {/* Latency */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Response Latency</span>
            <span className={`font-medium ${getLatencyColor(metrics.ollama.latency)}`}>
              {metrics.ollama.latency}ms
            </span>
          </div>

          {/* Model Count */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Available Models</span>
              <div className="font-medium">{metrics.ollama.modelCount}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Running Models</span>
              <div className="font-medium">{metrics.ollama.runningModels.length}</div>
            </div>
          </div>

          {/* Running Models List */}
          {metrics.ollama.runningModels.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-foreground">Active Models</h5>
              <div className="space-y-1">
                {metrics.ollama.runningModels.map((model) => (
                  <div key={model.name} className="flex items-center justify-between text-xs p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <StatusIndicator 
                        status={model.status === 'running' ? 'online' : model.status === 'loading' ? 'busy' : 'error'} 
                      />
                      <span className="font-medium">{model.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      {model.size > 0 && (
                        <span>{formatBytes(model.size)}</span>
                      )}
                      {model.memoryUsage > 0 && (
                        <span>{formatBytes(model.memoryUsage)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {metrics.ollama.errors.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium text-destructive">Errors</h5>
              <div className="space-y-1">
                {metrics.ollama.errors.map((error, index) => (
                  <div key={index} className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Command Center Status */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Command Center</span>
            <Badge variant="outline">Running</Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Uptime</span>
              <div className="font-medium">{formatDuration(metrics.commandCenter.uptime)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Memory Usage</span>
              <div className="font-medium">{metrics.commandCenter.memoryUsage.toFixed(1)}MB</div>
            </div>
          </div>

          {/* CPU Usage */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CPU Usage</span>
              <span className="font-medium">{metrics.commandCenter.cpuUsage.toFixed(1)}%</span>
            </div>
            <Progress value={metrics.commandCenter.cpuUsage} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
