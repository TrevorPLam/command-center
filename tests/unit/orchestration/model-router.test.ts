/**
 * Model Router Unit Tests
 * 
 * Comprehensive unit tests for model routing functionality,
 * including profile selection, scoring, and fallback mechanisms.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { modelRouter, RoutingRequest, RoutingResult } from '../../../../src/lib/app/orchestration/model-router'
import { modelProfileRepository } from '../../../../src/lib/app/persistence/model-profile-repository'
import { ModelProfile, ModelRole } from '../../../../src/lib/db/schema'
import { RuntimeError } from '../../../../src/lib/app/runtime/errors'

// Mock the model profile repository
vi.mock('../../../../src/lib/app/persistence/model-profile-repository')

describe('ModelRouter', () => {
  const mockProfiles: ModelProfile[] = [
    {
      id: 'profile-1',
      runtimeModelName: 'llama3.1-8b',
      role: 'general',
      maxSafeContext: 4096,
      structuredOutputReliability: 0.8,
      toolCallingReliability: 0.7,
      performanceScore: 0.8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'profile-2',
      runtimeModelName: 'codellama-7b',
      role: 'code',
      maxSafeContext: 8192,
      structuredOutputReliability: 0.6,
      toolCallingReliability: 0.9,
      performanceScore: 0.7,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'profile-3',
      runtimeModelName: 'reasoning-model',
      role: 'reasoning',
      maxSafeContext: 16384,
      structuredOutputReliability: 0.9,
      toolCallingReliability: 0.5,
      performanceScore: 0.9,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockRepository = {
    findActive: vi.fn(),
    findByRole: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(modelProfileRepository).findActive = mockRepository.findActive
    vi.mocked(modelProfileRepository).findByRole = mockRepository.findByRole
    vi.mocked(modelProfileRepository).findById = mockRepository.findById
    vi.mocked(modelProfileRepository).create = mockRepository.create
    vi.mocked(modelProfileRepository).update = mockRepository.update
    vi.mocked(modelProfileRepository).delete = mockRepository.delete

    modelRouter.resetMetrics()
  })

  describe('selectProfile', () => {
    it('should select the best profile for a simple chat request', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.role).toBe('general')
      expect(result.confidence).toBeGreaterThan(0.5)
      expect(result.fallbackProfiles).toHaveLength(2)
      expect(result.routingTimeMs).toBeGreaterThan(0)
    })

    it('should select a code model for code generation tasks', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'code',
        requiresTools: true,
        outputShape: 'code',
        latencyBudget: 'balanced',
        reliabilityPreference: 'quality',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.role).toBe('code')
      expect(result.profile.toolCallingReliability).toBeGreaterThan(0.8)
    })

    it('should select a reasoning model for reasoning tasks', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'reasoning',
        requiresThinking: true,
        outputShape: 'text',
        latencyBudget: 'deep',
        reliabilityPreference: 'quality',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.role).toBe('reasoning')
      expect(result.profile.structuredOutputReliability).toBeGreaterThan(0.8)
    })

    it('should filter out models that cannot handle structured output', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'extract',
        outputShape: 'structured',
        latencyBudget: 'balanced',
        reliabilityPreference: 'quality',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.structuredOutputReliability).toBeGreaterThan(0.7)
    })

    it('should respect max tokens requirements', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        maxTokens: 5000,
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.maxSafeContext).toBeGreaterThanOrEqual(5000)
    })

    it('should handle excluded models', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        excludeModels: ['profile-1'],
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.id).not.toBe('profile-1')
    })

    it('should prefer specified models when available', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        preferModels: ['profile-3'],
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.id).toBe('profile-3')
    })

    it('should throw error when no suitable model is found', async () => {
      mockRepository.findActive.mockResolvedValue([])

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      await expect(modelRouter.selectProfile(request)).rejects.toThrow('no_suitable_model')
    })

    it('should handle vision tasks correctly', async () => {
      const visionProfile: ModelProfile = {
        id: 'vision-profile',
        runtimeModelName: 'vision-model',
        role: 'vision',
        maxSafeContext: 4096,
        structuredOutputReliability: 0.7,
        toolCallingReliability: 0.5,
        performanceScore: 0.6,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.findActive.mockResolvedValue([...mockProfiles, visionProfile])

      const request: RoutingRequest = {
        task: 'vision',
        requiresVision: true,
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.role).toBe('vision')
    })

    it('should handle embedding tasks correctly', async () => {
      const embeddingProfile: ModelProfile = {
        id: 'embedding-profile',
        runtimeModelName: 'embedding-model',
        role: 'embedding',
        maxSafeContext: 2048,
        structuredOutputReliability: 0.1,
        toolCallingReliability: 0.1,
        performanceScore: 0.8,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.findActive.mockResolvedValue([...mockProfiles, embeddingProfile])

      const request: RoutingRequest = {
        task: 'embedding',
        requiresEmbeddings: true,
        outputShape: 'text',
        latencyBudget: 'fast',
        reliabilityPreference: 'speed',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.role).toBe('embedding')
    })
  })

  describe('getMetrics', () => {
    it('should return initial metrics', () => {
      const metrics = modelRouter.getMetrics()

      expect(metrics.requestCount).toBe(0)
      expect(metrics.successCount).toBe(0)
      expect(metrics.averageLatency).toBe(0)
      expect(metrics.modelUsage).toEqual({})
      expect(metrics.taskSuccess).toEqual({})
    })

    it('should update metrics after successful routing', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      await modelRouter.selectProfile(request)
      const metrics = modelRouter.getMetrics()

      expect(metrics.requestCount).toBe(1)
      expect(metrics.modelUsage['profile-1']).toBe(1)
      expect(metrics.taskSuccess['chat']).toBe(1)
      expect(metrics.averageLatency).toBeGreaterThan(0)
    })

    it('should record success and failure correctly', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const result = await modelRouter.selectProfile(request)
      
      modelRouter.recordSuccess(result.profile.id, 'chat')
      modelRouter.recordFailure('profile-2', 'code', 'timeout')

      const metrics = modelRouter.getMetrics()

      expect(metrics.taskSuccess['chat_success']).toBe(1)
      expect(metrics.taskSuccess['code_failure']).toBe(1)
    })
  })

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      await modelRouter.selectProfile(request)
      modelRouter.resetMetrics()

      const metrics = modelRouter.getMetrics()

      expect(metrics.requestCount).toBe(0)
      expect(metrics.successCount).toBe(0)
      expect(metrics.averageLatency).toBe(0)
      expect(metrics.modelUsage).toEqual({})
      expect(metrics.taskSuccess).toEqual({})
    })
  })

  describe('edge cases', () => {
    it('should handle empty repository gracefully', async () => {
      mockRepository.findActive.mockResolvedValue([])

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      await expect(modelRouter.selectProfile(request)).rejects.toThrow()
    })

    it('should handle repository errors gracefully', async () => {
      mockRepository.findActive.mockRejectedValue(new Error('Database error'))

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      await expect(modelRouter.selectProfile(request)).rejects.toThrow('model_routing_failed')
    })

    it('should handle malformed profile data', async () => {
      const malformedProfile: ModelProfile = {
        id: 'malformed',
        runtimeModelName: '',
        role: 'general',
        maxSafeContext: -1,
        structuredOutputReliability: 2,
        toolCallingReliability: -1,
        performanceScore: 1.5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockRepository.findActive.mockResolvedValue([malformedProfile])

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      // Should still work with validation
      const result = await modelRouter.selectProfile(request)
      expect(result.success).toBe(true)
    })
  })

  describe('performance', () => {
    it('should complete routing within reasonable time', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'fast',
        reliabilityPreference: 'speed',
      }

      const startTime = Date.now()
      const result = await modelRouter.selectProfile(request)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // Should complete within 100ms
    })

    it('should handle multiple concurrent requests', async () => {
      mockRepository.findActive.mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const promises = Array.from({ length: 10 }, () => modelRouter.selectProfile(request))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.success).toBe(true)
      })
    })
  })
})
