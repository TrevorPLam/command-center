/**
 * Circuit Breaker Implementation
 * 
 * Advanced circuit breaker pattern implementation for model routing resilience.
 * Provides configurable failure thresholds, recovery strategies, and monitoring.
 */

import { RuntimeError, RuntimeErrorErrorCode } from '../runtime/errors'

export interface CircuitBreakerConfig {
  failureThreshold: number
  recoveryTimeoutMs: number
  halfOpenMaxCalls: number
  expectedExceptions: string[]
  monitoringWindowMs: number
  successThreshold: number
  timeoutMs: number
  enableMetrics: boolean
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open'
  failureCount: number
  successCount: number
  lastFailureTime: number
  lastSuccessTime: number
  halfOpenCalls: number
  totalCalls: number
  totalFailures: number
  totalSuccesses: number
  metrics: CircuitBreakerMetrics
}

export interface CircuitBreakerMetrics {
  averageResponseTime: number
  failureRate: number
  lastFailureError?: string
  uptime: number
  downtime: number
  stateTransitions: Array<{
    from: string
    to: string
    timestamp: number
    reason: string
  }>
}

export interface CircuitBreakerResult<T> {
  success: boolean
  data?: T
  error?: Error
  circuitState: string
  responseTime: number
  wasFallback: boolean
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker<T = any> {
  private state: CircuitBreakerState
  private config: CircuitBreakerConfig
  private name: string
  private startTime: number

  constructor(name: string, config: CircuitBreakerConfig) {
    this.name = name
    this.config = config
    this.startTime = Date.now()
    
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastSuccessTime: 0,
      halfOpenCalls: 0,
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      metrics: {
        averageResponseTime: 0,
        failureRate: 0,
        uptime: 0,
        downtime: 0,
        stateTransitions: [],
      },
    }
  }

  /**
   * Execute operation through circuit breaker
   */
  async execute<R>(
    operation: () => Promise<R>,
    fallback?: () => Promise<R>
  ): Promise<CircuitBreakerResult<R>> {
    const startTime = Date.now()
    const currentState = this.getState()

    // Check if circuit is open
    if (currentState === 'open') {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen('Recovery timeout elapsed')
      } else {
        // Circuit is open, use fallback if available
        if (fallback) {
          try {
            const result = await fallback()
            return {
              success: true,
              data: result,
              circuitState: 'open',
              responseTime: Date.now() - startTime,
              wasFallback: true,
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error : new Error('Fallback failed'),
              circuitState: 'open',
              responseTime: Date.now() - startTime,
              wasFallback: true,
            }
          }
        } else {
          return {
            success: false,
            error: new RuntimeError('circuit_breaker_open', `Circuit breaker ${this.name} is open`),
            circuitState: 'open',
            responseTime: Date.now() - startTime,
            wasFallback: false,
          }
        }
      }
    }

    // Execute the operation
    try {
      this.state.totalCalls++
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise(this.config.timeoutMs),
      ])

      const responseTime = Date.now() - startTime
      this.onSuccess(responseTime)

      return {
        success: true,
        data: result,
        circuitState: this.state.state,
        responseTime,
        wasFallback: false,
      }
    } catch (error) {
      const responseTime = Date.now() - startTime
      this.onFailure(error as Error)

      // If in half-open and fallback is available, try it
      if (this.state.state === 'half-open' && fallback) {
        try {
          const fallbackResult = await fallback()
          return {
            success: true,
            data: fallbackResult,
            circuitState: this.state.state,
            responseTime: Date.now() - startTime,
            wasFallback: true,
          }
        } catch (fallbackError) {
          return {
            success: false,
            error: fallbackError instanceof Error ? fallbackError : new Error('Fallback failed'),
            circuitState: this.state.state,
            responseTime: Date.now() - startTime,
            wasFallback: true,
          }
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error('Operation failed'),
        circuitState: this.state.state,
        responseTime,
        wasFallback: false,
      }
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(responseTime: number): void {
    this.state.successCount++
    this.state.totalSuccesses++
    this.state.lastSuccessTime = Date.now()
    this.state.totalCalls++

    // Update metrics
    this.updateMetrics(responseTime, true)

    // Handle half-open state
    if (this.state.state === 'half-open') {
      this.state.halfOpenCalls++
      
      // If we've had enough successful calls in half-open, close the circuit
      if (this.state.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.transitionToClosed('Sufficient successful calls in half-open')
      }
    } else if (this.state.state === 'closed') {
      // In closed state, reset failure count on success
      this.state.failureCount = 0
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error): void {
    this.state.failureCount++
    this.state.totalFailures++
    this.state.lastFailureTime = Date.now()
    this.state.totalCalls++

    // Update metrics
    this.updateMetrics(0, false, error.message)

    // Check if we should open the circuit
    if (this.state.state === 'closed' && this.state.failureCount >= this.config.failureThreshold) {
      this.transitionToOpen('Failure threshold exceeded')
    } else if (this.state.state === 'half-open') {
      // Any failure in half-open opens the circuit again
      this.transitionToOpen('Failure in half-open state')
    }
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(reason: string): void {
    const previousState = this.state.state
    this.state.state = 'open'
    this.state.metrics.downtime += Date.now() - this.state.lastFailureTime
    this.recordStateTransition(previousState, 'open', reason)
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(reason: string): void {
    const previousState = this.state.state
    this.state.state = 'closed'
    this.state.failureCount = 0
    this.state.successCount = 0
    this.state.halfOpenCalls = 0
    this.state.metrics.uptime += Date.now() - this.state.lastSuccessTime
    this.recordStateTransition(previousState, 'closed', reason)
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(reason: string): void {
    const previousState = this.state.state
    this.state.state = 'half-open'
    this.state.halfOpenCalls = 0
    this.recordStateTransition(previousState, 'half-open', reason)
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.state.lastFailureTime > this.config.recoveryTimeoutMs
  }

  /**
   * Update circuit breaker metrics
   */
  private updateMetrics(responseTime: number, success: boolean, errorMessage?: string): void {
    if (!this.config.enableMetrics) {
      return
    }

    // Update average response time
    const totalResponseTime = this.state.metrics.averageResponseTime * (this.state.totalCalls - 1) + responseTime
    this.state.metrics.averageResponseTime = totalResponseTime / this.state.totalCalls

    // Update failure rate
    this.state.metrics.failureRate = this.state.totalFailures / this.state.totalCalls

    // Update last failure error
    if (!success && errorMessage) {
      this.state.metrics.lastFailureError = errorMessage
    }

    // Update uptime/downtime
    if (success) {
      this.state.metrics.uptime += responseTime
    } else {
      this.state.metrics.downtime += responseTime
    }
  }

  /**
   * Record state transition
   */
  private recordStateTransition(from: string, to: string, reason: string): void {
    this.state.metrics.stateTransitions.push({
      from,
      to,
      timestamp: Date.now(),
      reason,
    })

    // Keep only recent transitions (last 100)
    if (this.state.metrics.stateTransitions.length > 100) {
      this.state.metrics.stateTransitions = this.state.metrics.stateTransitions.slice(-100)
    }
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new RuntimeError('operation_timeout', `Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    })
  }

  /**
   * Get current state
   */
  getState(): string {
    return this.state.state
  }

  /**
   * Get full state information
   */
  getFullState(): CircuitBreakerState {
    return { ...this.state }
  }

  /**
   * Get metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.state.metrics }
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.transitionToClosed('Manual reset')
  }

  /**
   * Force open circuit breaker
   */
  forceOpen(reason: string = 'Manual force open'): void {
    this.transitionToOpen(reason)
  }

  /**
   * Check if error is expected
   */
  isExpectedError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase()
    return this.config.expectedExceptions.some(exception => 
      errorMessage.includes(exception.toLowerCase())
    )
  }

  /**
   * Get health status
   */
  getHealth(): {
    healthy: boolean
    state: string
    failureRate: number
    averageResponseTime: number
    uptime: number
    recommendations: string[]
  } {
    const failureRate = this.state.metrics.failureRate
    const averageResponseTime = this.state.metrics.averageResponseTime
    const uptime = this.state.metrics.uptime
    const healthy = this.state.state === 'closed' && failureRate < 0.5

    const recommendations: string[] = []

    if (failureRate > 0.3) {
      recommendations.push('High failure rate detected - consider reviewing error patterns')
    }

    if (averageResponseTime > 5000) {
      recommendations.push('High response time detected - consider optimizing operations')
    }

    if (this.state.state === 'open') {
      recommendations.push('Circuit is open - investigate root cause of failures')
    }

    if (this.state.state === 'half-open') {
      recommendations.push('Circuit is testing recovery - monitor closely')
    }

    return {
      healthy,
      state: this.state.state,
      failureRate,
      averageResponseTime,
      uptime,
      recommendations,
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config }
  }

  /**
   * Get circuit breaker name
   */
  getName(): string {
    return this.name
  }
}

/**
 * Circuit Breaker Registry
 * 
 * Manages multiple circuit breakers with centralized monitoring and control.
 */
export class CircuitBreakerRegistry {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()

  /**
   * Register a new circuit breaker
   */
  register(name: string, config: CircuitBreakerConfig): CircuitBreaker {
    const circuitBreaker = new CircuitBreaker(name, config)
    this.circuitBreakers.set(name, circuitBreaker)
    return circuitBreaker
  }

  /**
   * Get circuit breaker by name
   */
  get(name: string): CircuitBreaker | undefined {
    return this.circuitBreakers.get(name)
  }

  /**
   * Remove circuit breaker
   */
  remove(name: string): boolean {
    return this.circuitBreakers.delete(name)
  }

  /**
   * Get all circuit breakers
   */
  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers)
  }

  /**
   * Get health status of all circuit breakers
   */
  getHealthStatus(): Array<{
    name: string
    healthy: boolean
    state: string
    failureRate: number
    averageResponseTime: number
  }> {
    const status = []

    for (const [name, circuitBreaker] of this.circuitBreakers) {
      const health = circuitBreaker.getHealth()
      status.push({
        name,
        healthy: health.healthy,
        state: health.state,
        failureRate: health.failureRate,
        averageResponseTime: health.averageResponseTime,
      })
    }

    return status
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset()
    }
  }

  /**
   * Get aggregate metrics
   */
  getAggregateMetrics(): {
    totalCircuitBreakers: number
    healthyCount: number
    openCount: number
    halfOpenCount: number
    closedCount: number
    averageFailureRate: number
    averageResponseTime: number
  } {
    const circuitBreakers = Array.from(this.circuitBreakers.values())
    
    if (circuitBreakers.length === 0) {
      return {
        totalCircuitBreakers: 0,
        healthyCount: 0,
        openCount: 0,
        halfOpenCount: 0,
        closedCount: 0,
        averageFailureRate: 0,
        averageResponseTime: 0,
      }
    }

    const healthStatus = this.getHealthStatus()
    const healthyCount = healthStatus.filter(cb => cb.healthy).length
    const stateCounts = healthStatus.reduce((acc, cb) => {
      acc[cb.state] = (acc[cb.state] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const averageFailureRate = healthStatus.reduce((sum, cb) => sum + cb.failureRate, 0) / healthStatus.length
    const averageResponseTime = healthStatus.reduce((sum, cb) => sum + cb.averageResponseTime, 0) / healthStatus.length

    return {
      totalCircuitBreakers: circuitBreakers.length,
      healthyCount,
      openCount: stateCounts.open || 0,
      halfOpenCount: stateCounts['half-open'] || 0,
      closedCount: stateCounts.closed || 0,
      averageFailureRate,
      averageResponseTime,
    }
  }
}

// Global registry instance
export const circuitBreakerRegistry = new CircuitBreakerRegistry()
