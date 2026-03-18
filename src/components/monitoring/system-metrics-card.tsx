/**
 * System metrics card component
 * Implements CC-011-4: Build monitoring dashboards and cards in the UI
 */

'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import type { SystemMetrics } from '@/lib/app/monitoring/types'
import { formatBytes, formatDuration } from '@/lib/utils'

interface SystemMetricsCardProps {
  metrics: SystemMetrics
  className?: string
}

export function SystemMetricsCard({ metrics, className }: SystemMetricsCardProps) {
  const getStatusVariant = (usage: number) => {
    if (usage >= 90) return 'error'
    if (usage >= 75) return 'busy'
    return 'online'
  }

  const formatCores = (cores: number) => {
    return cores === 1 ? '1 core' : `${cores} cores`
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">System Resources</CardTitle>
          <StatusIndicator status={getStatusVariant(metrics.cpu.usage)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CPU */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">CPU Usage</span>
            <span className="font-medium">{metrics.cpu.usage.toFixed(1)}%</span>
          </div>
          <Progress value={metrics.cpu.usage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatCores(metrics.cpu.cores)}</span>
            <span>Load: {metrics.cpu.loadAverage[0]?.toFixed(2) || 'N/A'}</span>
            {metrics.cpu.temperature && (
              <span>Temp: {metrics.cpu.temperature.toFixed(0)}°C</span>
            )}
          </div>
        </div>

        {/* Memory */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Memory</span>
            <span className="font-medium">
              {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
            </span>
          </div>
          <Progress value={metrics.memory.percentage} className="h-2" />
          <div className="text-xs text-muted-foreground">
            {metrics.memory.percentage.toFixed(1)}% used • {formatBytes(metrics.memory.free)} free
          </div>
        </div>

        {/* Disk */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Disk Usage</span>
            <span className="font-medium">
              {formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}
            </span>
          </div>
          <Progress value={metrics.disk.percentage} className="h-2" />
          <div className="text-xs text-muted-foreground">
            {metrics.disk.percentage.toFixed(1)}% used • {formatBytes(metrics.disk.free)} free
          </div>
        </div>

        {/* Network */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Network</span>
            <Badge variant="outline" className="text-xs">
              {metrics.network.interfaces.length} interfaces
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">↓ RX</span>
              <span className="font-medium">{formatBytes(metrics.network.rx)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">↑ TX</span>
              <span className="font-medium">{formatBytes(metrics.network.tx)}</span>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="pt-2 border-t">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uptime</span>
            <span>{formatDuration(metrics.uptime * 1000)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Processes</span>
            <span>{metrics.processes}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
