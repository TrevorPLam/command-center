/**
 * Structured Output Unit Tests
 * 
 * Comprehensive unit tests for structured output functionality,
 * including schema validation, parsing, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { z } from 'zod'
import { structuredOutputService, StructuredOutputRequest } from '../../../../src/lib/app/runtime/structured-output'
import { RuntimeAdapter, ChatRequest } from '../../../../src/lib/app/runtime/types'
import { RuntimeError } from '../../../../src/lib/app/runtime/errors'

// Mock runtime adapter
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
} as RuntimeAdapter

describe('StructuredOutputService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateStructuredOutput', () => {
    const TestSchema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    })

    it('should generate valid structured output', async () => {
      const validResponse = JSON.stringify({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract user information',
        systemPrompt: 'You are a data extraction expert',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      })
      expect(result.confidence).toBeGreaterThan(0.7)
      expect(result.parsingAttempts).toBe(1)
      expect(result.modelUsed).toBe('test-model')
      expect(result.processingTimeMs).toBeGreaterThan(0)
    })

    it('should handle JSON in markdown code blocks', async () => {
      const responseWithMarkdown = `Here's the extracted data:

\`\`\`json
{
  "name": "Jane Smith",
  "age": 25,
  "email": "jane@example.com"
}
\`\`\`

This completes the extraction.`

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(responseWithMarkdown))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract user information',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'Jane Smith',
        age: 25,
        email: 'jane@example.com',
      })
    })

    it('should retry on validation failures', async () => {
      // First response is invalid
      const invalidResponse = JSON.stringify({
        name: 'John Doe',
        age: 'thirty', // Invalid type
        email: 'invalid-email', // Invalid format
      })

      // Second response is valid
      const validResponse = JSON.stringify({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      })

      mockRuntimeAdapter.chat
        .mockResolvedValueOnce(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(invalidResponse))
              controller.close()
            },
          })
        )
        .mockResolvedValueOnce(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(validResponse))
              controller.close()
            },
          })
        )

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract user information',
        retryAttempts: 2,
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(result.success).toBe(true)
      expect(result.parsingAttempts).toBe(2)
      expect(mockRuntimeAdapter.chat).toHaveBeenCalledTimes(2)
    })

    it('should attempt auto-repair for malformed JSON', async () => {
      const malformedJson = `{
        "name": "John Doe",
        "age": 30,
        "email": "john@example.com",
      }` // Trailing comma

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(malformedJson))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract user information',
        validationMode: 'lenient',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      })
    })

    it('should handle complex nested schemas', async () => {
      const ComplexSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string(),
            age: z.number(),
          }),
          contacts: z.array(z.object({
            type: z.enum(['email', 'phone']),
            value: z.string(),
          })),
        }),
        metadata: z.record(z.any()),
      })

      const validResponse = JSON.stringify({
        user: {
          profile: {
            name: 'John Doe',
            age: 30,
          },
          contacts: [
            { type: 'email', value: 'john@example.com' },
            { type: 'phone', value: '+1234567890' },
          ],
        },
        metadata: {
          source: 'form',
          timestamp: '2023-01-01T00:00:00Z',
        },
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const request: StructuredOutputRequest = {
        schema: ComplexSchema,
        prompt: 'Extract complex user data',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual(JSON.parse(validResponse))
    })

    it('should handle enum validation', async () => {
      const EnumSchema = z.object({
        status: z.enum(['active', 'inactive', 'pending']),
        priority: z.enum(['low', 'medium', 'high']),
      })

      const validResponse = JSON.stringify({
        status: 'active',
        priority: 'high',
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const request: StructuredOutputRequest = {
        schema: EnumSchema,
        prompt: 'Extract status information',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(result.success).toBe(true)
      expect(result.data.status).toBe('active')
      expect(result.data.priority).toBe('high')
    })

    it('should reject invalid enum values', async () => {
      const EnumSchema = z.object({
        status: z.enum(['active', 'inactive', 'pending']),
      })

      const invalidResponse = JSON.stringify({
        status: 'unknown', // Invalid enum value
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(invalidResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const request: StructifiedOutputRequest = {
        schema: EnumSchema,
        prompt: 'Extract status information',
        retryAttempts: 1,
      }

      await expect(
        structuredOutputService.generateStructuredOutput(
          mockRuntimeAdapter,
          'test-model',
          request
        )
      ).rejects.toThrow('structured_output_failed')
    })

    it('should handle array schemas', async () => {
      const ArraySchema = z.object({
        items: z.array(z.object({
          id: z.number(),
          name: z.string(),
          tags: z.array(z.string()),
        })),
      })

      const validResponse = JSON.stringify({
        items: [
          { id: 1, name: 'Item 1', tags: ['tag1', 'tag2'] },
          { id: 2, name: 'Item 2', tags: ['tag3'] },
        ],
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const request: StructuredOutputRequest = {
        schema: ArraySchema,
        prompt: 'Extract item list',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(result.success).toBe(true)
      expect(result.data.items).toHaveLength(2)
      expect(result.data.items[0].tags).toEqual(['tag1', 'tag2'])
    })

    it('should pass correct parameters to runtime adapter', async () => {
      const validResponse = JSON.stringify({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract user information',
        systemPrompt: 'Custom system prompt',
        temperature: 0.5,
        maxTokens: 1000,
      }

      await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(mockRuntimeAdapter.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'test-model',
          messages: [
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Custom system prompt'),
            }),
            expect.objectContaining({
              role: 'user',
              content: 'Extract user information',
            }),
          ],
          format: 'json',
          options: expect.objectContaining({
            temperature: 0.5,
            num_predict: 1000,
          }),
          stream: false,
        })
      )
    })

    it('should handle timeout errors', async () => {
      mockRuntimeAdapter.chat.mockRejectedValue(new Error('Request timeout'))

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract user information',
        retryAttempts: 1,
      }

      await expect(
        structuredOutputService.generateStructuredOutput(
          mockRuntimeAdapter,
          'test-model',
          request
        )
      ).rejects.toThrow('structured_output_failed')
    })

    it('should validate result against confidence threshold', async () => {
      const validResponse = JSON.stringify({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      })

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(validResponse))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      // Set low confidence threshold
      structuredOutputService.updateConfig({ confidenceThreshold: 0.95 })

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract user information',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      // Result should be valid but confidence might be below threshold
      expect(result.success).toBe(true)
      expect(structuredOutputService.validateResult(result)).toBe(false)
    })
  })

  describe('validateResult', () => {
    it('should validate high confidence results', () => {
      const result = {
        data: { test: 'value' },
        confidence: 0.9,
        validationErrors: [],
        parsingAttempts: 1,
        modelUsed: 'test-model',
        processingTimeMs: 100,
        rawResponse: '{"test": "value"}',
      }

      expect(structuredOutputService.validateResult(result)).toBe(true)
    })

    it('should reject low confidence results', () => {
      const result = {
        data: { test: 'value' },
        confidence: 0.5,
        validationErrors: [],
        parsingAttempts: 1,
        modelUsed: 'test-model',
        processingTimeMs: 100,
        rawResponse: '{"test": "value"}',
      }

      expect(structuredOutputService.validateResult(result)).toBe(false)
    })
  })

  describe('configuration', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        defaultRetryAttempts: 5,
        confidenceThreshold: 0.8,
        enableAutoRepair: false,
      }

      structuredOutputService.updateConfig(newConfig)
      const config = structuredOutputService.getConfig()

      expect(config.defaultRetryAttempts).toBe(5)
      expect(config.confidenceThreshold).toBe(0.8)
      expect(config.enableAutoRepair).toBe(false)
    })

    it('should preserve existing configuration when updating partially', () => {
      const originalConfig = structuredOutputService.getConfig()
      
      structuredOutputService.updateConfig({ confidenceThreshold: 0.9 })
      const updatedConfig = structuredOutputService.getConfig()

      expect(updatedConfig.confidenceThreshold).toBe(0.9)
      expect(updatedConfig.defaultRetryAttempts).toBe(originalConfig.defaultRetryAttempts)
    })
  })

  describe('edge cases', () => {
    it('should handle empty responses', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(''))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const TestSchema = z.object({
        name: z.string(),
      })

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract data',
        retryAttempts: 1,
      }

      await expect(
        structuredOutputService.generateStructuredOutput(
          mockRuntimeAdapter,
          'test-model',
          request
        )
      ).rejects.toThrow('structured_output_failed')
    })

    it('should handle non-JSON responses', async () => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('This is not JSON'))
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const TestSchema = z.object({
        name: z.string(),
      })

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract data',
        retryAttempts: 1,
      }

      await expect(
        structuredOutputService.generateStructuredOutput(
          mockRuntimeAdapter,
          'test-model',
          request
        )
      ).rejects.toThrow('structured_output_failed')
    })

    it('should handle streaming responses correctly', async () => {
      const chunks = ['{"name":', '"John"', ',"age":', '30', '}']

      const mockStream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => {
            controller.enqueue(new TextEncoder().encode(chunk))
          })
          controller.close()
        },
      })

      mockRuntimeAdapter.chat.mockResolvedValue(mockStream)

      const TestSchema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const request: StructuredOutputRequest = {
        schema: TestSchema,
        prompt: 'Extract data',
      }

      const result = await structuredOutputService.generateStructuredOutput(
        mockRuntimeAdapter,
        'test-model',
        request
      )

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        name: 'John',
        age: 30,
      })
    })
  })
})
