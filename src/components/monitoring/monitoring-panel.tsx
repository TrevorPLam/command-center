/**
 * Main monitoring panel with real-time SSE updates
 * Implements CC-011-4: Build monitoring dashboards and cards in the UI
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { SystemMetricsCard } from './system-metrics-card'
import { RuntimeMetricsCard } from './runtime-metrics-card'
import { ApplicationMetricsCard } from './application-metrics-card'
import { QueueHealth } from './queue-health'
import { IndexHealth } from './index-health'
import type { MetricsSnapshot, Alert as AlertType, HealthStatus } from '@/lib/app/monitoring/types'
import { formatDistanceToNow } from '@/lib/utils'

interface MonitoringPanelProps {
  className?: string
}

export function MonitoringPanel({ className }: MonitoringPanelProps) {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [alerts, setAlerts] = useState<AlertType[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    const eventSource = new EventSource('/api/metrics/stream')

    eventSource.onopen = () => {
      setIsConnected(true)
      setError(null)
      console.log('Connected to monitoring stream')
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLastUpdate(new Date())
        
        switch (event.type) {
          case 'metrics':
            setMetrics(data)
            break
          case 'health':
            setHealth(data)
            break
          case 'alert':
            setAlerts(prev => [data, ...prev.slice(0, 9)]) // Keep last 10 alerts
            break
          default:
            console.log('Unknown event type:', event.type, data)
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err)
      }
    }

    eventSource.onerror = (event) => {
      setIsConnected(false)
      setError('Connection to monitoring stream lost')
      console.error('SSE error:', event)
    }

    eventSource.addEventListener('metrics', (event) => {
      try {
        const data = JSON.parse(event.data)
        setMetrics(data)
        setLastUpdate(new Date())
      } catch (err) {
        console.error('Error parsing metrics event:', err)
      }
    })

    eventSource.addEventListener('health', (event) => {
      try {
        const data = JSON.parse(event.data)
        setHealth(data)
      } catch (err) {
        console.error('Error parsing health event:', err)
      }
    })

    eventSource.addEventListener('alert', (event) => {
      try {
        const data = JSON.parse(event.data)
        setAlerts(prev => [data, ...prev.slice(0, 9)]) // Keep last 10 alerts
      } catch (err) {
        console.error('Error parsing alert event:', err)
      }
    })

    eventSource.addEventListener('connected', (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('Connected:', data.message)
      } catch (err) {
        console.error('Error parsing connected event:', err)
      }
    })

    return () => {
      eventSource.close()
    }
  }, [])

  useEffect(() => {
    const cleanup = connectSSE()
    return cleanup
  }, [connectSSE])

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  const getHealthStatusVariant = (status: HealthStatus['status']) => {
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

  const getAlertVariant = (level: AlertType['level']) => {
    switch (level) {
      case 'critical':
        return 'destructive'
      case 'error':
        return 'destructive'
      case 'warning':
        return 'secondary'
      case 'info':
        return 'default'
      default:
        return 'outline'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Connection Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIndicator status={isConnected ? 'online' : 'error'} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected to monitoring stream' : 'Disconnected'}
              </span>
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Last update: {formatDistanceToNow(lastUpdate)} ago
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {health && (
                <div className="flex items-center gap-2">
                  <StatusIndicator status={getHealthStatusVariant(health.status)} />
                  <span className="text-sm capitalize">{health.status}</span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                disabled={isConnected}
              >
                Reconnect
              </Button>
            </div>
          </div>
          {error && (
            <Alert className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Alerts</CardTitle>
              <Badge variant="outline">{alerts.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert) => (
              <Alert key={alert.id} variant={getAlertVariant(alert.level)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getAlertVariant(alert.level)} className="text-xs">
                        {alert.level}
                      </Badge>
                      <span className="font-medium text-sm">{alert.title}</span>
                    </div>
                    <AlertDescription className="text-sm">
                      {alert.message}
                    </AlertDescription>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(alert.timestamp))} ago
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => dismissAlert(alert.id)}
                    className="h-6 w-6 p-0"
                  >
                    ×
                  </Button>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SystemMetricsCard metrics={metrics.system} />
          <RuntimeMetricsCard metrics={metrics.runtime} />
          <ApplicationMetricsCard metrics={metrics.application} />
        </div>
      )}

      {/* Queue and Index Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QueueHealth />
        <IndexHealth />
      </div>

      {/* Loading State */}
      {!metrics && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-8 bg-muted rounded animate-pulse" />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Health Checks Details */}
      {health && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Health Checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.checks.map((check, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                <div className="flex items-center gap-3">
                  <StatusIndicator status={getHealthStatusVariant(check.status)} />
                  <div>
                    <div className="font-medium text-sm">{check.name}</div>
                    {check.message && (
                      <div className="text-xs text-muted-foreground">{check.message}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={check.status === 'pass' ? 'default' : check.status === 'warn' ? 'secondary' : 'destructive'}>
                    {check.status}
                  </Badge>
                  {check.duration && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {check.duration}ms
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
