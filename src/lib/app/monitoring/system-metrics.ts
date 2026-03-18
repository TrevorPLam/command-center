/**
 * System metrics collector using systeminformation
 * Implements CC-011-1: Implement host and runtime metric collectors
 */

import * as si from 'systeminformation'
import type { SystemMetrics, NetworkInterface } from './types'

// Import os module for hostname
const os = require('os')

export class SystemMetricsCollector {
  private static instance: SystemMetricsCollector
  private lastNetworkStats?: Awaited<ReturnType<typeof si.networkStats>>
  private lastNetworkTime = 0

  private constructor() {}

  static getInstance(): SystemMetricsCollector {
    if (!SystemMetricsCollector.instance) {
      SystemMetricsCollector.instance = new SystemMetricsCollector()
    }
    return SystemMetricsCollector.instance
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const now = Date.now()
    
    const [
      cpuData,
      memData,
      diskLayout,
      currentLoad,
      networkInterfaces,
      networkStats,
      time
    ] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.diskLayout(),
      si.currentLoad(),
      si.networkInterfaces(),
      si.networkStats(),
      si.time()
    ])

    // Calculate network rates (bytes/sec)
    const networkRates = this.calculateNetworkRates(networkStats, now)

    // Get disk usage
    const diskUsage = await this.calculateDiskUsage()

    return {
      timestamp: now,
      cpu: {
        usage: currentLoad.currentLoad || 0,
        cores: cpuData.cores || 1,
        loadAverage: currentLoad.avgLoad || [0, 0, 0],
        temperature: await this.getCpuTemperature()
      },
      memory: {
        total: memData.total,
        used: memData.used,
        free: memData.free,
        percentage: (memData.used / memData.total) * 100
      },
      disk: diskUsage,
      network: {
        interfaces: networkInterfaces.map(this.formatNetworkInterface),
        rx: networkStats.reduce((sum, iface) => sum + iface.rx_bytes, 0),
        tx: networkStats.reduce((sum, iface) => sum + iface.tx_bytes, 0)
      },
      uptime: time.uptime,
      processes: (await si.processes()).all || 0
    }
  }

  /**
   * Calculate network rates based on difference from previous measurement
   */
  private calculateNetworkRates(
    currentStats: Awaited<ReturnType<typeof si.networkStats>>,
    currentTime: number
  ): { rx_sec: number; tx_sec: number } {
    if (!this.lastNetworkStats || this.lastNetworkTime === 0) {
      this.lastNetworkStats = currentStats
      this.lastNetworkTime = currentTime
      return { rx_sec: 0, tx_sec: 0 }
    }

    const timeDiff = (currentTime - this.lastNetworkTime) / 1000 // seconds
    
    if (timeDiff <= 0) {
      return { rx_sec: 0, tx_sec: 0 }
    }

    const rx_sec = currentStats.reduce((sum, iface, index) => {
      const lastIface = this.lastNetworkStats?.[index]
      if (!lastIface) return sum
      return sum + (iface.rx_bytes - lastIface.rx_bytes) / timeDiff
    }, 0)

    const tx_sec = currentStats.reduce((sum, iface, index) => {
      const lastIface = this.lastNetworkStats?.[index]
      if (!lastIface) return sum
      return sum + (iface.tx_bytes - lastIface.tx_bytes) / timeDiff
    }, 0)

    this.lastNetworkStats = currentStats
    this.lastNetworkTime = currentTime

    return { rx_sec, tx_sec }
  }

  /**
   * Calculate disk usage across all disks
   */
  private async calculateDiskUsage() {
    const fsSize = await si.fsSize()
    
    const total = fsSize.reduce((sum, fs) => sum + fs.size, 0)
    const used = fsSize.reduce((sum, fs) => sum + fs.used, 0)
    const free = fsSize.reduce((sum, fs) => sum + fs.available, 0)
    const percentage = total > 0 ? (used / total) * 100 : 0

    return {
      total,
      used,
      free,
      percentage
    }
  }

  /**
   * Get CPU temperature if available
   */
  private async getCpuTemperature(): Promise<number | undefined> {
    try {
      const temp = await si.cpuTemperature()
      return temp.main || temp.cores?.[0] || undefined
    } catch {
      return undefined
    }
  }

  /**
   * Format network interface for our interface
   */
  private formatNetworkInterface(iface: si.NetworkInterfacesData): NetworkInterface {
    return {
      iface: iface.iface,
      type: iface.type || 'unknown',
      speed: iface.speed || 0,
      operstate: iface.operstate || 'unknown',
      rx_bytes: iface.rx_bytes || 0,
      tx_bytes: iface.tx_bytes || 0,
      rx_sec: iface.rx_sec || 0,
      tx_sec: iface.tx_sec || 0
    }
  }

  /**
   * Get basic system health check
   */
  async getSystemHealth(): Promise<{ status: 'pass' | 'warn' | 'fail'; issues: string[] }> {
    const metrics = await this.collectSystemMetrics()
    const issues: string[] = []

    // Check CPU usage
    if (metrics.cpu.usage > 90) {
      issues.push(`High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`)
    }

    // Check memory usage
    if (metrics.memory.percentage > 90) {
      issues.push(`High memory usage: ${metrics.memory.percentage.toFixed(1)}%`)
    }

    // Check disk usage
    if (metrics.disk.percentage > 85) {
      issues.push(`High disk usage: ${metrics.disk.percentage.toFixed(1)}%`)
    }

    // Check load average (more than number of cores is concerning)
    const loadPerCore = metrics.cpu.loadAverage[0] / metrics.cpu.cores
    if (loadPerCore > 2) {
      issues.push(`High system load: ${loadPerCore.toFixed(2)} per core`)
    }

    // Check temperature if available
    if (metrics.cpu.temperature && metrics.cpu.temperature > 80) {
      issues.push(`High CPU temperature: ${metrics.cpu.temperature}°C`)
    }

    const status = issues.length === 0 ? 'pass' : issues.length > 2 ? 'fail' : 'warn'
    return { status, issues }
  }
}

// Export singleton instance
export const systemMetricsCollector = SystemMetricsCollector.getInstance()
