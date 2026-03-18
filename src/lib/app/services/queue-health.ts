/**
 * Queue Health Service
 * 
 * Monitors queue health, handles restart recovery, and provides
 * comprehensive health metrics for the job queue system.
 */

import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import type { Job, ToolRun } from '@/lib/db/schema'
import { jobRepository, toolRunRepository } from '@/lib/app/persistence/job-repository'
import { queueManager } from './job-state-machine'

export interface QueueHealthMetrics {
  timestamp: Date
  queueStats: {
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
    retrying: number
    overdue: number
  }
  workerStats: {
    activeWorkers: number
    totalJobsProcessed: number
    averageProcessingTime: number
    successRate: number
  }
  systemStats: {
    totalJobs: number
    jobsLastHour: number
    jobsLastDay: number
    averageJobDuration: number
    errorRate: number
  }
  healthStatus: 'healthy' | 'warning' | 'critical'
  issues: HealthIssue[]
}

export interface HealthIssue {
  id: string
  type: 'overdue_jobs' | 'high_error_rate' | 'queue_backlog' | 'worker_unavailable' | 'stalled_jobs'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: any
  timestamp: Date
  resolved: boolean
}

export interface RecoveryAction {
  id: string
  type: 'cancel_overdue' | 'retry_failed' | 'reset_stalled' | 'cleanup_old' | 'restart_workers'
  description: string
  execute: () => Promise<RecoveryResult>
}

export interface RecoveryResult {
  success: boolean
  message: string
  details: any
  timestamp: Date
}

/**
 * Queue Health Monitor
 */
export class QueueHealthMonitor extends EventEmitter {
  private isRunning: boolean = false
  private monitoringInterval?: NodeJS.Timeout
  private healthHistory: QueueHealthMetrics[] = []
  private maxHistorySize: number = 100
  private issues: Map<string, HealthIssue> = new Map()

  constructor(
    private monitoringIntervalMs: number = 30000 // 30 seconds
  ) {
    super()
  }

  /**
   * Start health monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) return

    this.isRunning = true
    this.emit('monitor-started')

    // Initial health check
    await this.performHealthCheck()

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck()
      } catch (error) {
        this.emit('monitor-error', error)
      }
    }, this.monitoringIntervalMs)
  }

  /**
   * Stop health monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return

    this.isRunning = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    this.emit('monitor-stopped')
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    const timestamp = new Date()
    
    // Gather queue statistics
    const queueStats = await this.getQueueStats()
    
    // Gather worker statistics
    const workerStats = await this.getWorkerStats()
    
    // Gather system statistics
    const systemStats = await this.getSystemStats()
    
    // Analyze health and detect issues
    const issues = await this.detectHealthIssues(queueStats, workerStats, systemStats)
    
    // Determine overall health status
    const healthStatus = this.calculateHealthStatus(issues)
    
    // Create metrics object
    const metrics: QueueHealthMetrics = {
      timestamp,
      queueStats,
      workerStats,
      systemStats,
      healthStatus,
      issues: issues.filter(issue => !issue.resolved)
    }

    // Store in history
    this.healthHistory.push(metrics)
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift()
    }

    // Emit health update
    this.emit('health-update', metrics)
    
    // Emit alerts for new issues
    for (const issue of issues) {
      if (!this.issues.has(issue.id)) {
        this.issues.set(issue.id, issue)
        this.emit('health-issue', issue)
      }
    }

    // Clean up resolved issues
    for (const [id, issue] of this.issues) {
      if (issue.resolved || Date.now() - issue.timestamp.getTime() > 3600000) { // 1 hour
        this.issues.delete(id)
      }
    }
  }

  /**
   * Get queue statistics
   */
  private async getQueueStats() {
    return await queueManager.getStats()
  }

  /**
   * Get worker statistics
   */
  private async getWorkerStats() {
    // This would integrate with the worker manager
    // For now, return placeholder data
    const runningJobs = await jobRepository.list({ status: 'running' })
    
    return {
      activeWorkers: 1, // Would come from worker manager
      totalJobsProcessed: 0, // Would come from worker metrics
      averageProcessingTime: 0,
      successRate: 0
    }
  }

  /**
   * Get system statistics
   */
  private async getSystemStats() {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 3600000)
    const oneDayAgo = new Date(now.getTime() - 86400000)

    const [allJobs, recentJobs, lastDayJobs] = await Promise.all([
      jobRepository.list({ limit: 1000 }),
      jobRepository.list({ limit: 100 }),
      jobRepository.list({ limit: 500 })
    ])

    const jobsLastHour = recentJobs.filter(job => 
      new Date(job.createdAt) >= oneHourAgo
    ).length

    const jobsLastDay = lastDayJobs.filter(job => 
      new Date(job.createdAt) >= oneDayAgo
    ).length

    const completedJobs = allJobs.filter(job => job.status === 'completed')
    const failedJobs = allJobs.filter(job => job.status === 'failed')

    const averageJobDuration = completedJobs.reduce((sum, job) => {
      if (job.startedAt && job.completedAt) {
        return sum + (job.completedAt.getTime() - job.startedAt.getTime())
      }
      return sum
    }, 0) / Math.max(completedJobs.length, 1)

    const errorRate = allJobs.length > 0 ? failedJobs.length / allJobs.length : 0

    return {
      totalJobs: allJobs.length,
      jobsLastHour,
      jobsLastDay,
      averageJobDuration,
      errorRate
    }
  }

  /**
   * Detect health issues
   */
  private async detectHealthIssues(queueStats: any, workerStats: any, systemStats: any): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    // Check for overdue jobs
    if (queueStats.overdue > 0) {
      issues.push({
        id: `overdue-${Date.now()}`,
        type: 'overdue_jobs',
        severity: queueStats.overdue > 5 ? 'high' : 'medium',
        message: `${queueStats.overdue} jobs are overdue`,
        details: { overdueCount: queueStats.overdue },
        timestamp: new Date(),
        resolved: false
      })
    }

    // Check for high error rate
    if (systemStats.errorRate > 0.2) { // 20% error rate
      issues.push({
        id: `error-rate-${Date.now()}`,
        type: 'high_error_rate',
        severity: systemStats.errorRate > 0.5 ? 'critical' : 'high',
        message: `Error rate is ${(systemStats.errorRate * 100).toFixed(1)}%`,
        details: { errorRate: systemStats.errorRate },
        timestamp: new Date(),
        resolved: false
      })
    }

    // Check for queue backlog
    if (queueStats.pending > 50) {
      issues.push({
        id: `backlog-${Date.now()}`,
        type: 'queue_backlog',
        severity: queueStats.pending > 100 ? 'high' : 'medium',
        message: `${queueStats.pending} jobs pending in queue`,
        details: { pendingCount: queueStats.pending },
        timestamp: new Date(),
        resolved: false
      })
    }

    // Check for worker availability
    if (workerStats.activeWorkers === 0 && queueStats.pending > 0) {
      issues.push({
        id: `workers-${Date.now()}`,
        type: 'worker_unavailable',
        severity: 'high',
        message: 'No active workers but jobs are pending',
        details: { activeWorkers: workerStats.activeWorkers, pendingJobs: queueStats.pending },
        timestamp: new Date(),
        resolved: false
      })
    }

    // Check for stalled jobs (running too long)
    const stalledJobs = await this.getStalledJobs()
    if (stalledJobs.length > 0) {
      issues.push({
        id: `stalled-${Date.now()}`,
        type: 'stalled_jobs',
        severity: 'medium',
        message: `${stalledJobs.length} jobs appear to be stalled`,
        details: { stalledJobs: stalledJobs.map(job => job.id) },
        timestamp: new Date(),
        resolved: false
      })
    }

    return issues
  }

  /**
   * Get stalled jobs
   */
  private async getStalledJobs(): Promise<Job[]> {
    const staleThreshold = 30 * 60 * 1000 // 30 minutes
    const cutoffTime = new Date(Date.now() - staleThreshold)
    
    return await jobRepository.list({
      status: 'running',
      limit: 50
    }).then(jobs => 
      jobs.filter(job => 
        job.startedAt && job.startedAt < cutoffTime
      )
    )
  }

  /**
   * Calculate overall health status
   */
  private calculateHealthStatus(issues: HealthIssue[]): 'healthy' | 'warning' | 'critical' {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical')
    const highIssues = issues.filter(issue => issue.severity === 'high')
    
    if (criticalIssues.length > 0) {
      return 'critical'
    } else if (highIssues.length > 0 || issues.length > 3) {
      return 'warning'
    } else {
      return 'healthy'
    }
  }

  /**
   * Get available recovery actions
   */
  getRecoveryActions(): RecoveryAction[] {
    return [
      {
        id: 'cancel-overdue',
        type: 'cancel_overdue',
        description: 'Cancel all overdue jobs',
        execute: async () => this.cancelOverdueJobs()
      },
      {
        id: 'retry-failed',
        type: 'retry_failed',
        description: 'Retry all failed jobs',
        execute: async () => this.retryFailedJobs()
      },
      {
        id: 'reset-stalled',
        type: 'reset_stalled',
        description: 'Reset stalled jobs to failed',
        execute: async () => this.resetStalledJobs()
      },
      {
        id: 'cleanup-old',
        type: 'cleanup_old',
        description: 'Clean up old completed jobs',
        execute: async () => this.cleanupOldJobs()
      }
    ]
  }

  /**
   * Recovery action implementations
   */
  private async cancelOverdueJobs(): Promise<RecoveryResult> {
    try {
      const overdueJobs = await jobRepository.getTimedOutJobs()
      let cancelled = 0

      for (const job of overdueJobs) {
        await queueManager.cancelJob(job.id)
        cancelled++
      }

      return {
        success: true,
        message: `Cancelled ${cancelled} overdue jobs`,
        details: { cancelledCount: cancelled },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to cancel overdue jobs: ${error}`,
        details: { error },
        timestamp: new Date()
      }
    }
  }

  private async retryFailedJobs(): Promise<RecoveryResult> {
    try {
      const retryableJobs = await jobRepository.getRetryableJobs()
      let retried = 0

      for (const job of retryableJobs) {
        await jobRepository.update(job.id, { status: 'pending' })
        retried++
      }

      return {
        success: true,
        message: `Retried ${retried} failed jobs`,
        details: { retriedCount: retried },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to retry failed jobs: ${error}`,
        details: { error },
        timestamp: new Date()
      }
    }
  }

  private async resetStalledJobs(): Promise<RecoveryResult> {
    try {
      const stalledJobs = await this.getStalledJobs()
      let reset = 0

      for (const job of stalledJobs) {
        await queueManager.failJob(job.id, 'Job stalled - reset by health monitor')
        reset++
      }

      return {
        success: true,
        message: `Reset ${reset} stalled jobs`,
        details: { resetCount: reset },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset stalled jobs: ${error}`,
        details: { error },
        timestamp: new Date()
      }
    }
  }

  private async cleanupOldJobs(): Promise<RecoveryResult> {
    try {
      const deletedCount = await queueManager.cleanup(7 * 24 * 60 * 60 * 1000) // 7 days

      return {
        success: true,
        message: `Cleaned up ${deletedCount} old jobs`,
        details: { deletedCount },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to cleanup old jobs: ${error}`,
        details: { error },
        timestamp: new Date()
      }
    }
  }

  /**
   * Get current health metrics
   */
  getCurrentHealth(): QueueHealthMetrics | null {
    return this.healthHistory[this.healthHistory.length - 1] || null
  }

  /**
   * Get health history
   */
  getHealthHistory(limit?: number): QueueHealthMetrics[] {
    if (limit) {
      return this.healthHistory.slice(-limit)
    }
    return [...this.healthHistory]
  }

  /**
   * Get active issues
   */
  getActiveIssues(): HealthIssue[] {
    return Array.from(this.issues.values()).filter(issue => !issue.resolved)
  }
}

// Export singleton instance
export const queueHealthMonitor = new QueueHealthMonitor()
