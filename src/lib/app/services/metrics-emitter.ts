/**
 * Metrics emitter service - coordinates all metrics collection
 * Implements CC-011-2: Build application-level inference, retrieval, queue, and tool metrics emitters
 */

import type { MetricsSnapshot, HealthStatus, Alert } from '@/lib/app/monitoring/types'
import { systemMetricsCollector } from '@/lib/app/monitoring/system-metrics'
import { runtimeMetricsCollector } from '@/lib/app/monitoring/runtime-metrics'
import { applicationMetricsCollector } from '@/lib/app/monitoring/app-metrics'

export interface MetricsEmitterConfig {
  interval: number // Collection interval in milliseconds
  retention: number // Retention period in hours
  enabled: boolean
}

export class MetricsEmitter {
  private static instance: MetricsEmitter
  private config: MetricsEmitterConfig
  private collectionInterval?: NodeJS.Timeout
  private lastSnapshot?: MetricsSnapshot
  private subscribers: Set<(snapshot: MetricsSnapshot) => void> = new Set()
  private alertSubscribers: Set<(alert: Alert) => void> = new Set()

  private constructor(config: MetricsEmitterConfig) {
    this.config = config
  }

  static getInstance(config?: Partial<MetricsEmitterConfig>): MetricsEmitter {
    if (!MetricsEmitter.instance) {
      const defaultConfig: MetricsEmitterConfig = {
        interval: 5000, // 5 seconds
        retention: 24, // 24 hours
        enabled: true
      }
      MetricsEmitter.instance = new MetricsEmitter({ ...defaultConfig, ...config })
    }
    return MetricsEmitter.instance
  }

  /**
   * Start metrics collection
   */
  start(): void {
    if (!this.config.enabled || this.collectionInterval) {
      return
    }

    this.collectionInterval = setInterval(async () => {
      try {
        const snapshot = await this.collectMetrics()
        this.lastSnapshot = snapshot
        
        // Notify subscribers
        this.subscribers.forEach(callback => {
          try {
            callback(snapshot)
          } catch (error) {
            console.error('Error in metrics subscriber:', error)
          }
        })

        // Check for alerts
        await this.checkAlerts(snapshot)
      } catch (error) {
        console.error('Error collecting metrics:', error)
      }
    }, this.config.interval)
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval)
      this.collectionInterval = undefined
    }
  }

  /**
   * Collect comprehensive metrics snapshot
   */
  async collectMetrics(): Promise<MetricsSnapshot> {
    const timestamp = Date.now()

    const [systemMetrics, runtimeMetrics, applicationMetrics] = await Promise.all([
      systemMetricsCollector.collectSystemMetrics(),
      runtimeMetricsCollector.collectRuntimeMetrics(),
      applicationMetricsCollector.collectApplicationMetrics()
    ])

    return {
      system: systemMetrics,
      runtime: runtimeMetrics,
      application: applicationMetrics,
      timestamp
    }
  }

  /**
   * Get the most recent metrics snapshot
   */
  getLastSnapshot(): MetricsSnapshot | undefined {
    return this.lastSnapshot
  }

  /**
   * Subscribe to metrics updates
   */
  subscribe(callback: (snapshot: MetricsSnapshot) => void): () => void {
    this.subscribers.add(callback)
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Subscribe to alerts
   */
  subscribeToAlerts(callback: (alert: Alert) => void): () => void {
    this.alertSubscribers.add(callback)
    
    return () => {
      this.alertSubscribers.delete(callback)
    }
  }

  /**
   * Check for alert conditions
   */
  private async checkAlerts(snapshot: MetricsSnapshot): Promise<void> {
    const alerts: Alert[] = []

    // CPU usage alert
    if (snapshot.system.cpu.usage > 90) {
      alerts.push({
        id: `cpu-${Date.now()}`,
        level: 'error',
        title: 'High CPU Usage',
        message: `CPU usage is ${snapshot.system.cpu.usage.toFixed(1)}%`,
        category: 'system',
        timestamp: Date.now(),
        metadata: {
          usage: snapshot.system.cpu.usage,
          cores: snapshot.system.cpu.cores
        }
      })
    }

    // Memory usage alert
    if (snapshot.system.memory.percentage > 85) {
      alerts.push({
        id: `memory-${Date.now()}`,
        level: 'warning',
        title: 'High Memory Usage',
        message: `Memory usage is ${snapshot.system.memory.percentage.toFixed(1)}%`,
        category: 'system',
        timestamp: Date.now(),
        metadata: {
          usage: snapshot.system.memory.percentage,
          used: snapshot.system.memory.used,
          total: snapshot.system.memory.total
        }
      })
    }

    // Disk usage alert
    if (snapshot.system.disk.percentage > 85) {
      alerts.push({
        id: `disk-${Date.now()}`,
        level: 'warning',
        title: 'High Disk Usage',
        message: `Disk usage is ${snapshot.system.disk.percentage.toFixed(1)}%`,
        category: 'system',
        timestamp: Date.now(),
        metadata: {
          usage: snapshot.system.disk.percentage,
          used: snapshot.system.disk.used,
          total: snapshot.system.disk.total
        }
      })
    }

    // Ollama latency alert
    if (snapshot.runtime.ollama.latency > 5000) {
      alerts.push({
        id: `ollama-latency-${Date.now()}`,
        level: 'warning',
        title: 'Ollama High Latency',
        message: `Ollama response time is ${snapshot.runtime.ollama.latency}ms`,
        category: 'inference',
        timestamp: Date.now(),
        metadata: {
          latency: snapshot.runtime.ollama.latency,
          status: snapshot.runtime.ollama.status
        }
      })
    }

    // Ollama error alert
    if (snapshot.runtime.ollama.status === 'error') {
      alerts.push({
        id: `ollama-error-${Date.now()}`,
        level: 'error',
        title: 'Ollama Connection Error',
        message: snapshot.runtime.ollama.errors.join(', '),
        category: 'inference',
        timestamp: Date.now(),
        metadata: {
          status: snapshot.runtime.ollama.status,
          errors: snapshot.runtime.ollama.errors
        }
      })
    }

    // High error rate alert
    const totalRequests = snapshot.application.inference.totalRequests
    if (totalRequests > 10) {
      const errorRate = (snapshot.application.inference.failedRequests / totalRequests) * 100
      if (errorRate > 20) {
        alerts.push({
          id: `error-rate-${Date.now()}`,
          level: 'error',
          title: 'High Error Rate',
          message: `Inference error rate is ${errorRate.toFixed(1)}%`,
          category: 'inference',
          timestamp: Date.now(),
          metadata: {
            errorRate,
            failed: snapshot.application.inference.failedRequests,
            total: totalRequests
          }
        })
      }
    }

    // Notify alert subscribers
    alerts.forEach(alert => {
      this.alertSubscribers.forEach(callback => {
        try {
          callback(alert)
        } catch (error) {
          console.error('Error in alert subscriber:', error)
        }
      })
    })
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const [systemHealth, runtimeHealth] = await Promise.all([
      systemMetricsCollector.getSystemHealth(),
      runtimeMetricsCollector.getRuntimeHealth()
    ])

    const checks = [
      {
        name: 'System Resources',
        status: systemHealth.status,
        message: systemHealth.issues.length > 0 ? systemHealth.issues.join('; ') : 'System healthy'
      },
      ...runtimeHealth.checks
    ]

    const overallStatus = checks.some(c => c.status === 'fail') 
      ? 'error' 
      : checks.some(c => c.status === 'warn') 
        ? 'degraded' 
        : 'healthy'

    return {
      status: overallStatus,
      checks,
      timestamp: Date.now()
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MetricsEmitterConfig>): void {
    const wasRunning = !!this.collectionInterval
    
    if (wasRunning) {
      this.stop()
    }

    this.config = { ...this.config, ...newConfig }

    if (wasRunning && this.config.enabled) {
      this.start()
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): MetricsEmitterConfig {
    return { ...this.config }
  }

  /**
   * Force immediate metrics collection
   */
  async forceCollection(): Promise<MetricsSnapshot> {
    return this.collectMetrics()
  }
}

// Export singleton instance
export const metricsEmitter = MetricsEmitter.getInstance()
