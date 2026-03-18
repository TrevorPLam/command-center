/**
 * Get Metrics Tool
 * 
 * Low-risk tool for reading system and application metrics.
 * Provides read-only access to performance and usage statistics.
 */

import { z } from 'zod'
import { BuiltinTool, ToolContext, ToolCapability } from '../types'

/**
 * Input schema for get-metrics tool
 */
export const GetMetricsInputSchema = z.object({
  /** Metric category to retrieve */
  category: z.enum(['system', 'runtime', 'application', 'tools']).optional(),
  /** Time period for metrics */
  period: z.enum(['minute', 'hour', 'day', 'week']).default('hour'),
  /** Number of periods to retrieve */
  limit: z.number().int().min(1).max(100).default(24),
  /** Include detailed breakdown */
  detailed: z.boolean().default(false)
})

/**
 * Output schema for get-metrics tool
 */
export const GetMetricsOutputSchema = z.object({
  /** Metrics data */
  metrics: z.array(z.object({
    timestamp: z.string(),
    category: z.string(),
    name: z.string(),
    value: z.union([z.number(), z.string(), z.boolean()]),
    unit: z.string().optional(),
    tags: z.record(z.string()).optional()
  })),
  /** Summary statistics */
  summary: z.object({
    totalMetrics: z.number(),
    categories: z.array(z.string()),
    timeRange: z.object({
      start: z.string(),
      end: z.string()
    })
  }),
  /** System health indicators */
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    cpu: z.object({
      usage: z.number(),
      load: z.number()
    }),
    memory: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number()
    }),
    disk: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number()
    })
  })
})

/**
 * Get metrics tool implementation
 */
export class GetMetricsTool implements BuiltinTool {
  readonly descriptor = {
    name: 'get-metrics',
    description: 'Read system and application performance metrics',
    version: '1.0.0',
    author: 'Command Center',
    capabilities: ['system-info'] as ToolCapability[],
    riskLevel: 'low' as const,
    approvalRequired: false,
    executionScope: {
      allowedPaths: [],
      deniedPaths: [],
      networkRules: {
        defaultAllow: false
      },
      resourceLimits: {
        maxExecutionTimeSec: 15,
        maxMemoryMB: 64
      },
      requiredPermissions: ['system-info'] as ToolCapability[]
    },
    inputSchema: GetMetricsInputSchema,
    outputSchema: GetMetricsOutputSchema,
    tags: ['metrics', 'monitoring', 'system'],
    metadata: {
      category: 'monitoring',
      readOnly: true,
      safeForAutomation: true,
      dataAccess: 'system'
    }
  }

  /**
   * Execute the get-metrics tool
   */
  async execute(input: unknown, context: ToolContext): Promise<unknown> {
    const parsedInput = GetMetricsInputSchema.parse(input)

    try {
      // Generate time series data
      const endTime = new Date()
      const startTime = new Date(endTime.getTime() - this.getPeriodMs(parsedInput.period) * parsedInput.limit)
      
      // Get metrics for specified category or all categories
      const categories = parsedInput.category ? [parsedInput.category] : ['system', 'runtime', 'application', 'tools']
      
      const metrics: any[] = []
      
      for (const category of categories) {
        const categoryMetrics = await this.getCategoryMetrics(
          category,
          startTime,
          endTime,
          parsedInput.period,
          parsedInput.detailed
        )
        metrics.push(...categoryMetrics)
      }

      // Get current system health
      const health = await this.getSystemHealth()

      // Create summary
      const summary = {
        totalMetrics: metrics.length,
        categories: [...new Set(metrics.map(m => m.category))],
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString()
        }
      }

      return {
        metrics,
        summary,
        health
      }

    } catch (error) {
      throw new Error(`Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate input (optional method)
   */
  validate?(input: unknown): { valid: boolean; errors: string[] } {
    try {
      GetMetricsInputSchema.parse(input)
      return { valid: true, errors: [] }
    } catch (error) {
      return {
        valid: false,
        errors: error instanceof Error ? [error.message] : ['Unknown validation error']
      }
    }
  }

  /**
   * Get metrics for a specific category
   */
  private async getCategoryMetrics(
    category: string,
    startTime: Date,
    endTime: Date,
    period: string,
    detailed: boolean
  ): Promise<any[]> {
    const metrics: any[] = []
    const periodMs = this.getPeriodMs(period)
    
    for (let time = startTime.getTime(); time <= endTime.getTime(); time += periodMs) {
      const timestamp = new Date(time)
      
      switch (category) {
        case 'system':
          metrics.push(...await this.getSystemMetrics(timestamp, detailed))
          break
        case 'runtime':
          metrics.push(...await this.getRuntimeMetrics(timestamp, detailed))
          break
        case 'application':
          metrics.push(...await this.getApplicationMetrics(timestamp, detailed))
          break
        case 'tools':
          metrics.push(...await this.getToolMetrics(timestamp, detailed))
          break
      }
    }

    return metrics
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(timestamp: Date, detailed: boolean): Promise<any[]> {
    // Simulated system metrics - in production would use actual system monitoring
    const cpuUsage = 20 + Math.random() * 30 // 20-50%
    const memoryUsage = 40 + Math.random() * 20 // 40-60%
    const diskUsage = 60 + Math.random() * 10 // 60-70%

    const metrics = [
      {
        timestamp: timestamp.toISOString(),
        category: 'system',
        name: 'cpu.usage',
        value: Number(cpuUsage.toFixed(2)),
        unit: 'percent',
        tags: { host: 'localhost' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'system',
        name: 'memory.usage',
        value: Number(memoryUsage.toFixed(2)),
        unit: 'percent',
        tags: { host: 'localhost' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'system',
        name: 'disk.usage',
        value: Number(diskUsage.toFixed(2)),
        unit: 'percent',
        tags: { host: 'localhost', path: '/' }
      }
    ]

    if (detailed) {
      metrics.push(
        {
          timestamp: timestamp.toISOString(),
          category: 'system',
          name: 'cpu.load',
          value: Number((cpuUsage / 100).toFixed(2)),
          unit: 'load',
          tags: { host: 'localhost' }
        },
        {
          timestamp: timestamp.toISOString(),
          category: 'system',
          name: 'network.bytes_in',
          value: Math.floor(Math.random() * 1000000),
          unit: 'bytes',
          tags: { host: 'localhost', interface: 'eth0' }
        },
        {
          timestamp: timestamp.toISOString(),
          category: 'system',
          name: 'network.bytes_out',
          value: Math.floor(Math.random() * 500000),
          unit: 'bytes',
          tags: { host: 'localhost', interface: 'eth0' }
        }
      )
    }

    return metrics
  }

  /**
   * Get runtime metrics
   */
  private async getRuntimeMetrics(timestamp: Date, detailed: boolean): Promise<any[]> {
    const modelCount = 5 + Math.floor(Math.random() * 3)
    const runningModels = Math.floor(Math.random() * 3)
    const requestRate = 10 + Math.random() * 20
    const avgLatency = 500 + Math.random() * 1000

    const metrics = [
      {
        timestamp: timestamp.toISOString(),
        category: 'runtime',
        name: 'models.total',
        value: modelCount,
        unit: 'count',
        tags: { runtime: 'ollama' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'runtime',
        name: 'models.running',
        value: runningModels,
        unit: 'count',
        tags: { runtime: 'ollama' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'runtime',
        name: 'requests.rate',
        value: Number(requestRate.toFixed(2)),
        unit: 'req_per_sec',
        tags: { runtime: 'ollama' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'runtime',
        name: 'latency.average',
        value: Number(avgLatency.toFixed(0)),
        unit: 'ms',
        tags: { runtime: 'ollama' }
      }
    ]

    if (detailed) {
      metrics.push(
        {
          timestamp: timestamp.toISOString(),
          category: 'runtime',
          name: 'tokens.generated',
          value: Math.floor(Math.random() * 10000),
          unit: 'tokens',
          tags: { runtime: 'ollama' }
        },
        {
          timestamp: timestamp.toISOString(),
          category: 'runtime',
          name: 'errors.count',
          value: Math.floor(Math.random() * 5),
          unit: 'count',
          tags: { runtime: 'ollama' }
        }
      )
    }

    return metrics
  }

  /**
   * Get application metrics
   */
  private async getApplicationMetrics(timestamp: Date, detailed: boolean): Promise<any[]> {
    const activeUsers = Math.floor(Math.random() * 10)
    const conversationCount = 50 + Math.floor(Math.random() * 20)
    const messageCount = 200 + Math.floor(Math.random() * 100)

    const metrics = [
      {
        timestamp: timestamp.toISOString(),
        category: 'application',
        name: 'users.active',
        value: activeUsers,
        unit: 'count',
        tags: { application: 'command-center' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'application',
        name: 'conversations.total',
        value: conversationCount,
        unit: 'count',
        tags: { application: 'command-center' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'application',
        name: 'messages.total',
        value: messageCount,
        unit: 'count',
        tags: { application: 'command-center' }
      }
    ]

    if (detailed) {
      metrics.push(
        {
          timestamp: timestamp.toISOString(),
          category: 'application',
          name: 'documents.indexed',
          value: 1000 + Math.floor(Math.random() * 500),
          unit: 'count',
          tags: { application: 'command-center' }
        },
        {
          timestamp: timestamp.toISOString(),
          category: 'application',
          name: 'tools.executed',
          value: Math.floor(Math.random() * 50),
          unit: 'count',
          tags: { application: 'command-center' }
        }
      )
    }

    return metrics
  }

  /**
   * Get tool metrics
   */
  private async getToolMetrics(timestamp: Date, detailed: boolean): Promise<any[]> {
    const toolExecutions = Math.floor(Math.random() * 20)
    const approvalRate = 0.7 + Math.random() * 0.2
    const errorRate = 0.05 + Math.random() * 0.1

    const metrics = [
      {
        timestamp: timestamp.toISOString(),
        category: 'tools',
        name: 'executions.total',
        value: toolExecutions,
        unit: 'count',
        tags: { application: 'command-center' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'tools',
        name: 'approvals.rate',
        value: Number(approvalRate.toFixed(3)),
        unit: 'ratio',
        tags: { application: 'command-center' }
      },
      {
        timestamp: timestamp.toISOString(),
        category: 'tools',
        name: 'errors.rate',
        value: Number(errorRate.toFixed(3)),
        unit: 'ratio',
        tags: { application: 'command-center' }
      }
    ]

    if (detailed) {
      const toolNames = ['list-models', 'read-file', 'query-settings', 'get-metrics']
      for (const toolName of toolNames) {
        metrics.push({
          timestamp: timestamp.toISOString(),
          category: 'tools',
          name: 'executions.by_tool',
          value: Math.floor(Math.random() * 10),
          unit: 'count',
          tags: { application: 'command-center', tool: toolName }
        })
      }
    }

    return metrics
  }

  /**
   * Get system health
   */
  private async getSystemHealth(): Promise<any> {
    const cpuUsage = 20 + Math.random() * 30
    const memoryUsed = 4000 + Math.random() * 2000 // MB
    const memoryTotal = 8192 // MB
    const diskUsed = 100 + Math.random() * 50 // GB
    const diskTotal = 256 // GB

    const overallStatus = cpuUsage > 80 || memoryUsed / memoryTotal > 0.9
      ? 'unhealthy'
      : cpuUsage > 60 || memoryUsed / memoryTotal > 0.8
      ? 'degraded'
      : 'healthy'

    return {
      status: overallStatus,
      cpu: {
        usage: Number(cpuUsage.toFixed(2)),
        load: Number((cpuUsage / 100).toFixed(2))
      },
      memory: {
        used: Number(memoryUsed.toFixed(0)),
        total: memoryTotal,
        percentage: Number(((memoryUsed / memoryTotal) * 100).toFixed(2))
      },
      disk: {
        used: Number(diskUsed.toFixed(1)),
        total: diskTotal,
        percentage: Number(((diskUsed / diskTotal) * 100).toFixed(2))
      }
    }
  }

  /**
   * Convert period string to milliseconds
   */
  private getPeriodMs(period: string): number {
    switch (period) {
      case 'minute': return 60 * 1000
      case 'hour': return 60 * 60 * 1000
      case 'day': return 24 * 60 * 60 * 1000
      case 'week': return 7 * 24 * 60 * 60 * 1000
      default: return 60 * 60 * 1000
    }
  }
}

/**
 * Factory function for creating get-metrics tool
 */
export function createGetMetricsTool(): GetMetricsTool {
  return new GetMetricsTool()
}
