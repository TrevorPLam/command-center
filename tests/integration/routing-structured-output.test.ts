/**
 * Routing and Structured Output Integration Tests
 * 
 * Integration tests that verify the complete workflow from routing
 * through structured output generation and fallback handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { z } from 'zod'
import { modelRouter } from '../../../src/lib/app/orchestration/model-router'
import { structuredOutputService } from '../../../src/lib/app/runtime/structured-output'
import { fallbackPolicyService } from '../../../src/lib/app/orchestration/fallback-policy'
import { createSchemaTasksService } from '../../../src/lib/app/orchestration/schema-tasks'
import { modelProfileRepository } from '../../../src/lib/app/persistence/model-profile-repository'
import { ModelProfile, ModelRole } from '../../../src/lib/db/schema'

// Mock dependencies
vi.mock('../../../src/lib/app/persistence/model-profile-repository')

describe('Routing and Structured Output Integration', () => {
  const mockProfiles: ModelProfile[] = [
    {
      id: 'general-profile',
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
      id: 'code-profile',
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
      id: 'reasoning-profile',
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

  const mockRuntimeAdapter = {
    chat: vi.fn(),
    embed: vi.fn(),
    generate: vi.fn(),
    listModels: vi.fn(),
    listRunningModels: vi.fn(),
    pullModel: vi.fn(),
    deleteModel: vi.fn(),
    showModel: vi.fn(),
    getCapabilities: vi.fn(),
    getHealth: vi.fn(),
  }

  const mockRepository = {
    findActive: vi.fn(),
    findByRole: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any

  let schemaTasksService: ReturnType<typeof createSchemaTasksService>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(modelProfileRepository).findActive = mockRepository.findActive
    vi.mocked(modelProfileRepository).findByRole = mockRepository.findByRole
    vi.mocked(modelProfileRepository).findById = mockRepository.findById

    mockRepository.findActive.mockResolvedValue(mockProfiles)
    mockRepository.findById.mockImplementation((id) => 
      Promise.resolve(mockProfiles.find(p => p.id === id) || null)
    )

    schemaTasksService = createSchemaTasksService(mockRuntimeAdapter, structuredOutputService)
    modelRouter.resetMetrics()
  })

  describe('complete workflow integration', () => {
    it('should route chat task and generate structured output', async () => {
      // Mock successful routing
      const routingResult = {
        profile: mockProfiles[0], // general profile
        confidence: 0.85,
        reasoning: ['Best fit for chat tasks'],
        fallbackProfiles: [mockProfiles[2]],
        routingTimeMs: 15,
      }

      // Mock structured output response
      const ChatSchema = z.object({
        message: z.string(),
        sentiment: z.enum(['positive', 'negative', 'neutral']),
        confidence: z.number(),
      })

      const validResponse = JSON.stringify({
        message: 'Hello! How can I help you today?',
        sentiment: 'positive',
        confidence: 0.9,
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      // Execute workflow
      const routingRequest = {
        task: 'chat' as const,
        outputShape: 'json' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      const selectedProfile = await modelRouter.selectProfile(routingRequest)
      expect(selectedProfile.profile.role).toBe('general')

      const structuredOutputRequest = {
        schema: ChatSchema,
        prompt: 'Generate a friendly greeting',
        systemPrompt: 'You are a helpful assistant',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        selectedProfile.profile.runtimeModelName,
        structuredOutputRequest
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        message: 'Hello! How can I help you today?',
        sentiment: 'positive',
        confidence: 0.9,
      })

      // Verify metrics were updated
      const metrics = modelRouter.getMetrics()
      expect(metrics.requestCount).toBe(1)
      expect(metrics.modelUsage['general-profile']).toBe(1)
    })

    it('should route code task with tool requirements', async () => {
      const CodeSchema = z.object({
        code: z.string(),
        language: z.string(),
        explanation: z.string(),
      })

      const validResponse = JSON.stringify({
        code: 'function hello() { return "Hello, World!"; }',
        language: 'javascript',
        explanation: 'Simple hello world function',
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const routingRequest = {
        task: 'code' as const,
        requiresTools: true,
        outputShape: 'structured' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'quality' as const,
      }

      const selectedProfile = await modelRouter.selectProfile(routingRequest)
      expect(selectedProfile.profile.role).toBe('code')
      expect(selectedProfile.profile.toolCallingReliability).toBeGreaterThan(0.8)

      const result = await schemaTasksService.analyzeCode('function hello() { return "Hello"; }', {
        language: 'javascript',
        checkSecurity: true,
      })

      expect(result.language).toBe('javascript')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should handle fallback when primary model fails', async () => {
      // Create fallback chain
      const fallbackChainId = fallbackPolicyService.createFallbackChain({
        name: 'Test Chain',
        description: 'Test fallback chain',
        primaryProfileId: 'general-profile',
        fallbackProfileIds: ['reasoning-profile'],
        retryPolicy: {
          maxAttempts: 2,
          baseDelayMs: 100,
          maxDelayMs: 1000,
          backoffMultiplier: 2,
          retryableErrors: ['timeout'],
          nonRetryableErrors: ['invalid_request'],
          jitterEnabled: false,
        },
        circuitBreakerPolicy: {
          failureThreshold: 3,
          recoveryTimeoutMs: 60000,
          halfOpenMaxCalls: 2,
          expectedExceptions: ['timeout'],
          monitoringWindowMs: 300000,
        },
        isActive: true,
      })

      // Mock primary model failure
      mockRuntimeAdapter.chat.mockRejectedValueOnce(new Error('Timeout'))
      
      // Mock fallback success
      const validResponse = JSON.stringify({
        result: 'Success from fallback',
        confidence: 0.8,
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const routingRequest = {
        task: 'chat' as const,
        outputShape: 'json' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      const fallbackResult = await fallbackPolicyService.executeWithFallback(
        routingRequest,
        fallbackChainId
      )

      expect(fallbackResult.success).toBe(true)
      expect(fallbackResult.profileUsed?.id).toBe('reasoning-profile')
      expect(fallbackResult.executionPath).toContain('fallback:reasoning-profile')
      expect(fallbackResult.attempts).toBeGreaterThan(1)
    })

    it('should handle reasoning traces with structured output', async () => {
      const ReasoningSchema = z.object({
        steps: z.array(z.object({
          thought: z.string(),
          confidence: z.number(),
        })),
        conclusion: z.string(),
      })

      const validResponse = JSON.stringify({
        steps: [
          { thought: 'First, I need to understand the problem', confidence: 0.9 },
          { thought: 'Then I will analyze the requirements', confidence: 0.8 },
          { thought: 'Finally, I will provide a solution', confidence: 0.85 },
        ],
        conclusion: 'Based on the analysis, the best approach is...',
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const routingRequest = {
        task: 'reasoning' as const,
        requiresThinking: true,
        outputShape: 'structured' as const,
        latencyBudget: 'deep' as const,
        reliabilityPreference: 'quality' as const,
      }

      const selectedProfile = await modelRouter.selectProfile(routingRequest)
      expect(selectedProfile.profile.role).toBe('reasoning')

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        selectedProfile.profile.runtimeModelName,
        {
          schema: ReasoningSchema,
          prompt: 'Solve this step by step',
          systemPrompt: 'Show your reasoning process',
        }
      )

      expect(result.success).toBe(true)
      expect(result.data.steps).toHaveLength(3)
      expect(result.data.conclusion).toBeDefined()
    })
  })

  describe('error handling integration', () => {
    it('should handle structured output validation failures', async () => {
      const TestSchema = z.object({
        required_field: z.string(),
        optional_field: z.string().optional(),
      })

      // Mock invalid response
      const invalidResponse = JSON.stringify({
        optional_field: 'value',
        // Missing required_field
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(invalidResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const routingRequest = {
        task: 'extract' as const,
        outputShape: 'structured' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'quality' as const,
      }

      const selectedProfile = await modelRouter.selectProfile(routingRequest)

      await expect(
        structuredOutputService.generateStructuredOutput(
          mockRuntimeAdapter,
          selectedProfile.profile.runtimeModelName,
          {
            schema: TestSchema,
            prompt: 'Extract data',
            retryAttempts: 1,
          }
        )
      ).rejects.toThrow('structured_output_failed')
    })

    it('should handle routing failures gracefully', async () => {
      // Mock empty profile list
      mockRepository.findActive.mockResolvedValue([])

      const routingRequest = {
        task: 'chat' as const,
        outputShape: 'text' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'balanced' as const,
      }

      await expect(modelRouter.selectProfile(routingRequest)).rejects.toThrow('no_suitable_model')
    })

    it('should handle circuit breaker scenarios', async () => {
      // Create circuit breaker scenario
      const fallbackChainId = fallbackPolicyService.createFallbackChain({
        name: 'Circuit Breaker Test',
        description: 'Test circuit breaker behavior',
        primaryProfileId: 'general-profile',
        fallbackProfileIds: ['code-profile'],
        retryPolicy: {
          maxAttempts: 1,
          baseDelayMs: 100,
          maxDelayMs: 500,
          backoffMultiplier: 1,
          retryableErrors: [],
          nonRetryableErrors: [],
          jitterEnabled: false,
        },
        circuitBreakerPolicy: {
          failureThreshold: 2,
          recoveryTimeoutMs: 1000,
          halfOpenMaxCalls: 1,
          expectedExceptions: [],
          monitoringWindowMs: 5000,
        },
        isActive: true,
      })

      // Mock repeated failures to trigger circuit breaker
      mockRuntimeAdapter.chat.mockRejectedValue(new Error('Service unavailable'))

      const routingRequest = {
        task: 'chat' as const,
        outputShape: 'text' as const,
        latencyBudget: 'fast' as const,
        reliabilityPreference: 'speed' as const,
      }

      // First failure
      const result1 = await fallbackPolicyService.executeWithFallback(routingRequest, fallbackChainId)
      expect(result1.success).toBe(false)

      // Second failure - should trigger circuit breaker
      const result2 = await fallbackPolicyService.executeWithFallback(routingRequest, fallbackChainId)
      expect(result2.success).toBe(false)

      // Third attempt should be blocked by circuit breaker
      const result3 = await fallbackPolicyService.executeWithFallback(routingRequest, fallbackChainId)
      expect(result3.success).toBe(false)
      expect(result3.executionPath).not.toContain('primary:general-profile')
    })
  })

  describe('performance and scalability', () => {
    it('should handle concurrent requests efficiently', async () => {
      const TestSchema = z.object({
        id: z.number(),
        value: z.string(),
      })

      const validResponse = JSON.stringify({
        id: 1,
        value: 'test',
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const routingRequest = {
        task: 'extract' as const,
        outputShape: 'json' as const,
        latencyBudget: 'fast' as const,
        reliabilityPreference: 'speed' as const,
      }

      // Execute multiple concurrent requests
      const promises = Array.from({ length: 10 }, async () => {
        const selectedProfile = await modelRouter.selectProfile(routingRequest)
        return await structuredOutputService.generateStructuredOutput(
          mockRuntimeAdapter,
          selectedProfile.profile.runtimeModelName,
          {
            schema: TestSchema,
            prompt: 'Extract data',
          }
        )
      })

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.success).toBe(true)
        expect(result.data).toEqual({ id: 1, value: 'test' })
      })

      // Verify metrics
      const metrics = modelRouter.getMetrics()
      expect(metrics.requestCount).toBe(10)
      expect(metrics.averageLatency).toBeGreaterThan(0)
    })

    it('should maintain performance with complex schemas', async () => {
      const ComplexSchema = z.object({
        users: z.array(z.object({
          id: z.number(),
          profile: z.object({
            name: z.string(),
            email: z.string().email(),
            preferences: z.record(z.boolean()),
          }),
          history: z.array(z.object({
            action: z.string(),
            timestamp: z.string(),
            metadata: z.record(z.any()),
          })),
        })),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
        }),
      })

      const validResponse = JSON.stringify({
        users: [
          {
            id: 1,
            profile: {
              name: 'John Doe',
              email: 'john@example.com',
              preferences: { newsletter: true, notifications: false },
            },
            history: [
              {
                action: 'login',
                timestamp: '2023-01-01T00:00:00Z',
                metadata: { ip: '127.0.0.1' },
              },
            ],
          },
        ],
        pagination: { page: 1, limit: 10, total: 1 },
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const routingRequest = {
        task: 'extract' as const,
        outputShape: 'structured' as const,
        latencyBudget: 'balanced' as const,
        reliabilityPreference: 'quality' as const,
      }

      const startTime = Date.now()
      
      const selectedProfile = await modelRouter.selectProfile(routingRequest)
      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        selectedProfile.profile.runtimeModelName,
        {
          schema: ComplexSchema,
          prompt: 'Extract complex user data',
        }
      )

      const endTime = Date.now()
      const processingTime = endTime - startTime

      expect(result.success).toBe(true)
      expect(result.data.users).toHaveLength(1)
      expect(processingTime).toBeLessThan(1000) // Should complete within 1 second
    })
  })

  describe('schema tasks integration', () => {
    it('should integrate schema tasks with routing', async () => {
      // Mock extraction response
      const extractionResponse = JSON.stringify({
        entities: [
          { text: 'John Doe', type: 'person', confidence: 0.9, start_index: 0, end_index: 8 },
          { text: 'New York', type: 'location', confidence: 0.85, start_index: 25, end_index: 33 },
        ],
        key_points: ['Person named John Doe', 'Location is New York'],
        summary: 'Text mentions John Doe and New York',
        sentiment: 'neutral',
        confidence: 0.88,
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(extractionResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const text = 'John Doe lives in New York and works as a software developer.'
      
      const result = await schemaTasksService.extractInformation(text, {
        entityTypes: ['person', 'location', 'organization'],
        extractSentiment: true,
        extractSummary: true,
      })

      expect(result.entities).toHaveLength(2)
      expect(result.entities[0].text).toBe('John Doe')
      expect(result.entities[0].type).toBe('person')
      expect(result.sentiment).toBe('neutral')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should handle classification tasks with routing', async () => {
      const classificationResponse = JSON.stringify({
        category: 'technology',
        subcategory: 'software',
        confidence: 0.92,
        reasoning: 'Text discusses software development and programming concepts',
        alternative_categories: [
          { name: 'business', confidence: 0.05 },
          { name: 'education', confidence: 0.03 },
        ],
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(classificationResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const text = 'The latest JavaScript framework includes advanced features for reactive programming.'
      const categories = ['technology', 'business', 'education', 'healthcare']

      const result = await schemaTasksService.classifyText(text, categories, {
        requireReasoning: true,
        provideAlternatives: true,
      })

      expect(result.category).toBe('technology')
      expect(result.confidence).toBeGreaterThan(0.9)
      expect(result.reasoning).toBeDefined()
      expect(result.alternative_categories).toHaveLength(2)
    })
  })
})
