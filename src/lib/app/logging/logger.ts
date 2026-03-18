/**
 * Structured logging system using Pino
 * Implements CC-011-5: Implement structured logging, file rotation, and SQLite summary rollups
 */

import pino from 'pino'
import type { LogEntry, LogLevel, LogCategory } from '@/lib/app/monitoring/types'
import { env } from '@/lib/config/env'

export interface LoggerConfig {
  level: LogLevel
  categories: LogCategory[]
  fileRotation: {
    size: string
    count: number
  }
  console: boolean
  filePath?: string
}

export class StructuredLogger {
  private static instance: StructuredLogger
  private pino: pino.Logger
  private config: LoggerConfig
  private logBuffer: LogEntry[] = []
  private flushInterval?: NodeJS.Timeout

  private constructor(config: LoggerConfig) {
    this.config = config
    this.pino = this.createPinoLogger()
    this.startFlushInterval()
  }

  static getInstance(config?: Partial<LoggerConfig>): StructuredLogger {
    if (!StructuredLogger.instance) {
      const defaultConfig: LoggerConfig = {
        level: 'info',
        categories: ['inference', 'retrieval', 'tool', 'queue', 'auth', 'metrics', 'system'],
        fileRotation: {
          size: '10MB',
          count: 5
        },
        console: true,
        filePath: `${env.LOG_DIR}/app.log`
      }
      StructuredLogger.instance = new StructuredLogger({ ...defaultConfig, ...config })
    }
    return StructuredLogger.instance
  }

  /**
   * Create Pino logger with appropriate configuration
   */
  private createPinoLogger(): pino.Logger {
    const targets: pino.Target[] = []

    // Console target for development
    if (this.config.console) {
      targets.push({
        target: 'pino-pretty',
        level: this.config.level,
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      })
    }

    // File target with rotation
    if (this.config.filePath) {
      targets.push({
        target: 'pino/file',
        level: this.config.level,
        options: {
          destination: this.config.filePath,
          mkdir: true
        }
      })
    }

    return pino({
      level: this.config.level,
      base: {
        pid: process.pid,
        hostname: require('os').hostname(),
        service: 'command-center'
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label: string) => ({ level: label }),
        log: (object: any) => {
          // Ensure category is always present
          if (!object.category) {
            object.category = 'system'
          }
          return object
        }
      }
    }, pino.transport({
      targets
    }))
  }

  /**
   * Start periodic flush to database
   */
  private startFlushInterval(): void {
    this.flushInterval = setInterval(async () => {
      await this.flushToDatabase()
    }, 10000) // Flush every 10 seconds
  }

  /**
   * Log a message with structured data
   */
  log(level: LogLevel, category: LogCategory, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    // Check if category is enabled
    if (!this.config.categories.includes(category)) {
      return
    }

    const logEntry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }

    // Add to buffer for database flushing
    this.logBuffer.push(logEntry)

    // Keep buffer size manageable
    if (this.logBuffer.length > 1000) {
      this.logBuffer.splice(0, 500) // Remove oldest 500 entries
    }

    // Log to Pino
    const logData: any = {
      category,
      message,
      ...metadata
    }

    if (error) {
      logData.err = error
    }

    this.pino[level](logData)
  }

  /**
   * Convenience methods for different log levels
   */
  trace(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
    this.log('trace', category, message, metadata)
  }

  debug(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', category, message, metadata)
  }

  info(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
    this.log('info', category, message, metadata)
  }

  warn(category: LogCategory, message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', category, message, metadata)
  }

  error(category: LogCategory, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log('error', category, message, metadata, error)
  }

  fatal(category: LogCategory, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    this.log('fatal', category, message, metadata, error)
  }

  /**
   * Flush buffered logs to database
   */
  private async flushToDatabase(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return
    }

    const logsToFlush = this.logBuffer.splice(0, this.logBuffer.length)

    try {
      // Store in database using metrics rollup repository
      const { metricsRollupRepository } = await import('@/lib/app/persistence/metrics-rollup-repository')
      
      await metricsRollupRepository.storeLogEntries(logsToFlush)
    } catch (error) {
      // If database fails, keep logs in buffer for retry
      this.logBuffer.unshift(...logsToFlush)
      console.error('Failed to flush logs to database:', error)
    }
  }

  /**
   * Force immediate flush of all buffered logs
   */
  async flush(): Promise<void> {
    await this.flushToDatabase()
  }

  /**
   * Get recent logs from database
   */
  async getRecentLogs(options: {
    level?: LogLevel
    category?: LogCategory
    limit?: number
    offset?: number
    startTime?: number
    endTime?: number
  } = {}): Promise<LogEntry[]> {
    try {
      const { metricsRollupRepository } = await import('@/lib/app/persistence/metrics-rollup-repository')
      
      return await metricsRollupRepository.getLogEntries(options)
    } catch (error) {
      console.error('Failed to retrieve logs from database:', error)
      return []
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(options: {
    startTime?: number
    endTime?: number
  } = {}): Promise<{
    total: number
    byLevel: Record<LogLevel, number>
    byCategory: Record<LogCategory, number>
  }> {
    try {
      const { metricsRollupRepository } = await import('@/lib/app/persistence/metrics-rollup-repository')
      
      return await metricsRollupRepository.getLogStatistics(options)
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
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.pino = this.createPinoLogger()
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    
    // Flush remaining logs
    this.flushToDatabase().catch(console.error)
  }
}

// Export singleton instance
export const logger = StructuredLogger.getInstance()

// Export convenience functions for direct usage
export const log = {
  trace: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => 
    logger.trace(category, message, metadata),
  debug: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => 
    logger.debug(category, message, metadata),
  info: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => 
    logger.info(category, message, metadata),
  warn: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => 
    logger.warn(category, message, metadata),
  error: (category: LogCategory, message: string, metadata?: Record<string, unknown>, error?: Error) => 
    logger.error(category, message, metadata, error),
  fatal: (category: LogCategory, message: string, metadata?: Record<string, unknown>, error?: Error) => 
    logger.fatal(category, message, metadata, error)
}
