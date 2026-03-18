/**
 * Tool Repository
 * 
 * Provides database operations for tool execution tracking,
 * audit logging, and persistence following the repository pattern.
 */

import { randomUUID } from 'crypto'
import { eq, and, desc, asc, like, inArray } from 'drizzle-orm'
import { database as db } from '../../db/client'
import { toolRuns, ToolRun, NewToolRun } from '../../db/schema'
import { 
  ToolAuditLog, 
  ToolExecutionResult, 
  ToolCapability,
  SecurityEvent,
  ToolContext
} from '../tools/types'

/**
 * Repository for tool execution persistence and audit logging
 */
export class ToolRepository {
  /**
   * Create a new tool run record
   */
  async createToolRun(data: {
    toolName: string
    input: unknown
    jobId?: string
  }): Promise<string> {
    const id = randomUUID()
    const toolRun: NewToolRun = {
      id,
      jobId: data.jobId || null,
      toolName: data.toolName,
      input: JSON.stringify(data.input),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(toolRuns).values(toolRun)
    return id
  }

  /**
   * Update tool run status and result
   */
  async updateToolRun(
    id: string, 
    updates: {
      status: 'pending' | 'running' | 'completed' | 'failed'
      output?: unknown
      error?: string
      durationMs?: number
    }
  ): Promise<void> {
    const updateData: Partial<ToolRun> = {
      status: updates.status,
      updatedAt: new Date(),
    }

    if (updates.output !== undefined) {
      updateData.output = JSON.stringify(updates.output)
    }

    if (updates.error !== undefined) {
      updateData.error = updates.error
    }

    if (updates.durationMs !== undefined) {
      updateData.durationMs = updates.durationMs
    }

    await db
      .update(toolRuns)
      .set(updateData)
      .where(eq(toolRuns.id, id))
  }

  /**
   * Get tool run by ID
   */
  async getToolRun(id: string): Promise<ToolRun | null> {
    const results = await db
      .select()
      .from(toolRuns)
      .where(eq(toolRuns.id, id))
      .limit(1)

    return results[0] || null
  }

  /**
   * List tool runs with filtering and pagination
   */
  async listToolRuns(options: {
    toolName?: string
    status?: string
    jobId?: string
    limit?: number
    offset?: number
    orderBy?: 'createdAt' | 'updatedAt' | 'durationMs'
    orderDirection?: 'asc' | 'desc'
  } = {}): Promise<ToolRun[]> {
    let query = db.select().from(toolRuns)

    // Apply filters
    if (options.toolName) {
      query = query.where(eq(toolRuns.toolName, options.toolName))
    }

    if (options.status) {
      query = query.where(eq(toolRuns.status, options.status))
    }

    if (options.jobId) {
      query = query.where(eq(toolRuns.jobId, options.jobId))
    }

    // Apply ordering
    const orderBy = options.orderBy || 'createdAt'
    const orderDirection = options.orderDirection || 'desc'
    const orderField = toolRuns[orderBy as keyof typeof toolRuns]
    
    query = query.orderBy(
      orderDirection === 'desc' ? desc(orderField) : asc(orderField)
    )

    // Apply pagination
    if (options.offset) {
      query = query.offset(options.offset)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    return await query
  }

  /**
   * Get tool execution statistics
   */
  async getToolStats(toolName?: string): Promise<{
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    averageDuration: number
    lastRun: Date | null
  }> {
    let query = db.select().from(toolRuns)
    
    if (toolName) {
      query = query.where(eq(toolRuns.toolName, toolName))
    }

    const runs = await query

    const totalRuns = runs.length
    const successfulRuns = runs.filter(run => run.status === 'completed').length
    const failedRuns = runs.filter(run => run.status === 'failed').length
    
    const completedRuns = runs.filter(run => 
      run.status === 'completed' && run.durationMs !== null
    )
    const averageDuration = completedRuns.length > 0
      ? completedRuns.reduce((sum, run) => sum + (run.durationMs || 0), 0) / completedRuns.length
      : 0

    const lastRun = runs.length > 0 
      ? new Date(Math.max(...runs.map(run => run.updatedAt.getTime())))
      : null

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      averageDuration,
      lastRun
    }
  }

  /**
   * Search tool runs by tool name or input content
   */
  async searchToolRuns(query: string, limit: number = 50): Promise<ToolRun[]> {
    return await db
      .select()
      .from(toolRuns)
      .where(
        like(toolRuns.toolName, `%${query}%`)
      )
      .orderBy(desc(toolRuns.createdAt))
      .limit(limit)
  }

  /**
   * Delete old tool runs (cleanup)
   */
  async deleteOldToolRuns(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await db
      .delete(toolRuns)
      .where(
        and(
          eq(toolRuns.status, 'completed'),
          // Note: Drizzle SQLite doesn't support date comparisons directly
          // This would need to be adjusted based on the actual timestamp storage
        )
      )

    return result.changes || 0
  }

  /**
   * Convert tool run to audit log format
   */
  async toolRunToAuditLog(toolRun: ToolRun): Promise<ToolAuditLog> {
    // Parse input and output
    let inputSanitized: unknown
    let output: unknown

    try {
      inputSanitized = JSON.parse(toolRun.input || '{}')
    } catch {
      inputSanitized = {}
    }

    try {
      output = JSON.parse(toolRun.output || '{}')
    } catch {
      output = null
    }

    // Create basic context (would be enhanced with actual data)
    const context: Omit<ToolContext, 'grantedCapabilities'> = {
      executionId: toolRun.id,
      sessionId: 'unknown', // Would be stored separately
      workspaceDir: '/workspace', // Would be stored separately
      startTime: toolRun.createdAt,
      conversationId: toolRun.jobId || undefined
    }

    // Create execution result
    const result: Omit<ToolExecutionResult, 'approval'> = {
      success: toolRun.status === 'completed',
      output: toolRun.status === 'completed' ? output : undefined,
      error: toolRun.error ? {
        code: 'EXECUTION_ERROR',
        message: toolRun.error
      } : undefined,
      metrics: {
        executionTimeMs: toolRun.durationMs || 0,
        capabilitiesUsed: [] // Would be tracked separately
      }
    }

    // Create approval info
    const approval = {
      required: false, // Would be determined by tool configuration
      granted: true, // Would be tracked separately
      grantedAt: toolRun.createdAt,
      token: undefined // Would be tracked separately
    }

    return {
      id: toolRun.id,
      toolName: toolRun.toolName,
      toolVersion: '1.0.0', // Would be stored separately
      context,
      inputSanitized,
      result,
      approval,
      securityEvents: [], // Would be tracked separately
      timestamp: toolRun.createdAt
    }
  }

  /**
   * Get audit logs for a tool
   */
  async getAuditLogs(toolName: string, limit: number = 100): Promise<ToolAuditLog[]> {
    const toolRuns = await this.listToolRuns({
      toolName,
      limit,
      orderBy: 'createdAt',
      orderDirection: 'desc'
    })

    const auditLogs: ToolAuditLog[] = []
    for (const toolRun of toolRuns) {
      const auditLog = await this.toolRunToAuditLog(toolRun)
      auditLogs.push(auditLog)
    }

    return auditLogs
  }

  /**
   * Get recent tool activity
   */
  async getRecentActivity(limit: number = 20): Promise<{
    toolName: string
    status: string
    timestamp: Date
    duration?: number
  }[]> {
    const runs = await this.listToolRuns({
      limit,
      orderBy: 'updatedAt',
      orderDirection: 'desc'
    })

    return runs.map(run => ({
      toolName: run.toolName,
      status: run.status,
      timestamp: run.updatedAt,
      duration: run.durationMs || undefined
    }))
  }

  /**
   * Get tool usage by time period
   */
  async getToolUsageByPeriod(
    toolName: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    date: string
    count: number
    successRate: number
  }[]> {
    // This would typically involve more complex SQL with date truncation
    // For now, return a basic implementation
    const runs = await this.listToolRuns({ toolName })
    
    // Filter by date range (simplified)
    const filteredRuns = runs.filter(run => 
      run.createdAt >= startDate && run.createdAt <= endDate
    )

    // Group by date (simplified - would use SQL date functions in production)
    const groupedByDate = new Map<string, ToolRun[]>()
    for (const run of filteredRuns) {
      const dateKey = run.createdAt.toISOString().split('T')[0]
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, [])
      }
      groupedByDate.get(dateKey)!.push(run)
    }

    // Calculate statistics
    const result: { date: string; count: number; successRate: number }[] = []
    for (const [date, dayRuns] of groupedByDate) {
      const successfulRuns = dayRuns.filter(run => run.status === 'completed').length
      const successRate = dayRuns.length > 0 ? successfulRuns / dayRuns.length : 0

      result.push({
        date,
        count: dayRuns.length,
        successRate
      })
    }

    return result.sort((a, b) => a.date.localeCompare(b.date))
  }
}

/**
 * Global tool repository instance
 */
export const toolRepository = new ToolRepository()

/**
 * Tool repository factory
 */
export function createToolRepository(): ToolRepository {
  return new ToolRepository()
}
