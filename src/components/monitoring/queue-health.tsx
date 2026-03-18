/**
 * Queue health monitoring component
 * Implements CC-011-6: Add queue and RAG index status views to monitoring
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from '@/lib/utils'

interface QueueHealth {
  status: 'healthy' | 'degraded' | 'error'
  pendingJobs: number
  runningJobs: number
  completedJobs: number
  failedJobs: number
  avgProcessingTime: number
  oldestPendingAge: number
  workerStatus: {
    active: number
    idle: number
    total: number
  }
  lastActivity: Date
}

interface QueueHealthProps {
  className?: string
}

export function QueueHealth({ className }: QueueHealthProps) {
  const [queueHealth, setQueueHealth] = useState<QueueHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchQueueHealth = async () => {
      try {
        // This would typically call an API endpoint
        // For now, we'll simulate with mock data
        const mockData: QueueHealth = {
          status: 'healthy',
          pendingJobs: 12,
          runningJobs: 3,
          completedJobs: 1547,
          failedJobs: 8,
          avgProcessingTime: 2500,
          oldestPendingAge: 45000,
          workerStatus: {
            active: 3,
            idle: 2,
            total: 5
          },
          lastActivity: new Date(Date.now() - 30000)
        }
        
        setQueueHealth(mockData)
        setError(null)
      } catch (err) {
        setError('Failed to fetch queue health')
        console.error('Error fetching queue health:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchQueueHealth()
    const interval = setInterval(fetchQueueHealth, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusVariant = (status: QueueHealth['status']) => {
    switch (status) {
      case 'healthy':
        return 'online'
      case 'degraded':
        return 'busy'
      case 'error':
        return 'error'
      default:
        return 'offline'
    }
  }

  const getJobStatusColor = (count: number, threshold: number) => {
    if (count === 0) return 'text-green-600'
    if (count < threshold) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getWorkerUtilization = () => {
    if (!queueHealth) return 0
    return (queueHealth.workerStatus.active / queueHealth.workerStatus.total) * 100
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Queue Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !queueHealth) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">Queue Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            {error || 'No queue data available'}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Queue Health</CardTitle>
          <div className="flex items-center gap-2">
            <StatusIndicator status={getStatusVariant(queueHealth.status)} />
            <Badge variant={queueHealth.status === 'healthy' ? 'default' : queueHealth.status === 'degraded' ? 'secondary' : 'destructive'}>
              {queueHealth.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Job Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Pending Jobs</span>
            <div className={`font-medium text-lg ${getJobStatusColor(queueHealth.pendingJobs, 50)}`}>
              {queueHealth.pendingJobs}
            </div>
            {queueHealth.oldestPendingAge > 0 && (
              <div className="text-xs text-muted-foreground">
                Oldest: {formatDistanceToNow(new Date(Date.now() - queueHealth.oldestPendingAge))} old
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">Running Jobs</span>
            <div className="font-medium text-lg text-blue-600">
              {queueHealth.runningJobs}
            </div>
            <div className="text-xs text-muted-foreground">
              Avg time: {(queueHealth.avgProcessingTime / 1000).toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Worker Status */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Worker Utilization</span>
            <span className="font-medium">{getWorkerUtilization().toFixed(1)}%</span>
          </div>
          <Progress value={getWorkerUtilization()} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{queueHealth.workerStatus.active} active</span>
            <span>{queueHealth.workerStatus.idle} idle</span>
            <span>{queueHealth.workerStatus.total} total</span>
          </div>
        </div>

        {/* Completed/Failed Jobs */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <span className="text-sm text-muted-foreground">Completed</span>
            <div className="font-medium text-green-600">
              {queueHealth.completedJobs.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Failed</span>
            <div className={`font-medium ${getJobStatusColor(queueHealth.failedJobs, 5)}`}>
              {queueHealth.failedJobs}
            </div>
          </div>
        </div>

        {/* Last Activity */}
        <div className="pt-2 border-t">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Last Activity</span>
            <span>{formatDistanceToNow(queueHealth.lastActivity)} ago</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm">
            View Details
          </Button>
          <Button variant="outline" size="sm">
            Clear Failed
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
