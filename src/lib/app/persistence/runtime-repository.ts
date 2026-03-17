/**
 * Runtime Repository
 * 
 * Handles persistence of runtime snapshots, metrics, and historical data.
 * Provides comparison capabilities and trend analysis.
 */

import { 
  RuntimeSnapshot, 
  RuntimeHealth, 
  RuntimeMetrics,
  RuntimeModel,
  RuntimeModelState 
} from '../runtime/types'
import { RuntimeError, RuntimeErrorCode } from '../runtime/errors'

export interface RuntimeSnapshotEntity {
  id: string
  timestamp: string
  health: RuntimeHealth
  models: RuntimeModel[]
  runningModels: RuntimeModelState[]
  capabilities: any
  version: string
  created_at: string
}

export interface RuntimeMetricsEntity {
  id: string
  timestamp: string
  requestCount: number
  errorCount: number
  averageLatency: number
  tokensGenerated: number
  tokensProcessed: number
  modelUsage: Record<string, number>
  errorTypes: Record<string, number>
  created_at: string
}

export interface RuntimeTrendData {
  period: 'hour' | 'day' | 'week'
  snapshots: RuntimeSnapshotEntity[]
  metrics: RuntimeMetricsEntity[]
  healthTrends: HealthTrend[]
  modelTrends: ModelTrend[]
  performanceTrends: PerformanceTrend[]
}

export interface HealthTrend {
  timestamp: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  modelCount: number
  runningModelCount: number
  errorCount: number
}

export interface ModelTrend {
  timestamp: string
  modelCount: number
  runningModelCount: number
  newModels: string[]
  removedModels: string[]
}

export interface PerformanceTrend {
  timestamp: string
  averageLatency: number
  requestCount: number
  errorRate: number
  throughput: number
}

export class RuntimeRepository {
  private snapshots: RuntimeSnapshotEntity[] = []
  private metrics: RuntimeMetricsEntity[] = []

  /**
   * Save a runtime snapshot
   */
  async saveSnapshot(snapshot: RuntimeSnapshot): Promise<void> {
    const entity: RuntimeSnapshotEntity = {
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      health: snapshot.health,
      models: snapshot.models,
      runningModels: snapshot.runningModels,
      capabilities: snapshot.capabilities,
      version: snapshot.version,
      created_at: new Date().toISOString()
    }

    this.snapshots.push(entity)
    
    // Keep only the last 1000 snapshots to prevent memory issues
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-1000)
    }
  }

  /**
   * Save runtime metrics
   */
  async saveMetrics(metrics: RuntimeMetrics): Promise<void> {
    const entity: RuntimeMetricsEntity = {
      id: `metrics-${Date.now()}`,
      timestamp: metrics.timestamp,
      requestCount: metrics.requestCount,
      errorCount: metrics.errorCount,
      averageLatency: metrics.averageLatency,
      tokensGenerated: metrics.tokensGenerated,
      tokensProcessed: metrics.tokensProcessed,
      modelUsage: { ...metrics.modelUsage },
      errorTypes: { ...metrics.errorTypes },
      created_at: new Date().toISOString()
    }

    this.metrics.push(entity)
    
    // Keep only the last 1000 metrics entries
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  /**
   * Get recent snapshots
   */
  async getRecentSnapshots(limit = 50): Promise<RuntimeSnapshotEntity[]> {
    return this.snapshots
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Get snapshots in a time range
   */
  async getSnapshotsInTimeRange(
    startTime: Date,
    endTime: Date
  ): Promise<RuntimeSnapshotEntity[]> {
    const start = startTime.getTime()
    const end = endTime.getTime()
    
    return this.snapshots.filter(snapshot => {
      const timestamp = new Date(snapshot.timestamp).getTime()
      return timestamp >= start && timestamp <= end
    })
  }

  /**
   * Get recent metrics
   */
  async getRecentMetrics(limit = 100): Promise<RuntimeMetricsEntity[]> {
    return this.metrics
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Get metrics in a time range
   */
  async getMetricsInTimeRange(
    startTime: Date,
    endTime: Date
  ): Promise<RuntimeMetricsEntity[]> {
    const start = startTime.getTime()
    const end = endTime.getTime()
    
    return this.metrics.filter(metric => {
      const timestamp = new Date(metric.timestamp).getTime()
      return timestamp >= start && timestamp <= end
    })
  }

  /**
   * Compare two snapshots
   */
  async compareSnapshots(
    snapshotId1: string,
    snapshotId2: string
  ): Promise<SnapshotComparison> {
    const snapshot1 = this.snapshots.find(s => s.id === snapshotId1)
    const snapshot2 = this.snapshots.find(s => s.id === snapshotId2)
    
    if (!snapshot1 || !snapshot2) {
      throw new RuntimeError(
        RuntimeErrorCode.MODEL_NOT_FOUND,
        'One or both snapshots not found'
      )
    }

    return this.generateComparison(snapshot1, snapshot2)
  }

  /**
   * Get trend data for a period
   */
  async getTrendData(period: 'hour' | 'day' | 'week'): Promise<RuntimeTrendData> {
    const now = new Date()
    let startTime: Date
    
    switch (period) {
      case 'hour':
        startTime = new Date(now.getTime() - 60 * 60 * 1000)
        break
      case 'day':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
    }

    const [snapshots, metrics] = await Promise.all([
      this.getSnapshotsInTimeRange(startTime, now),
      this.getMetricsInTimeRange(startTime, now)
    ])

    const healthTrends = this.generateHealthTrends(snapshots)
    const modelTrends = this.generateModelTrends(snapshots)
    const performanceTrends = this.generatePerformanceTrends(metrics)

    return {
      period,
      snapshots,
      metrics,
      healthTrends,
      modelTrends,
      performanceTrends
    }
  }

  /**
   * Get the latest snapshot
   */
  async getLatestSnapshot(): Promise<RuntimeSnapshotEntity | null> {
    if (this.snapshots.length === 0) {
      return null
    }
    
    return this.snapshots.reduce((latest, current) => 
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    )
  }

  /**
   * Clean up old data
   */
  async cleanup(olderThanDays = 30): Promise<void> {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
    const cutoffTime = cutoffDate.getTime()
    
    this.snapshots = this.snapshots.filter(snapshot => 
      new Date(snapshot.timestamp).getTime() >= cutoffTime
    )
    
    this.metrics = this.metrics.filter(metric => 
      new Date(metric.timestamp).getTime() >= cutoffTime
    )
  }

  /**
   * Get statistics about stored data
   */
  async getStatistics(): Promise<RepositoryStatistics> {
    return {
      snapshotCount: this.snapshots.length,
      metricsCount: this.metrics.length,
      oldestSnapshot: this.snapshots.length > 0 ? this.snapshots[0].timestamp : null,
      newestSnapshot: this.snapshots.length > 0 ? 
        this.snapshots.reduce((newest, current) => 
          new Date(current.timestamp) > new Date(newest.timestamp) ? current : newest
        ).timestamp : null,
      oldestMetrics: this.metrics.length > 0 ? this.metrics[0].timestamp : null,
      newestMetrics: this.metrics.length > 0 ? 
        this.metrics.reduce((newest, current) => 
          new Date(current.timestamp) > new Date(newest.timestamp) ? current : newest
        ).timestamp : null
    }
  }

  private generateComparison(
    snapshot1: RuntimeSnapshotEntity,
    snapshot2: RuntimeSnapshotEntity
  ): SnapshotComparison {
    const healthChanges = this.compareHealth(snapshot1.health, snapshot2.health)
    const modelChanges = this.compareModels(snapshot1.models, snapshot2.models)
    const runningChanges = this.compareRunningModels(snapshot1.runningModels, snapshot2.runningModels)
    
    return {
      snapshot1: {
        id: snapshot1.id,
        timestamp: snapshot1.timestamp,
        health: snapshot1.health,
        modelCount: snapshot1.models.length,
        runningModelCount: snapshot1.runningModels.length
      },
      snapshot2: {
        id: snapshot2.id,
        timestamp: snapshot2.timestamp,
        health: snapshot2.health,
        modelCount: snapshot2.models.length,
        runningModelCount: snapshot2.runningModels.length
      },
      healthChanges,
      modelChanges,
      runningChanges,
      timeDifference: new Date(snapshot2.timestamp).getTime() - new Date(snapshot1.timestamp).getTime()
    }
  }

  private compareHealth(health1: RuntimeHealth, health2: RuntimeHealth): HealthChanges {
    return {
      statusChanged: health1.status !== health2.status,
      latencyChange: health2.latency - health1.latency,
      modelCountChange: health2.modelCount - health1.modelCount,
      runningModelCountChange: health2.runningModelCount - health1.runningModelCount,
      newErrors: health2.errors.filter(e => !health1.errors.includes(e)),
      resolvedErrors: health1.errors.filter(e => !health2.errors.includes(e))
    }
  }

  private compareModels(models1: RuntimeModel[], models2: RuntimeModel[]): ModelChanges {
    const names1 = new Set(models1.map(m => m.name))
    const names2 = new Set(models2.map(m => m.name))
    
    const added = Array.from(names2).filter(name => !names1.has(name))
    const removed = Array.from(names1).filter(name => !names2.has(name))
    const unchanged = Array.from(names1).filter(name => names2.has(name))
    
    const updated = unchanged.filter(name => {
      const model1 = models1.find(m => m.name === name)
      const model2 = models2.find(m => m.name === name)
      return model1?.digest !== model2?.digest
    })
    
    return { added, removed, updated, unchanged }
  }

  private compareRunningModels(
    running1: RuntimeModelState[], 
    running2: RuntimeModelState[]
  ): RunningModelChanges {
    const names1 = new Set(running1.map(m => m.name))
    const names2 = new Set(running2.map(m => m.name))
    
    const started = Array.from(names2).filter(name => !names1.has(name))
    const stopped = Array.from(names1).filter(name => !names2.has(name))
    
    return { started, stopped }
  }

  private generateHealthTrends(snapshots: RuntimeSnapshotEntity[]): HealthTrend[] {
    return snapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      status: snapshot.health.status,
      latency: snapshot.health.latency,
      modelCount: snapshot.health.modelCount,
      runningModelCount: snapshot.health.runningModelCount,
      errorCount: snapshot.health.errors.length
    }))
  }

  private generateModelTrends(snapshots: RuntimeSnapshotEntity[]): ModelTrend[] {
    const trends: ModelTrend[] = []
    
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1]
      const curr = snapshots[i]
      
      const prevNames = new Set(prev.models.map(m => m.name))
      const currNames = new Set(curr.models.map(m => m.name))
      
      const newModels = Array.from(currNames).filter(name => !prevNames.has(name))
      const removedModels = Array.from(prevNames).filter(name => !currNames.has(name))
      
      trends.push({
        timestamp: curr.timestamp,
        modelCount: curr.models.length,
        runningModelCount: curr.runningModels.length,
        newModels,
        removedModels
      })
    }
    
    return trends
  }

  private generatePerformanceTrends(metrics: RuntimeMetricsEntity[]): PerformanceTrend[] {
    return metrics.map(metric => ({
      timestamp: metric.timestamp,
      averageLatency: metric.averageLatency,
      requestCount: metric.requestCount,
      errorRate: metric.requestCount > 0 ? metric.errorCount / metric.requestCount : 0,
      throughput: metric.requestCount // This would need time window calculation for real throughput
    }))
  }
}

export interface SnapshotComparison {
  snapshot1: {
    id: string
    timestamp: string
    health: RuntimeHealth
    modelCount: number
    runningModelCount: number
  }
  snapshot2: {
    id: string
    timestamp: string
    health: RuntimeHealth
    modelCount: number
    runningModelCount: number
  }
  healthChanges: HealthChanges
  modelChanges: ModelChanges
  runningChanges: RunningModelChanges
  timeDifference: number
}

export interface HealthChanges {
  statusChanged: boolean
  latencyChange: number
  modelCountChange: number
  runningModelCountChange: number
  newErrors: string[]
  resolvedErrors: string[]
}

export interface ModelChanges {
  added: string[]
  removed: string[]
  updated: string[]
  unchanged: string[]
}

export interface RunningModelChanges {
  started: string[]
  stopped: string[]
}

export interface RepositoryStatistics {
  snapshotCount: number
  metricsCount: number
  oldestSnapshot: string | null
  newestSnapshot: string | null
  oldestMetrics: string | null
  newestMetrics: string | null
}

// Singleton instance
let runtimeRepository: RuntimeRepository | null = null

export function getRuntimeRepository(): RuntimeRepository {
  if (!runtimeRepository) {
    runtimeRepository = new RuntimeRepository()
  }
  return runtimeRepository
}
