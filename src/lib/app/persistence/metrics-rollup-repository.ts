/**
 * Metrics rollup repository for log persistence and aggregation
 * Implements CC-011-5: Implement structured logging, file rotation, and SQLite summary rollups
 */

import { db } from '@/lib/db/client'
import { logs } from '@/lib/db/schema'
import type { LogEntry, LogLevel, LogCategory } from '@/lib/app/monitoring/types'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'

export interface LogEntryFilter {
  level?: LogLevel
  category?: LogCategory
  limit?: number
  offset?: number
  startTime?: number
  endTime?: number
}

export interface LogStatistics {
  total: number
  byLevel: Record<LogLevel, number>
  byCategory: Record<LogCategory, number>
}

export class MetricsRollupRepository {
  private static instance: MetricsRollupRepository

  private constructor() {}

  static getInstance(): MetricsRollupRepository {
    if (!MetricsRollupRepository.instance) {
      MetricsRollupRepository.instance = new MetricsRollupRepository()
    }
    return MetricsRollupRepository.instance
  }

  /**
   * Store log entries in the database
   */
  async storeLogEntries(entries: LogEntry[]): Promise<void> {
    if (entries.length === 0) {
      return
    }

    try {
      // Convert log entries to database format
      const dbEntries = entries.map(entry => ({
        id: `log-${entry.timestamp}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(entry.timestamp),
        level: entry.level,
        category: entry.category,
        message: entry.message,
        metadata: JSON.stringify(entry.metadata || {}),
        error: entry.error ? JSON.stringify(entry.error) : null,
        createdAt: new Date()
      }))

      // Batch insert
      await db.insert(logs).values(dbEntries)
    } catch (error) {
      console.error('Failed to store log entries:', error)
      throw error
    }
  }

  /**
   * Retrieve log entries with filtering
   */
  async getLogEntries(filter: LogEntryFilter = {}): Promise<LogEntry[]> {
    try {
      let query = db.select().from(logs).orderBy(desc(logs.timestamp))

      // Apply filters
      const conditions = []

      if (filter.level) {
        conditions.push(eq(logs.level, filter.level))
      }

      if (filter.category) {
        conditions.push(eq(logs.category, filter.category))
      }

      if (filter.startTime) {
        conditions.push(gte(logs.timestamp, new Date(filter.startTime)))
      }

      if (filter.endTime) {
        conditions.push(lte(logs.timestamp, new Date(filter.endTime)))
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions))
      }

      // Apply pagination
      if (filter.limit) {
        query = query.limit(filter.limit)
      }

      if (filter.offset) {
        query = query.offset(filter.offset)
      }

      const results = await query

      // Convert back to LogEntry format
      return results.map(row => ({
        timestamp: row.timestamp.getTime(),
        level: row.level as LogLevel,
        category: row.category as LogCategory,
        message: row.message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        error: row.error ? JSON.parse(row.error) : undefined
      }))
    } catch (error) {
      console.error('Failed to retrieve log entries:', error)
      return []
    }
  }

  /**
   * Get log statistics for a time period
   */
  async getLogStatistics(filter: {
    startTime?: number
    endTime?: number
  } = {}): Promise<LogStatistics> {
    try {
      let query = db.select({
        total: sql<number>`count(*)`.mapWith(Number),
        byLevel: sql<Record<LogLevel, number>>`json_object(
          'trace', sum(case when level = 'trace' then 1 else 0 end),
          'debug', sum(case when level = 'debug' then 1 else 0 end),
          'info', sum(case when level = 'info' then 1 else 0 end),
          'warn', sum(case when level = 'warn' then 1 else 0 end),
          'error', sum(case when level = 'error' then 1 else 0 end),
          'fatal', sum(case when level = 'fatal' then 1 else 0 end)
        )`,
        byCategory: sql<Record<LogCategory, number>>`json_object(
          'inference', sum(case when category = 'inference' then 1 else 0 end),
          'retrieval', sum(case when category = 'retrieval' then 1 else 0 end),
          'tool', sum(case when category = 'tool' then 1 else 0 end),
          'queue', sum(case when category = 'queue' then 1 else 0 end),
          'auth', sum(case when category = 'auth' then 1 else 0 end),
          'metrics', sum(case when category = 'metrics' then 1 else 0 end),
          'system', sum(case when category = 'system' then 1 else 0 end)
        )`
      }).from(logs)

      // Apply time filters
      const conditions = []

      if (filter.startTime) {
        conditions.push(gte(logs.timestamp, new Date(filter.startTime)))
      }

      if (filter.endTime) {
        conditions.push(lte(logs.timestamp, new Date(filter.endTime)))
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions))
      }

      const result = await query.limit(1)

      if (result.length === 0) {
        return {
          total: 0,
          byLevel: {
            trace: 0,
            debug: 0,
            info: 0,
            warn: 0,
            error: 0,
            fatal: 0
          },
          byCategory: {
            inference: 0,
            retrieval: 0,
            tool: 0,
            queue: 0,
            auth: 0,
            metrics: 0,
            system: 0
          }
        }
      }

      const row = result[0]

      return {
        total: row.total,
        byLevel: row.byLevel as Record<LogLevel, number>,
        byCategory: row.byCategory as Record<LogCategory, number>
      }
    } catch (error) {
      console.error('Failed to get log statistics:', error)
      return {
        total: 0,
        byLevel: {
          trace: 0,
          debug: 0,
          info: 0,
          warn: 0,
          error: 0,
          fatal: 0
        },
        byCategory: {
          inference: 0,
          retrieval: 0,
          tool: 0,
          queue: 0,
          auth: 0,
          metrics: 0,
          system: 0
        }
      }
    }
  }

  /**
   * Clean up old log entries based on retention policy
   */
  async cleanupOldLogs(retentionHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - (retentionHours * 60 * 60 * 1000))

      const result = await db
        .delete(logs)
        .where(lte(logs.timestamp, cutoffTime))
        .returning({ id: logs.id })

      return result.length
    } catch (error) {
      console.error('Failed to cleanup old logs:', error)
      return 0
    }
  }

  /**
   * Get log trends over time
   */
  async getLogTrends(options: {
    startTime: number
    endTime: number
    interval: 'hour' | 'day'
  }): Promise<Array<{
    timestamp: number
    count: number
    errorCount: number
  }>> {
    try {
      const { startTime, endTime, interval } = options

      let timeFormat: string
      switch (interval) {
        case 'hour':
          timeFormat = '%Y-%m-%d %H:00:00'
          break
        case 'day':
          timeFormat = '%Y-%m-%d 00:00:00'
          break
        default:
          timeFormat = '%Y-%m-%d %H:00:00'
      }

      const query = sql`
        SELECT 
          strftime('${timeFormat}', timestamp) as time_bucket,
          count(*) as count,
          sum(case when level in ('error', 'fatal') then 1 else 0 end) as error_count
        FROM ${logs}
        WHERE timestamp >= ${new Date(startTime)} AND timestamp <= ${new Date(endTime)}
        GROUP BY strftime('${timeFormat}', timestamp)
        ORDER BY time_bucket
      `

      const results = await db.run(query)

      return results.map((row: any) => ({
        timestamp: new Date(row.time_bucket).getTime(),
        count: row.count,
        errorCount: row.error_count
      }))
    } catch (error) {
      console.error('Failed to get log trends:', error)
      return []
    }
  }

  /**
   * Search log entries by message content
   */
  async searchLogs(searchTerm: string, filter: LogEntryFilter = {}): Promise<LogEntry[]> {
    try {
      let query = db
        .select()
        .from(logs)
        .where(sql`${logs.message} LIKE ${`%${searchTerm}%`}`)
        .orderBy(desc(logs.timestamp))

      // Apply additional filters
      const conditions = []

      if (filter.level) {
        conditions.push(eq(logs.level, filter.level))
      }

      if (filter.category) {
        conditions.push(eq(logs.category, filter.category))
      }

      if (filter.startTime) {
        conditions.push(gte(logs.timestamp, new Date(filter.startTime)))
      }

      if (filter.endTime) {
        conditions.push(lte(logs.timestamp, new Date(filter.endTime)))
      }

      if (conditions.length > 0) {
        query = query.where(and(sql`${logs.message} LIKE ${`%${searchTerm}%`}`, ...conditions))
      }

      // Apply pagination
      if (filter.limit) {
        query = query.limit(filter.limit)
      }

      if (filter.offset) {
        query = query.offset(filter.offset)
      }

      const results = await query

      // Convert back to LogEntry format
      return results.map(row => ({
        timestamp: row.timestamp.getTime(),
        level: row.level as LogLevel,
        category: row.category as LogCategory,
        message: row.message,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        error: row.error ? JSON.parse(row.error) : undefined
      }))
    } catch (error) {
      console.error('Failed to search logs:', error)
      return []
    }
  }
}

// Export singleton instance
export const metricsRollupRepository = MetricsRollupRepository.getInstance()
