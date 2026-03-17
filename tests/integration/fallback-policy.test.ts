/**
 * Fallback Policy Integration Tests
 * 
 * Integration tests for the fallback policy service including
 * circuit breaker functionality, retry logic, and chain execution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fallbackPolicyService, FallbackChain } from '../../../src/lib/app/orchestration/fallback-policy'
import { modelRouter } from '../../../src/lib/app/orchestration/model-router'
import { ModelProfile } from '../../../src/lib/app/db/schema'

// Mock model router
vi.mock('../../../src/lib/app/orchestration/model-router', () => ({
  modelRouter: {
    selectProfile: vi.fn(),
  },
}))

describe('FallbackPolicyService', () => {
  const mockProfiles: ModelProfile[] = [
    {
      id: 'primary-profile',
      runtimeModelName: 'llama3.1-8b',
      role: 'general',
      maxSafeContext: 4096,
      structuredOutputReliability: 0.9,
      toolCallingReliability: 0.8,
      performanceScore: 0.9,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'fallback-1',
      runtimeModelName: 'codellama-7b',
      role: 'code',
      maxSafeContext: 8192,
      structuredOutputReliability: 0.8,
      toolCallingReliability: 0.9,
      performanceScore: 0.8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'fallback-2',
      runtimeModelName: 'llava-7b',
      role: 'vision',
      maxSafeContext: 4096,
      structuredOutputReliability: 0.7,
      toolCallingReliability: 0.6,
      performanceScore: 0.7,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset circuit breaker states
    fallbackPolicyService.resetCircuitBreaker('primary-profile')
    fallbackPolicyService.resetCircuitBreaker('fallback-1')
    fallbackPolicyService.resetCircuitBreaker('fallback-2')
  })

  describe('executeWithFallback', () => {
    it('should execute successfully with primary profile', async () => {
      const mockResult = {
        profile: mockProfiles[0],
        confidence: 0.9,
        reasoning: ['Primary profile selected'],
        fallbackProfiles: [mockProfiles[1], mockProfiles[2]],
        routingTimeMs: 100,
      }

      vi.mocked(modelRouter.selectProfile).mockResolvedValue(mockResult)

      const request = {
        task: 'chat' as const,
        outputShape: 'text' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      const result = await fallbackPolicyService.executeWithFallback(request, 'chat-default')

      expect(result.success).toBe(true)
      expect(result.profileUsed?.id).toBe('primary-profile')
      expect(result.result).toEqual(mockResult)
      expect(result.attempts).toBe(1)
      expect(result.executionPath).toEqual(['primary:primary-profile'])
    })

    it('should fall back to secondary profile when primary fails', async () => {
      // Primary fails
      vi.mocked(modelRouter.selectProfile)
        .mockRejectedValueOnce(new Error('Primary model unavailable'))
        .mockResolvedValueOnce({
          profile: mockProfiles[1],
          confidence: 0.8,
          reasoning: ['Fallback profile selected'],
          fallbackProfiles: [mockProfiles[2]],
          routingTimeMs: 150,
        })

      const request = {
        task: 'code' as const,
        outputShape: 'code' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      const result = await fallbackPolicyService.executeWithFallback(request, 'code-default')

      expect(result.success).toBe(true)
      expect(result.profileUsed?.id).toBe('fallback-1')
      expect(result.attempts).toBe(2)
      expect(result.executionPath).toEqual(['failed:primary-profile', 'fallback:fallback-1'])
    })

    it('should fall back through all profiles when needed', async () => {
      // Primary and first fallback fail
      vi.mocked(modelRouter.selectProfile)
        .mockRejectedValueOnce(new Error('Primary model unavailable'))
        .mockRejectedValueOnce(new Error('First fallback unavailable'))
        .mockResolvedValueOnce({
          profile: mockProfiles[2],
          confidence: 0.7,
          reasoning: ['Last fallback selected'],
          fallbackProfiles: [],
          routingTimeMs: 200,
        })

      const request = {
        task: 'vision' as const,
        outputShape: 'text' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      const result = await fallbackPolicyService.executeWithFallback(request, 'chat-default')

      expect(result.success).toBe(true)
      expect(result.profileUsed?.id).toBe('fallback-2')
      expect(result.attempts).toBe(3)
      expect(result.executionPath).toEqual([
        'failed:primary-profile',
        'failed:fallback-1',
        'fallback:fallback-2'
      ])
    })

    it('should fail when all profiles are unavailable', async () => {
      vi.mocked(modelRouter.selectProfile).mockRejectedValue(new Error('All models unavailable'))

      const request = {
        task: 'chat' as const,
        outputShape: 'text' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      const result = await fallbackPolicyService.executeWithFallback(request, 'chat-default')

      expect(result.success).toBe(false)
      expect(result.profileUsed).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.attempts).toBe(3)
    })

    it('should respect circuit breaker state', async () => {
      // Force circuit breaker open for primary profile
      fallbackPolicyService.resetCircuitBreaker('primary-profile')
      
      // Mock the circuit breaker check by forcing failures
      for (let i = 0; i < 5; i++) {
        fallbackPolicyService['recordFailure']('primary-profile', new Error('Simulated failure'))
      }

      vi.mocked(modelRouter.selectProfile).mockResolvedValue({
        profile: mockProfiles[1],
        confidence: 0.8,
        reasoning: ['Fallback profile selected due to circuit breaker'],
        fallbackProfiles: [mockProfiles[2]],
        routingTimeMs: 150,
      })

      const request = {
        task: 'chat' as const,
        outputShape: 'text' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      const result = await fallbackPolicyService.executeWithFallback(request, 'chat-default')

      expect(result.success).toBe(true)
      expect(result.profileUsed?.id).toBe('fallback-1')
      expect(result.executionPath).toEqual(['fallback:fallback-1'])
    })
  })

  describe('error classification', () => {
    it('should classify transient errors as retryable', () => {
      const transientErrors = [
        new Error('Connection timeout'),
        new Error('Network error occurred'),
        new Error('Rate limit exceeded'),
        new Error('Service temporarily unavailable'),
        new Error('Deadline exceeded'),
      ]

      transientErrors.forEach(error => {
        const classification = fallbackPolicyService['classifyError'](error)
        expect(classification.isRetryable).toBe(true)
        expect(['transient', 'rate_limit', 'timeout']).toContain(classification.category)
      })
    })

    it('should classify permanent errors as non-retryable', () => {
      const permanentErrors = [
        new Error('Invalid request format'),
        new Error('Authentication failed'),
        new Error('Resource not found'),
        new Error('Malformed JSON'),
        new Error('Validation error'),
      ]

      permanentErrors.forEach(error => {
        const classification = fallbackPolicyService['classifyError'](error)
        expect(classification.isRetryable).toBe(false)
        expect(classification.category).toBe('permanent')
      })
    })

    it('should handle unknown errors conservatively', () => {
      const unknownError = new Error('Unknown error occurred')
      const classification = fallbackPolicyService['classifyError'](unknownError)

      expect(classification.isRetryable).toBe(true)
      expect(classification.category).toBe('unknown')
      expect(classification.confidence).toBe(0.5)
    })
  })

  describe('circuit breaker integration', () => {
    it('should open circuit breaker after failure threshold', () => {
      // Simulate multiple failures
      for (let i = 0; i < 5; i++) {
        fallbackPolicyService['recordFailure']('test-profile', new Error('Test failure'))
      }

      const circuitBreakerStates = fallbackPolicyService.getCircuitBreakerStates()
      const state = circuitBreakerStates.get('test-profile')

      expect(state?.state).toBe('open')
    })

    it('should recover circuit breaker after timeout', async () => {
      // Force circuit breaker open
      for (let i = 0; i < 5; i++) {
        fallbackPolicyService['recordFailure']('test-profile', new Error('Test failure'))
      }

      // Mock time progression
      const originalDateNow = Date.now
      Date.now = vi.fn(() => originalDateNow() + 70000) // 70 seconds later

      // Check if circuit breaker should attempt recovery
      const isOpen = fallbackPolicyService['isCircuitBreakerOpen']('test-profile')
      
      // Restore original Date.now
      Date.now = originalDateNow

      expect(isOpen).toBe(false) // Should be in half-open state
    })

    it('should close circuit breaker after successful calls in half-open', () => {
      // Force circuit breaker open
      for (let i = 0; i < 5; i++) {
        fallbackPolicyService['recordFailure']('test-profile', new Error('Test failure'))
      }

      // Simulate successful calls in half-open
      for (let i = 0; i < 3; i++) {
        fallbackPolicyService['recordSuccess']('test-profile')
      }

      const circuitBreakerStates = fallbackPolicyService.getCircuitBreakerStates()
      const state = circuitBreakerStates.get('test-profile')

      expect(state?.state).toBe('closed')
    })
  })

  describe('retry policy', () => {
    it('should respect retry limits', async () => {
      vi.mocked(modelRouter.selectProfile).mockRejectedValue(new Error('Always fails'))

      const request = {
        task: 'chat' as const,
        outputShape: 'text' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      const result = await fallbackPolicyService.executeWithFallback(request, 'chat-default')

      expect(result.success).toBe(false)
      expect(mockRouter.selectProfile).toHaveBeenCalledTimes(3) // Default retry attempts
    })

    it('should apply exponential backoff', async () => {
      const startTime = Date.now()
      let callCount = 0

      vi.mocked(modelRouter.selectProfile).mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve({
          profile: mockProfiles[0],
          confidence: 0.9,
          reasoning: ['Success after retries'],
          fallbackProfiles: [],
          routingTimeMs: 100,
        })
      })

      const request = {
        task: 'chat' as const,
        outputShape: 'text' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      await fallbackPolicyService.executeWithFallback(request, 'chat-default')

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Should have taken some time due to backoff delays
      expect(totalTime).toBeGreaterThan(1000) // At least 1 second of delays
      expect(callCount).toBe(3)
    })
  })

  describe('fallback chain management', () => {
    it('should create custom fallback chains', () => {
      const customChain = {
        name: 'Custom Chain',
        description: 'Test fallback chain',
        primaryProfileId: 'custom-primary',
        fallbackProfileIds: ['custom-fallback-1', 'custom-fallback-2'],
        retryPolicy: {
          maxAttempts: 2,
          baseDelayMs: 500,
          maxDelayMs: 5000,
          backoffMultiplier: 1.5,
          retryableErrors: ['timeout'],
          nonRetryableErrors: ['authentication'],
          jitterEnabled: false,
        },
        circuitBreakerPolicy: {
          failureThreshold: 3,
          recoveryTimeoutMs: 30000,
          halfOpenMaxCalls: 2,
          expectedExceptions: ['timeout'],
          monitoringWindowMs: 60000,
        },
        isActive: true,
      }

      const chainId = fallbackPolicyService.createFallbackChain(customChain)
      const chains = fallbackPolicyService.getFallbackChains()

      expect(chainId).toBeDefined()
      expect(chains).toContainEqual(expect.objectContaining({
        name: 'Custom Chain',
        primaryProfileId: 'custom-primary',
      }))
    })

    it('should update existing fallback chains', () => {
      const chains = fallbackPolicyService.getFallbackChains()
      const originalChain = chains[0]

      const updated = fallbackPolicyService.updateFallbackChain(originalChain.id, {
        name: 'Updated Chain Name',
      })

      expect(updated).toBe(true)

      const updatedChains = fallbackPolicyService.getFallbackChains()
      const chain = updatedChains.find(c => c.id === originalChain.id)

      expect(chain?.name).toBe('Updated Chain Name')
    })

    it('should delete fallback chains', () => {
      const chains = fallbackPolicyService.getFallbackChains()
      const chainToDelete = chains[0]

      const deleted = fallbackPolicyService.deleteFallbackChain(chainToDelete.id)

      expect(deleted).toBe(true)

      const remainingChains = fallbackPolicyService.getFallbackChains()
      expect(remainingChains).not.toContainEqual(expect.objectContaining({
        id: chainToDelete.id,
      }))
    })
  })

  describe('metrics and monitoring', () => {
    it('should track circuit breaker states', () => {
      // Simulate some activity
      fallbackPolicyService['recordSuccess']('profile-1')
      fallbackPolicyService['recordFailure']('profile-2', new Error('Test error'))

      const states = fallbackPolicyService.getCircuitBreakerStates()

      expect(states.size).toBeGreaterThan(0)
      expect(states.get('profile-1')).toBeDefined()
      expect(states.get('profile-2')).toBeDefined()
    })

    it('should provide aggregate metrics', () => {
      const chains = fallbackPolicyService.getFallbackChains()
      expect(chains.length).toBeGreaterThan(0)

      // Test that we can get basic information about chains
      chains.forEach(chain => {
        expect(chain.primaryProfileId).toBeDefined()
        expect(chain.fallbackProfileIds).toBeDefined()
        expect(chain.retryPolicy).toBeDefined()
        expect(chain.circuitBreakerPolicy).toBeDefined()
      })
    })
  })
})
