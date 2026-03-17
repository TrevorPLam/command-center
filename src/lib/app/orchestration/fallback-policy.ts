/**
 * Fallback Policy Service
 * 
 * Manages fallback chains and retry strategies for model routing failures.
 * Implements intelligent retry classification and adaptive fallback selection.
 */

import { ModelProfile } from '../db/schema'
import { RuntimeError, RuntimeErrorErrorCode } from '../runtime/errors'
import { modelRouter, RoutingRequest, RoutingResult } from './model-router'

export interface FallbackChain {
  id: string
  name: string
  description: string
  primaryProfileId: string
  fallbackProfileIds: string[]
  retryPolicy: RetryPolicy
  circuitBreakerPolicy: CircuitBreakerPolicy
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface RetryPolicy {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: string[]
  nonRetryableErrors: string[]
  jitterEnabled: boolean
}

export interface CircuitBreakerPolicy {
  failureThreshold: number
  recoveryTimeoutMs: number
  halfOpenMaxCalls: number
  expectedExceptions: string[]
  monitoringWindowMs: number
}

export interface FallbackResult {
  success: boolean
  profileUsed: ModelProfile | null
  result: RoutingResult | null
  error: Error | null
  attempts: number
  totalTimeMs: number
  fallbackChain: FallbackChain
  executionPath: string[]
}

export interface RetryClassification {
  isRetryable: boolean
  category: 'transient' | 'permanent' | 'rate_limit' | 'timeout' | 'unknown'
  suggestedDelay: number
  confidence: number
  reasoning: string[]
}

/**
 * Fallback Policy Service
 */
export class FallbackPolicyService {
  private fallbackChains: Map<string, FallbackChain> = new Map()
  private circuitBreakerStates: Map<string, CircuitBreakerState> = new Map()
  private retryAttempts: Map<string, number> = new Map()

  constructor() {
    this.initializeDefaultPolicies()
  }

  /**
   * Execute request with fallback chain
   */
  async executeWithFallback(
    request: RoutingRequest,
    fallbackChainId: string
  ): Promise<FallbackResult> {
    const startTime = Date.now()
    const chain = this.getFallbackChain(fallbackChainId)
    const executionPath: string[] = []
    
    if (!chain) {
      return {
        success: false,
        profileUsed: null,
        result: null,
        error: new RuntimeError('fallback_chain_not_found', `Fallback chain not found: ${fallbackChainId}`),
        attempts: 0,
        totalTimeMs: Date.now() - startTime,
        fallbackChain: {} as FallbackChain,
        executionPath,
      }
    }

    let lastError: Error | null = null
    let attempts = 0
    let result: RoutingResult | null = null
    let profileUsed: ModelProfile | null = null

    // Try primary profile first
    try {
      const primaryProfile = await this.getProfileById(chain.primaryProfileId)
      if (primaryProfile && this.isCircuitBreakerOpen(chain.primaryProfileId)) {
        throw new RuntimeError('circuit_breaker_open', `Circuit breaker open for profile: ${chain.primaryProfileId}`)
      }

      result = await this.executeWithRetry(primaryProfile!, request, chain.retryPolicy)
      profileUsed = primaryProfile
      executionPath.push(`primary:${chain.primaryProfileId}`)
      
      // Record success
      this.recordSuccess(chain.primaryProfileId)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      this.recordFailure(chain.primaryProfileId, lastError)
    }

    // If primary failed, try fallbacks
    if (!result && chain.fallbackProfileIds.length > 0) {
      for (const fallbackProfileId of chain.fallbackProfileIds) {
        attempts++
        
        try {
          const fallbackProfile = await this.getProfileById(fallbackProfileId)
          if (!fallbackProfile) {
            continue
          }

          if (this.isCircuitBreakerOpen(fallbackProfileId)) {
            continue
          }

          result = await this.executeWithRetry(fallbackProfile, request, chain.retryPolicy)
          profileUsed = fallbackProfile
          executionPath.push(`fallback:${fallbackProfileId}`)
          
          // Record success
          this.recordSuccess(fallbackProfileId)
          break
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')
          this.recordFailure(fallbackProfileId, lastError)
          executionPath.push(`failed:${fallbackProfileId}`)
        }
      }
    }

    const totalTimeMs = Date.now() - startTime

    return {
      success: result !== null,
      profileUsed,
      result,
      error: lastError,
      attempts: attempts + 1,
      totalTimeMs,
      fallbackChain: chain,
      executionPath,
    }
  }

  /**
   * Execute with retry policy
   */
  private async executeWithRetry(
    profile: ModelProfile,
    request: RoutingRequest,
    retryPolicy: RetryPolicy
  ): Promise<RoutingResult> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      try {
        // Check if error is retryable
        if (attempt > 1 && lastError) {
          const classification = this.classifyError(lastError)
          if (!classification.isRetryable) {
            throw lastError
          }

          // Apply delay
          const delay = this.calculateDelay(attempt, retryPolicy, classification)
          await this.sleep(delay)
        }

        // Execute the request
        const result = await modelRouter.selectProfile(request)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // Check if this is a non-retryable error
        const classification = this.classifyError(lastError)
        if (!classification.isRetryable || retryPolicy.nonRetryableErrors.includes(lastError.message)) {
          throw lastError
        }

        // Continue to next attempt if not the last one
        if (attempt === retryPolicy.maxAttempts) {
          throw lastError
        }
      }
    }

    throw lastError || new Error('Max retry attempts exceeded')
  }

  /**
   * Classify error for retry determination
   */
  classifyError(error: Error): RetryClassification {
    const errorMessage = error.message.toLowerCase()
    const errorCode = (error as RuntimeError).code

    // Transient errors (retryable)
    const transientPatterns = [
      'timeout',
      'connection',
      'network',
      'temporary',
      'rate limit',
      'overload',
      'service unavailable',
      'deadline exceeded',
    ]

    // Permanent errors (non-retryable)
    const permanentPatterns = [
      'invalid',
      'authentication',
      'authorization',
      'forbidden',
      'not found',
      'malformed',
      'syntax',
      'validation',
    ]

    // Check for transient patterns
    if (transientPatterns.some(pattern => errorMessage.includes(pattern))) {
      return {
        isRetryable: true,
        category: errorMessage.includes('rate limit') ? 'rate_limit' : 
                 errorMessage.includes('timeout') ? 'timeout' : 'transient',
        suggestedDelay: this.calculateBaseDelay(errorMessage),
        confidence: 0.8,
        reasoning: ['Error message contains transient pattern', 'Likely to resolve on retry'],
      }
    }

    // Check for permanent patterns
    if (permanentPatterns.some(pattern => errorMessage.includes(pattern))) {
      return {
        isRetryable: false,
        category: 'permanent',
        suggestedDelay: 0,
        confidence: 0.9,
        reasoning: ['Error message indicates permanent failure', 'Retry will not resolve'],
      }
    }

    // Check specific error codes
    if (errorCode) {
      switch (errorCode) {
        case 'model_routing_failed':
        case 'no_suitable_model':
          return {
            isRetryable: false,
            category: 'permanent',
            suggestedDelay: 0,
            confidence: 0.8,
            reasoning: ['Routing configuration error', 'Requires intervention'],
          }
        case 'runtime_timeout':
        case 'connection_failed':
          return {
            isRetryable: true,
            category: 'transient',
            suggestedDelay: 1000,
            confidence: 0.7,
            reasoning: ['Runtime communication error', 'Likely temporary'],
          }
      }
    }

    // Unknown error - conservative approach
    return {
      isRetryable: true,
      category: 'unknown',
      suggestedDelay: 500,
      confidence: 0.5,
      reasoning: ['Unknown error type', 'Conservative retry approach'],
    }
  }

  /**
   * Calculate delay for retry
   */
  private calculateDelay(attempt: number, retryPolicy: RetryPolicy, classification: RetryClassification): number {
    let delay = retryPolicy.baseDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1)
    delay = Math.min(delay, retryPolicy.maxDelayMs)

    // Add jitter if enabled
    if (retryPolicy.jitterEnabled) {
      const jitter = delay * 0.1 * Math.random()
      delay += jitter
    }

    // Adjust based on error classification
    if (classification.category === 'rate_limit') {
      delay *= 2 // Longer delay for rate limits
    }

    return Math.max(delay, classification.suggestedDelay)
  }

  /**
   * Calculate base delay from error message
   */
  private calculateBaseDelay(errorMessage: string): number {
    if (errorMessage.includes('rate limit')) {
      return 5000 // 5 seconds for rate limits
    }
    if (errorMessage.includes('timeout')) {
      return 2000 // 2 seconds for timeouts
    }
    return 1000 // 1 second default
  }

  /**
   * Circuit breaker state management
   */
  private isCircuitBreakerOpen(profileId: string): boolean {
    const state = this.circuitBreakerStates.get(profileId)
    if (!state) {
      return false
    }

    const now = Date.now()
    
    // Check if we should attempt recovery
    if (state.state === 'open' && now - state.lastFailureTime > state.recoveryTimeoutMs) {
      state.state = 'half-open'
      state.halfOpenCalls = 0
    }

    return state.state === 'open'
  }

  /**
   * Record success for circuit breaker
   */
  private recordSuccess(profileId: string): void {
    const state = this.circuitBreakerStates.get(profileId)
    if (!state) {
      return
    }

    if (state.state === 'half-open') {
      state.halfOpenCalls++
      if (state.halfOpenCalls >= state.halfOpenMaxCalls) {
        state.state = 'closed'
        state.failureCount = 0
      }
    } else if (state.state === 'closed') {
      state.failureCount = 0
    }
  }

  /**
   * Record failure for circuit breaker
   */
  private recordFailure(profileId: string, error: Error): void {
    let state = this.circuitBreakerStates.get(profileId)
    
    if (!state) {
      state = {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        recoveryTimeoutMs: 60000, // Default 1 minute
        halfOpenMaxCalls: 3,
        halfOpenCalls: 0,
      }
      this.circuitBreakerStates.set(profileId, state)
    }

    state.failureCount++
    state.lastFailureTime = Date.now()

    // Check if we should open the circuit
    if (state.failureCount >= 5 && state.state === 'closed') {
      state.state = 'open'
    }
  }

  /**
   * Get fallback chain by ID
   */
  private getFallbackChain(chainId: string): FallbackChain | null {
    return this.fallbackChains.get(chainId) || null
  }

  /**
   * Get profile by ID (placeholder - would integrate with repository)
   */
  private async getProfileById(profileId: string): Promise<ModelProfile | null> {
    // This would integrate with modelProfileRepository
    // For now, return a mock profile
    return {
      id: profileId,
      runtimeModelName: 'mock-model',
      role: 'general',
      maxSafeContext: 4096,
      structuredOutputReliability: 0.8,
      toolCallingReliability: 0.7,
      performanceScore: 0.8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ModelProfile
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Initialize default fallback policies
   */
  private initializeDefaultPolicies(): void {
    // Default chat fallback chain
    this.fallbackChains.set('chat-default', {
      id: 'chat-default',
      name: 'Default Chat Fallback',
      description: 'Primary chat model with general-purpose fallbacks',
      primaryProfileId: 'chat-primary',
      fallbackProfileIds: ['chat-secondary', 'chat-general'],
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
        retryableErrors: ['timeout', 'connection', 'rate_limit'],
        nonRetryableErrors: ['invalid_request', 'authentication_failed'],
        jitterEnabled: true,
      },
      circuitBreakerPolicy: {
        failureThreshold: 5,
        recoveryTimeoutMs: 60000,
        halfOpenMaxCalls: 3,
        expectedExceptions: ['timeout', 'connection'],
        monitoringWindowMs: 300000,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Default code generation fallback chain
    this.fallbackChains.set('code-default', {
      id: 'code-default',
      name: 'Default Code Fallback',
      description: 'Specialized code models with fallback to general models',
      primaryProfileId: 'code-specialized',
      fallbackProfileIds: ['code-general', 'chat-general'],
      retryPolicy: {
        maxAttempts: 2,
        baseDelayMs: 2000,
        maxDelayMs: 8000,
        backoffMultiplier: 1.5,
        retryableErrors: ['timeout', 'connection'],
        nonRetryableErrors: ['invalid_request', 'syntax_error'],
        jitterEnabled: true,
      },
      circuitBreakerPolicy: {
        failureThreshold: 3,
        recoveryTimeoutMs: 120000,
        halfOpenMaxCalls: 2,
        expectedExceptions: ['timeout', 'memory'],
        monitoringWindowMs: 300000,
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  /**
   * Create custom fallback chain
   */
  createFallbackChain(chain: Omit<FallbackChain, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = `fc_${crypto.randomUUID()}`
    const fullChain: FallbackChain = {
      ...chain,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.fallbackChains.set(id, fullChain)
    return id
  }

  /**
   * Get all fallback chains
   */
  getFallbackChains(): FallbackChain[] {
    return Array.from(this.fallbackChains.values())
  }

  /**
   * Update fallback chain
   */
  updateFallbackChain(chainId: string, updates: Partial<FallbackChain>): boolean {
    const existing = this.fallbackChains.get(chainId)
    if (!existing) {
      return false
    }

    const updated: FallbackChain = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    }

    this.fallbackChains.set(chainId, updated)
    return true
  }

  /**
   * Delete fallback chain
   */
  deleteFallbackChain(chainId: string): boolean {
    return this.fallbackChains.delete(chainId)
  }

  /**
   * Get circuit breaker states
   */
  getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakerStates)
  }

  /**
   * Reset circuit breaker for a profile
   */
  resetCircuitBreaker(profileId: string): void {
    this.circuitBreakerStates.delete(profileId)
  }
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open'
  failureCount: number
  lastFailureTime: number
  recoveryTimeoutMs: number
  halfOpenMaxCalls: number
  halfOpenCalls: number
}

// Singleton instance
export const fallbackPolicyService = new FallbackPolicyService()
