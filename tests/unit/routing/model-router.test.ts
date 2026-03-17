/**
 * Model Router Unit Tests
 * 
 * Comprehensive tests for the model routing service including
 * profile selection, scoring, and fallback logic.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { modelRouter, RoutingRequest, TaskType } from '../../../src/lib/app/orchestration/model-router'
import { ModelProfile } from '../../../src/lib/app/db/schema'

// Mock the model profile repository
vi.mock('../../../src/lib/app/persistence/model-profile-repository', () => ({
  modelProfileRepository: {
    findActive: vi.fn(),
    findByRole: vi.fn(),
  },
}))

describe('ModelRouter', () => {
  const mockProfiles: ModelProfile[] = [
    {
      id: 'profile-1',
      runtimeModelName: 'llama3.1-8b',
      role: 'general',
      maxSafeContext: 4096,
      structuredOutputReliability: 0.8,
      toolCallingReliability: 0.7,
      performanceScore: 0.9,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'profile-2',
      runtimeModelName: 'codellama-7b',
      role: 'code',
      maxSafeContext: 8192,
      structuredOutputReliability: 0.9,
      toolCallingReliability: 0.8,
      performanceScore: 0.8,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'profile-3',
      runtimeModelName: 'llava-7b',
      role: 'vision',
      maxSafeContext: 4096,
      structuredOutputReliability: 0.6,
      toolCallingReliability: 0.5,
      performanceScore: 0.7,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('selectProfile', () => {
    it('should select the best profile for a simple chat task', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.role).toBe('general')
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.fallbackProfiles).toHaveLength(2)
    })

    it('should select code-specific profile for code generation tasks', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

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
      expect(result.reasoning).toContainEqual(expect.stringContaining('code'))
    })

    it('should select vision model for vision tasks', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

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

    it('should prioritize structured output reliability for JSON tasks', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'extract',
        outputShape: 'structured',
        latencyBudget: 'balanced',
        reliabilityPreference: 'quality',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      // Should prefer profile with higher structured output reliability
      expect(result.profile.structuredOutputReliability).toBeGreaterThanOrEqual(0.8)
    })

    it('should handle excluded models', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
        excludeModels: ['profile-1'],
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.id).not.toBe('profile-1')
    })

    it('should handle preferred models', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
        preferModels: ['profile-2'],
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.reasoning).toContainEqual(expect.stringContaining('Preferred model'))
    })

    it('should throw error when no suitable model found', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue([])

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      await expect(modelRouter.selectProfile(request)).rejects.toThrow('no_suitable_model')
    })

    it('should respect max tokens constraint', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        maxTokens: 5000,
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.maxSafeContext).toBeGreaterThanOrEqual(5000)
    })

    it('should respect cost budget', async () => {
      const profilesWithCost = [
        ...mockProfiles,
        {
          ...mockProfiles[0],
          id: 'profile-4',
          runtimeModelName: 'expensive-model',
          costPerToken: 0.1,
        },
      ]

      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(profilesWithCost)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'balanced',
        reliabilityPreference: 'balanced',
        costBudget: 0.01,
        maxTokens: 100,
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      // Should not select the expensive model
      expect(result.profile.id).not.toBe('profile-4')
    })
  })

  describe('getMetrics', () => {
    it('should return current routing metrics', () => {
      const metrics = modelRouter.getMetrics()

      expect(metrics).toHaveProperty('requestCount')
      expect(metrics).toHaveProperty('successCount')
      expect(metrics).toHaveProperty('averageLatency')
      expect(metrics).toHaveProperty('modelUsage')
      expect(metrics).toHaveProperty('taskSuccess')
    })

    it('should reset metrics correctly', () => {
      modelRouter.resetMetrics()
      const metrics = modelRouter.getMetrics()

      expect(metrics.requestCount).toBe(0)
      expect(metrics.successCount).toBe(0)
      expect(metrics.averageLatency).toBe(0)
      expect(metrics.modelUsage).toEqual({})
      expect(metrics.taskSuccess).toEqual({})
    })
  })

  describe('recordSuccess and recordFailure', () => {
    it('should record successful routing', () => {
      modelRouter.recordSuccess('profile-1', 'chat')
      const metrics = modelRouter.getMetrics()

      expect(metrics.successCount).toBe(1)
      expect(metrics.taskSuccess['chat_success']).toBe(1)
    })

    it('should record failed routing', () => {
      modelRouter.recordFailure('profile-1', 'chat', 'timeout error')
      const metrics = modelRouter.getMetrics()

      expect(metrics.taskSuccess['chat_failure']).toBe(1)
    })
  })

  describe('role compatibility', () => {
    it('should match compatible roles with tasks', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const testCases: Array<{ task: TaskType; expectedRole: string }> = [
        { task: 'code', expectedRole: 'code' },
        { task: 'vision', expectedRole: 'vision' },
        { task: 'embedding', expectedRole: 'embedding' },
        { task: 'reasoning', expectedRole: 'reasoning' },
      ]

      for (const testCase of testCases) {
        const request: RoutingRequest = {
          task: testCase.task,
          outputShape: 'text',
          latencyBudget: 'balanced',
          reliabilityPreference: 'balanced',
        }

        // For tasks with specific role requirements, filter profiles
        const compatibleProfiles = mockProfiles.filter(p => 
          testCase.expectedRole === 'general' || p.role === testCase.expectedRole
        )

        if (compatibleProfiles.length > 0) {
          vi.mocked(modelProfileRepository.findActive).mockResolvedValue(compatibleProfiles)
          
          const result = await modelRouter.selectProfile(request)
          expect(result.success).toBe(true)
        }
      }
    })
  })

  describe('latency budget handling', () => {
    it('should prefer faster models for fast latency budget', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'fast',
        reliabilityPreference: 'speed',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.reasoning).toContainEqual(expect.stringContaining('fast'))
    })

    it('should allow slower models for deep latency budget', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'reasoning',
        outputShape: 'text',
        latencyBudget: 'deep',
        reliabilityPreference: 'quality',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.reasoning.length).toBeGreaterThan(0)
    })
  })

  describe('reliability preference handling', () => {
    it('should prioritize speed for speed preference', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'chat',
        outputShape: 'text',
        latencyBudget: 'fast',
        reliabilityPreference: 'speed',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should prioritize quality for quality preference', async () => {
      const { modelProfileRepository } = await import('../../../src/lib/app/persistence/model-profile-repository')
      vi.mocked(modelProfileRepository.findActive).mockResolvedValue(mockProfiles)

      const request: RoutingRequest = {
        task: 'extract',
        outputShape: 'structured',
        latencyBudget: 'deep',
        reliabilityPreference: 'quality',
      }

      const result = await modelRouter.selectProfile(request)

      expect(result.success).toBe(true)
      expect(result.profile.performanceScore).toBeGreaterThanOrEqual(0.7)
    })
  })
})
