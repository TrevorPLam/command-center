/**
 * Unit tests for system metrics collector
 * Implements CC-011-7: Write metrics, retention, and logging tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SystemMetricsCollector } from '@/lib/app/monitoring/system-metrics'

// Mock systeminformation
vi.mock('systeminformation', () => ({
  cpu: vi.fn(() => Promise.resolve({
    cores: 8,
    manufacturer: 'Intel',
    brand: 'Test CPU'
  })),
  mem: vi.fn(() => Promise.resolve({
    total: 16000000000,
    used: 8000000000,
    free: 8000000000
  })),
  diskLayout: vi.fn(() => Promise.resolve([
    {
      device: '/dev/sda1',
      type: 'part',
      size: 500000000000,
      fsType: 'ext4'
    }
  ])),
  currentLoad: vi.fn(() => Promise.resolve({
    currentLoad: 45.2,
    avgLoad: [1.2, 1.5, 1.8]
  })),
  networkInterfaces: vi.fn(() => Promise.resolve([
    {
      iface: 'eth0',
      type: 'wired',
      speed: 1000,
      operstate: 'up',
      rx_bytes: 1000000,
      tx_bytes: 500000
    }
  ])),
  networkStats: vi.fn(() => Promise.resolve([
    {
      iface: 'eth0',
      rx_bytes: 1000000,
      tx_bytes: 500000,
      rx_sec: 1000,
      tx_sec: 500
    }
  ])),
  time: vi.fn(() => Promise.resolve({
    uptime: 86400,
    current: true
  })),
  processes: vi.fn(() => Promise.resolve({
    all: 156,
    running: 2,
    blocked: 1
  })),
  cpuTemperature: vi.fn(() => Promise.resolve({
    main: 62.5,
    cores: [60.1, 63.2, 61.8, 64.1]
  })),
  fsSize: vi.fn(() => Promise.resolve([
    {
      fs: '/dev/sda1',
      type: 'ext4',
      size: 500000000000,
      used: 230000000000,
      available: 270000000000
    }
  ]))
}))

describe('SystemMetricsCollector', () => {
  let collector: SystemMetricsCollector

  beforeEach(() => {
    collector = SystemMetricsCollector.getInstance()
    vi.clearAllMocks()
  })

  describe('collectSystemMetrics', () => {
    it('should collect comprehensive system metrics', async () => {
      const metrics = await collector.collectSystemMetrics()

      expect(metrics).toHaveProperty('timestamp')
      expect(metrics).toHaveProperty('cpu')
      expect(metrics).toHaveProperty('memory')
      expect(metrics).toHaveProperty('disk')
      expect(metrics).toHaveProperty('network')
      expect(metrics).toHaveProperty('uptime')
      expect(metrics).toHaveProperty('processes')

      // Check CPU metrics
      expect(metrics.cpu).toHaveProperty('usage')
      expect(metrics.cpu).toHaveProperty('cores')
      expect(metrics.cpu).toHaveProperty('loadAverage')
      expect(metrics.cpu).toHaveProperty('temperature')
      expect(typeof metrics.cpu.usage).toBe('number')
      expect(typeof metrics.cpu.cores).toBe('number')
      expect(Array.isArray(metrics.cpu.loadAverage)).toBe(true)

      // Check memory metrics
      expect(metrics.memory).toHaveProperty('total')
      expect(metrics.memory).toHaveProperty('used')
      expect(metrics.memory).toHaveProperty('free')
      expect(metrics.memory).toHaveProperty('percentage')
      expect(typeof metrics.memory.percentage).toBe('number')

      // Check disk metrics
      expect(metrics.disk).toHaveProperty('total')
      expect(metrics.disk).toHaveProperty('used')
      expect(metrics.disk).toHaveProperty('free')
      expect(metrics.disk).toHaveProperty('percentage')

      // Check network metrics
      expect(metrics.network).toHaveProperty('interfaces')
      expect(metrics.network).toHaveProperty('rx')
      expect(metrics.network).toHaveProperty('tx')
      expect(Array.isArray(metrics.network.interfaces)).toBe(true)
    })

    it('should handle missing temperature gracefully', async () => {
      // Mock temperature failure
      const si = await import('systeminformation')
      vi.mocked(si.cpuTemperature).mockRejectedValueOnce(new Error('Temperature not available'))

      const metrics = await collector.collectSystemMetrics()

      expect(metrics.cpu.temperature).toBeUndefined()
    })

    it('should calculate memory percentage correctly', async () => {
      const metrics = await collector.collectSystemMetrics()

      // Based on mock data: 8GB used / 16GB total = 50%
      expect(metrics.memory.percentage).toBe(50)
    })

    it('should calculate disk usage correctly', async () => {
      const metrics = await collector.collectSystemMetrics()

      // Based on mock data: 230GB used / 500GB total = 46%
      expect(metrics.disk.percentage).toBeCloseTo(46, 1)
    })
  })

  describe('getSystemHealth', () => {
    it('should return healthy status for normal metrics', async () => {
      const health = await collector.getSystemHealth()

      expect(health.status).toBe('pass')
      expect(health.issues).toHaveLength(0)
    })

    it('should detect high CPU usage', async () => {
      // Mock high CPU usage
      const si = await import('systeminformation')
      vi.mocked(si.currentLoad).mockResolvedValueOnce({
        currentLoad: 95.0,
        avgLoad: [2.5, 2.8, 3.1]
      })

      const health = await collector.getSystemHealth()

      expect(health.status).toBe('warn')
      expect(health.issues.some(issue => issue.includes('High CPU usage'))).toBe(true)
    })

    it('should detect high memory usage', async () => {
      // Mock high memory usage
      const si = await import('systeminformation')
      vi.mocked(si.mem).mockResolvedValueOnce({
        total: 16000000000,
        used: 15000000000, // 93.75%
        free: 1000000000
      })

      const health = await collector.getSystemHealth()

      expect(health.status).toBe('warn')
      expect(health.issues.some(issue => issue.includes('High memory usage'))).toBe(true)
    })

    it('should detect high disk usage', async () => {
      // Mock high disk usage
      const si = await import('systeminformation')
      vi.mocked(si.fsSize).mockResolvedValueOnce([
        {
          fs: '/dev/sda1',
          type: 'ext4',
          size: 500000000000,
          used: 450000000000, // 90%
          available: 50000000000
        }
      ])

      const health = await collector.getSystemHealth()

      expect(health.status).toBe('warn')
      expect(health.issues.some(issue => issue.includes('High disk usage'))).toBe(true)
    })

    it('should detect high system load', async () => {
      // Mock high load average
      const si = await import('systeminformation')
      vi.mocked(si.currentLoad).mockResolvedValueOnce({
        currentLoad: 45.2,
        avgLoad: [16.0, 18.0, 20.0] // High load for 8 cores
      })

      const health = await collector.getSystemHealth()

      expect(health.status).toBe('warn')
      expect(health.issues.some(issue => issue.includes('High system load'))).toBe(true)
    })

    it('should detect high temperature', async () => {
      // Mock high temperature
      const si = await import('systeminformation')
      vi.mocked(si.cpuTemperature).mockResolvedValueOnce({
        main: 85.0,
        cores: [82.1, 86.2, 84.8, 87.1]
      })

      const health = await collector.getSystemHealth()

      expect(health.status).toBe('warn')
      expect(health.issues.some(issue => issue.includes('High CPU temperature'))).toBe(true)
    })

    it('should return fail status for multiple issues', async () => {
      // Mock multiple issues
      const si = await import('systeminformation')
      vi.mocked(si.currentLoad).mockResolvedValueOnce({
        currentLoad: 95.0,
        avgLoad: [2.5, 2.8, 3.1]
      })
      vi.mocked(si.mem).mockResolvedValueOnce({
        total: 16000000000,
        used: 15000000000,
        free: 1000000000
      })
      vi.mocked(si.fsSize).mockResolvedValueOnce([
        {
          fs: '/dev/sda1',
          type: 'ext4',
          size: 500000000000,
          used: 450000000000,
          available: 50000000000
        }
      ])

      const health = await collector.getSystemHealth()

      expect(health.status).toBe('fail')
      expect(health.issues.length).toBeGreaterThan(2)
    })
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const collector1 = SystemMetricsCollector.getInstance()
      const collector2 = SystemMetricsCollector.getInstance()

      expect(collector1).toBe(collector2)
    })
  })
})
