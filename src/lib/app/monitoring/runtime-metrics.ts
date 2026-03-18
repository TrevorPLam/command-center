/**
 * Runtime metrics collector for Ollama and Command Center
 * Implements CC-011-1: Implement host and runtime metric collectors
 */

import * as si from 'systeminformation'
import type { RuntimeMetrics, RunningModel } from './types'
import { env } from '@/lib/config/env'

// Import os module for hostname
const os = require('os')

export class RuntimeMetricsCollector {
  private static instance: RuntimeMetricsCollector
  private startTime = Date.now()

  private constructor() {}

  static getInstance(): RuntimeMetricsCollector {
    if (!RuntimeMetricsCollector.instance) {
      RuntimeMetricsCollector.instance = new RuntimeMetricsCollector()
    }
    return RuntimeMetricsCollector.instance
  }

  /**
   * Collect runtime metrics from Ollama and Command Center
   */
  async collectRuntimeMetrics(): Promise<RuntimeMetrics> {
    const timestamp = Date.now()

    const [ollamaMetrics, commandCenterMetrics] = await Promise.all([
      this.collectOllamaMetrics(),
      this.collectCommandCenterMetrics()
    ])

    return {
      timestamp,
      ollama: ollamaMetrics,
      commandCenter: commandCenterMetrics
    }
  }

  /**
   * Collect Ollama-specific metrics
   */
  private async collectOllamaMetrics(): Promise<RuntimeMetrics['ollama']> {
    const startTime = Date.now()
    
    try {
      // Test Ollama connectivity
      const healthResponse = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })

      const latency = Date.now() - startTime

      if (!healthResponse.ok) {
        return {
          status: 'error',
          latency,
          modelCount: 0,
          runningModels: [],
          errors: [`HTTP ${healthResponse.status}: ${healthResponse.statusText}`]
        }
      }

      const data = await healthResponse.json()
      const models = data.models || []

      // Get running models
      const runningModels = await this.getRunningModels()

      return {
        status: 'healthy',
        latency,
        modelCount: models.length,
        runningModels,
        errors: []
      }
    } catch (error) {
      return {
        status: 'error',
        latency: Date.now() - startTime,
        modelCount: 0,
        runningModels: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Get currently running models from Ollama
   */
  private async getRunningModels(): Promise<RunningModel[]> {
    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/ps`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      const runningModels = data.models || []

      return runningModels.map((model: any) => ({
        name: model.name || 'unknown',
        status: this.parseModelStatus(model.status),
        size: model.size || 0,
        memoryUsage: model.vram?.total || 0,
        pid: model.process?.pid
      }))
    } catch {
      return []
    }
  }

  /**
   * Parse model status from Ollama
   */
  private parseModelStatus(status: string): RunningModel['status'] {
    switch (status?.toLowerCase()) {
      case 'running':
      case 'loaded':
        return 'running'
      case 'loading':
        return 'loading'
      default:
        return 'error'
    }
  }

  /**
   * Collect Command Center application metrics
   */
  private async collectCommandCenterMetrics(): Promise<RuntimeMetrics['commandCenter']> {
    const uptime = Date.now() - this.startTime
    
    // Get memory usage from Node.js process
    const memUsage = process.memoryUsage()
    const memoryUsage = memUsage.heapUsed / 1024 / 1024 // MB

    // Get CPU usage (approximation)
    const cpuUsage = process.cpuUsage()
    const cpuPercent = this.calculateCpuPercent(cpuUsage)

    return {
      uptime,
      memoryUsage,
      cpuUsage: cpuPercent
    }
  }

  /**
   * Calculate CPU usage percentage from process.cpuUsage()
   */
  private calculateCpuPercent(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified calculation
    // In a real implementation, you'd track this over time
    const user = cpuUsage.user / 1000 // Convert to milliseconds
    const system = cpuUsage.system / 1000
    const total = user + system
    
    // Return a reasonable approximation
    return Math.min(total / 1000, 100) // Cap at 100%
  }

  /**
   * Get Ollama health status
   */
  async getOllamaHealth(): Promise<{
    status: 'pass' | 'warn' | 'fail'
    message?: string
    latency?: number
  }> {
    const startTime = Date.now()

    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })

      const latency = Date.now() - startTime

      if (!response.ok) {
        return {
          status: 'fail',
          message: `Ollama unavailable: HTTP ${response.status}`,
          latency
        }
      }

      // Check latency
      if (latency > 2000) {
        return {
          status: 'warn',
          message: `Ollama responding slowly: ${latency}ms`,
          latency
        }
      }

      return {
        status: 'pass',
        message: 'Ollama healthy',
        latency
      }
    } catch (error) {
      return {
        status: 'fail',
        message: `Ollama connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get comprehensive runtime health
   */
  async getRuntimeHealth(): Promise<{
    status: 'pass' | 'warn' | 'fail'
    checks: Array<{
      name: string
      status: 'pass' | 'warn' | 'fail'
      message?: string
      duration?: number
    }>
  }> {
    const checks = []

    // Ollama health check
    const ollamaStart = Date.now()
    const ollamaHealth = await this.getOllamaHealth()
    const ollamaDuration = Date.now() - ollamaStart

    checks.push({
      name: 'Ollama Runtime',
      status: ollamaHealth.status,
      message: ollamaHealth.message,
      duration: ollamaDuration
    })

    // Command Center health check
    const uptime = Date.now() - this.startTime
    const memUsage = process.memoryUsage()
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100

    let ccStatus: 'pass' | 'warn' | 'fail' = 'pass'
    let ccMessage = `Uptime: ${Math.floor(uptime / 1000)}s, Memory: ${memoryPercent.toFixed(1)}%`

    if (memoryPercent > 85) {
      ccStatus = 'warn'
      ccMessage = `High memory usage: ${memoryPercent.toFixed(1)}%`
    }

    if (memoryPercent > 95) {
      ccStatus = 'fail'
      ccMessage = `Critical memory usage: ${memoryPercent.toFixed(1)}%`
    }

    checks.push({
      name: 'Command Center',
      status: ccStatus,
      message: ccMessage
    })

    // Overall status
    const hasFail = checks.some(c => c.status === 'fail')
    const hasWarn = checks.some(c => c.status === 'warn')
    const overallStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass'

    return {
      status: overallStatus,
      checks
    }
  }
}

// Export singleton instance
export const runtimeMetricsCollector = RuntimeMetricsCollector.getInstance()
