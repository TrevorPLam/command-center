/**
 * Unit tests for structured logging system
 * Implements CC-011-7: Write metrics, retention, and logging tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StructuredLogger } from '@/lib/app/logging/logger'
import type { LogLevel, LogCategory } from '@/lib/app/monitoring/types'

// Mock Pino
const mockPino = {
  level: 'info',
  base: {},
  timestamp: vi.fn(),
  formatters: {
    level: vi.fn(),
    log: vi.fn()
  },
  transport: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn()
}

vi.mock('pino', () => ({
  default: vi.fn(() => mockPino)
}))

// Mock process
const originalProcess = global.process

describe('StructuredLogger', () => {
  let logger: StructuredLogger

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Mock process.memoryUsage
    global.process = {
      ...originalProcess,
      memoryUsage: vi.fn(() => ({
        rss: 50000000,
        heapTotal: 30000000,
        heapUsed: 15000000,
        external: 1000000,
        arrayBuffers: 500000
      }))
    } as any

    // Mock require for os module
    vi.doMock('os', () => ({
      hostname: vi.fn(() => 'test-hostname')
    }))

    logger = StructuredLogger.getInstance({
      level: 'info',
      categories: ['inference', 'retrieval', 'tool', 'queue', 'auth', 'metrics', 'system'],
      fileRotation: {
        size: '10MB',
        count: 5
      },
      console: true
    })
  })

  afterEach(() => {
    global.process = originalProcess
    logger.destroy()
  })

  describe('log method', () => {
    it('should log messages with structured data', () => {
      const metadata = { userId: '123', action: 'test' }
      
      logger.log('info', 'system', 'Test message', metadata)

      expect(mockPino.info).toHaveBeenCalledWith({
        category: 'system',
        message: 'Test message',
        ...metadata
      })
    })

    it('should include error information when provided', () => {
      const error = new Error('Test error')
      
      logger.log('error', 'system', 'Error occurred', {}, error)

      expect(mockPino.error).toHaveBeenCalledWith({
        category: 'system',
        message: 'Error occurred',
        err: error
      })
    })

    it('should not log disabled categories', () => {
      const loggerWithFilteredCategories = StructuredLogger.getInstance({
        level: 'info',
        categories: ['inference'], // Only inference enabled
        fileRotation: { size: '10MB', count: 5 },
        console: true
      })

      loggerWithFilteredCategories.log('info', 'system', 'Should not be logged')

      expect(mockPino.info).not.toHaveBeenCalled()
    })

    it('should buffer log entries for database flushing', async () => {
      logger.log('info', 'system', 'Test message 1')
      logger.log('info', 'system', 'Test message 2')

      // Access private buffer through reflection for testing
      const buffer = (logger as any).logBuffer
      expect(buffer).toHaveLength(2)
      expect(buffer[0]).toMatchObject({
        level: 'info',
        category: 'system',
        message: 'Test message 1'
      })
    })
  })

  describe('convenience methods', () => {
    it('should provide trace method', () => {
      logger.trace('system', 'Trace message')
      
      expect(mockPino.trace).toHaveBeenCalledWith({
        category: 'system',
        message: 'Trace message'
      })
    })

    it('should provide debug method', () => {
      logger.debug('system', 'Debug message')
      
      expect(mockPino.debug).toHaveBeenCalledWith({
        category: 'system',
        message: 'Debug message'
      })
    })

    it('should provide info method', () => {
      logger.info('system', 'Info message')
      
      expect(mockPino.info).toHaveBeenCalledWith({
        category: 'system',
        message: 'Info message'
      })
    })

    it('should provide warn method', () => {
      logger.warn('system', 'Warning message')
      
      expect(mockPino.warn).toHaveBeenCalledWith({
        category: 'system',
        message: 'Warning message'
      })
    })

    it('should provide error method', () => {
      const error = new Error('Test error')
      logger.error('system', 'Error message', {}, error)
      
      expect(mockPino.error).toHaveBeenCalledWith({
        category: 'system',
        message: 'Error message',
        err: error
      })
    })

    it('should provide fatal method', () => {
      const error = new Error('Fatal error')
      logger.fatal('system', 'Fatal message', {}, error)
      
      expect(mockPino.fatal).toHaveBeenCalledWith({
        category: 'system',
        message: 'Fatal message',
        err: error
      })
    })
  })

  describe('configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        level: 'debug' as LogLevel,
        categories: ['inference', 'system'],
        fileRotation: { size: '5MB', count: 3 },
        console: false
      }

      logger.updateConfig(newConfig)

      expect(logger.getConfig()).toMatchObject(newConfig)
    })

    it('should return current configuration', () => {
      const config = logger.getConfig()

      expect(config).toHaveProperty('level')
      expect(config).toHaveProperty('categories')
      expect(config).toHaveProperty('fileRotation')
      expect(config).toHaveProperty('console')
    })
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const logger1 = StructuredLogger.getInstance()
      const logger2 = StructuredLogger.getInstance()

      expect(logger1).toBe(logger2)
    })

    it('should use provided config only on first creation', () => {
      const logger1 = StructuredLogger.getInstance({ level: 'debug' })
      const logger2 = StructuredLogger.getInstance({ level: 'error' })

      expect(logger1).toBe(logger2)
      expect(logger1.getConfig().level).toBe('debug') // Should keep first config
    })
  })

  describe('buffer management', () => {
    it('should limit buffer size', async () => {
      // Fill buffer beyond limit
      for (let i = 0; i < 1500; i++) {
        logger.log('info', 'system', `Message ${i}`)
      }

      const buffer = (logger as any).logBuffer
      expect(buffer.length).toBeLessThanOrEqual(1000)
    })

    it('should clear buffer on flush', async () => {
      logger.log('info', 'system', 'Test message')
      
      // Mock database flush
      const mockFlush = vi.fn().mockResolvedValue(undefined)
      vi.doMock('@/lib/app/persistence/metrics-rollup-repository', () => ({
        metricsRollupRepository: {
          storeLogEntries: mockFlush
        }
      }))

      await logger.flush()

      const buffer = (logger as any).logBuffer
      expect(buffer).toHaveLength(0)
    })
  })

  describe('log levels', () => {
    const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal']
    const categories: LogCategory[] = ['inference', 'retrieval', 'tool', 'queue', 'auth', 'metrics', 'system']

    levels.forEach(level => {
      categories.forEach(category => {
        it(`should handle ${level} level for ${category} category`, () => {
          logger.log(level, category, `Test ${level} message`)

          const pinoMethod = mockPino[level]
          expect(pinoMethod).toHaveBeenCalledWith({
            category,
            message: `Test ${level} message`
          })
        })
      })
    })
  })

  describe('error handling', () => {
    it('should handle errors in metadata gracefully', () => {
      const circularReference: any = {}
      circularReference.self = circularReference

      // Should not throw when logging circular references
      expect(() => {
        logger.log('info', 'system', 'Test', { circular: circularReference })
      }).not.toThrow()
    })

    it('should handle undefined metadata', () => {
      expect(() => {
        logger.log('info', 'system', 'Test message', undefined)
      }).not.toThrow()

      expect(mockPino.info).toHaveBeenCalledWith({
        category: 'system',
        message: 'Test message'
      })
    })
  })
})
