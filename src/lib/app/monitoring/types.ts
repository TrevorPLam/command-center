/**
 * Monitoring types and interfaces for CC-011
 * Provides structured types for system metrics, runtime metrics, and monitoring data
 */

export interface SystemMetrics {
  timestamp: number
  cpu: {
    usage: number
    cores: number
    loadAverage: number[]
    temperature?: number
  }
  memory: {
    total: number
    used: number
    free: number
    percentage: number
  }
  disk: {
    total: number
    used: number
    free: number
    percentage: number
  }
  network: {
    interfaces: NetworkInterface[]
    rx: number
    tx: number
  }
  uptime: number
  processes: number
}

export interface NetworkInterface {
  iface: string
  type: string
  speed: number
  operstate: string
  rx_bytes: number
  tx_bytes: number
  rx_sec: number
  tx_sec: number
}

export interface RuntimeMetrics {
  timestamp: number
  ollama: {
    status: 'healthy' | 'degraded' | 'error'
    latency: number
    modelCount: number
    runningModels: RunningModel[]
    errors: string[]
  }
  commandCenter: {
    uptime: number
    memoryUsage: number
    cpuUsage: number
  }
}

export interface RunningModel {
  name: string
  status: 'running' | 'loading' | 'error'
  size: number
  memoryUsage: number
  pid?: number
}

export interface ApplicationMetrics {
  timestamp: number
  inference: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    averageLatency: number
    tokensGenerated: number
  }
  retrieval: {
    totalQueries: number
    averageLatency: number
    documentsRetrieved: number
    chunksRetrieved: number
  }
  queue: {
    pendingJobs: number
    runningJobs: number
    completedJobs: number
    failedJobs: number
  }
  tools: {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageExecutionTime: number
  }
}

export interface LogEntry {
  timestamp: number
  level: LogLevel
  category: LogCategory
  message: string
  metadata?: Record<string, unknown>
  error?: {
    name: string
    message: string
    stack?: string
  }
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogCategory = 'inference' | 'retrieval' | 'tool' | 'queue' | 'auth' | 'metrics' | 'system'

export interface MetricsSnapshot {
  system: SystemMetrics
  runtime: RuntimeMetrics
  application: ApplicationMetrics
  timestamp: number
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'error'
  checks: HealthCheck[]
  timestamp: number
}

export interface HealthCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message?: string
  duration?: number
  metadata?: Record<string, unknown>
}

export interface Alert {
  id: string
  level: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  category: LogCategory
  timestamp: number
  resolved?: boolean
  resolvedAt?: number
  metadata?: Record<string, unknown>
}

// SSE Event types
export interface MonitoringEvent {
  type: 'metrics' | 'health' | 'alert' | 'log'
  data: MetricsSnapshot | HealthStatus | Alert | LogEntry
  timestamp: number
}

// Configuration interfaces
export interface MonitoringConfig {
  metrics: {
    interval: number // milliseconds
    retention: number // hours
    enabled: boolean
  }
  logging: {
    level: LogLevel
    categories: LogCategory[]
    fileRotation: {
      size: string // e.g., '10MB'
      count: number
    }
    console: boolean
  }
  alerts: {
    enabled: boolean
    thresholds: AlertThresholds
  }
}

export interface AlertThresholds {
  cpu: number // percentage
  memory: number // percentage
  disk: number // percentage
  latency: number // milliseconds
  errorRate: number // percentage
}
