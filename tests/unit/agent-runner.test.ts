/**
 * Agent Runner Tests
 * 
 * Unit tests for the agent runner service.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AgentRunner } from '@/lib/app/services/agent-runner'
import type { Job } from '@/lib/db/schema'

// Mock dependencies
vi.mock('@/lib/app/services/runtime-service')
vi.mock('@/lib/app/tools/execution-provider')
vi.mock('@/lib/app/persistence/job-repository')
vi.mock('@/lib/app/persistence/tool-repository')
vi.mock('@/app/actions/tool-approvals')

describe('AgentRunner', () => {
  let agentRunner: AgentRunner
  let mockJob: Job

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockJob = {
      id: 'test-job-1',
      type: 'agent_run',
      status: 'pending',
      config: JSON.stringify({
        prompt: 'Test prompt',
        modelProfileId: 'test-model',
        tools: ['read-file'],
        requireApproval: false,
        enableThinking: true
      }),
      result: null,
      error: null,
      progress: 0,
      maxSteps: 10,
      currentStep: 0,
      retryCount: 0,
      maxRetries: 3,
      nextRetryAt: null,
      priority: 0,
      workerId: null,
      timeoutMs: 60000,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: null,
      completedAt: null
    } as Job

    agentRunner = new AgentRunner(mockJob)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const runner = new AgentRunner(mockJob)
      expect(runner).toBeDefined()
    })

    it('should extract config from job metadata', () => {
      const jobWithConfig = {
        ...mockJob,
        maxSteps: 20,
        timeoutMs: 120000
      } as Job

      const runner = new AgentRunner(jobWithConfig, {})
      expect(runner).toBeDefined()
    })
  })

  describe('run', () => {
    it('should execute agent successfully', async () => {
      const mockAbortSignal = new AbortController().signal
      
      // Mock runtime service
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Test response',
        tool_calls: [],
        usage: { total_tokens: 100 }
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({
          output: 'Tool result',
          durationMs: 100
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      const result = await agentRunner.run('Test prompt', mockAbortSignal)

      expect(result.success).toBe(true)
      expect(result.finalResponse).toBe('Test response')
      expect(result.totalSteps).toBeGreaterThanOrEqual(0)
    })

    it('should handle abort signal', async () => {
      const abortController = new AbortController()
      abortController.abort()

      const result = await agentRunner.run('Test prompt', abortController.signal)

      expect(result.success).toBe(false)
      expect(result.aborted).toBe(true)
    })

    it('should respect max steps limit', async () => {
      const mockAbortSignal = new AbortController().signal
      
      // Mock runtime service to always return tool calls
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { name: 'read-file', arguments: '{}' }
          }
        ]
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({
          output: 'Tool result',
          durationMs: 100
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      const jobWithLowMaxSteps = {
        ...mockJob,
        maxSteps: 2
      } as Job

      const runner = new AgentRunner(jobWithLowMaxSteps)
      const result = await runner.run('Test prompt', mockAbortSignal)

      expect(result.totalSteps).toBeLessThanOrEqual(2)
    })
  })

  describe('tool execution', () => {
    it('should execute tools successfully', async () => {
      const mockAbortSignal = new AbortController().signal
      
      // Mock runtime service with tool call
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response with tool',
        tool_calls: [
          {
            id: 'tool-1',
            function: { name: 'read-file', arguments: '{"path": "test.txt"}' }
          }
        ]
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({
          output: 'File content',
          durationMs: 100
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      const result = await agentRunner.run('Test prompt', mockAbortSignal)

      expect(result.success).toBe(true)
      expect(result.toolsUsed).toContain('read-file')
      expect(mockProvider.execute).toHaveBeenCalled()
    })

    it('should handle tool approval workflow', async () => {
      const jobWithApproval = {
        ...mockJob,
        config: JSON.stringify({
          prompt: 'Test prompt',
          requireApproval: true
        })
      } as Job

      const runner = new AgentRunner(jobWithApproval)
      const mockAbortSignal = new AbortController().signal

      // Mock approval request
      const { createApprovalRequest, getApprovalStatus } = await import('@/app/actions/tool-approvals')
      vi.mocked(createApprovalRequest).mockResolvedValue({
        success: true,
        requestId: 'approval-1'
      })
      vi.mocked(getApprovalStatus).mockResolvedValue({
        success: true,
        status: { status: 'approved' }
      })

      // Mock runtime service with tool call
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { name: 'read-file', arguments: '{}' }
          }
        ]
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({
          output: 'File content',
          durationMs: 100
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      const result = await runner.run('Test prompt', mockAbortSignal)

      expect(createApprovalRequest).toHaveBeenCalled()
      expect(getApprovalStatus).toHaveBeenCalled()
      expect(result.success).toBe(true)
    })

    it('should handle tool approval denial', async () => {
      const jobWithApproval = {
        ...mockJob,
        config: JSON.stringify({
          prompt: 'Test prompt',
          requireApproval: true
        })
      } as Job

      const runner = new AgentRunner(jobWithApproval)
      const mockAbortSignal = new AbortController().signal

      // Mock approval denial
      const { createApprovalRequest, getApprovalStatus } = await import('@/app/actions/tool-approvals')
      vi.mocked(createApprovalRequest).mockResolvedValue({
        success: true,
        requestId: 'approval-1'
      })
      vi.mocked(getApprovalStatus).mockResolvedValue({
        success: true,
        status: { status: 'denied' }
      })

      // Mock runtime service with tool call
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { name: 'read-file', arguments: '{}' }
          }
        ]
      })

      const result = await runner.run('Test prompt', mockAbortSignal)

      expect(result.success).toBe(false)
      expect(result.error).toContain('denied')
    })
  })

  describe('risk assessment', () => {
    it('should correctly assess tool risk levels', () => {
      // Access private method through reflection for testing
      const runner = agentRunner as any
      
      expect(runner.getToolRiskLevel('read-file')).toBe('low')
      expect(runner.getToolRiskLevel('index-file')).toBe('medium')
      expect(runner.getToolRiskLevel('shell-command')).toBe('high')
      expect(runner.getToolRiskLevel('unknown')).toBe('low')
    })

    it('should correctly identify tool capabilities', () => {
      const runner = agentRunner as any
      
      const fileCapabilities = runner.getToolCapabilities('read-file')
      expect(fileCapabilities).toContain('file-read')
      expect(fileCapabilities).toContain('local-access')

      const shellCapabilities = runner.getToolCapabilities('shell-command')
      expect(shellCapabilities).toContain('shell-execution')
      expect(shellCapabilities).toContain('system-access')
    })
  })

  describe('audit logging', () => {
    it('should record tool runs with audit data', async () => {
      const mockAbortSignal = new AbortController().signal
      
      // Mock runtime service with tool call
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { name: 'read-file', arguments: '{"path": "test.txt"}' }
          }
        ]
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({
          output: 'File content',
          durationMs: 100
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      // Mock tool run repository
      const { toolRunRepository } = await import('@/lib/app/persistence/tool-repository')
      vi.mocked(toolRunRepository.create).mockResolvedValue({} as any)

      await agentRunner.run('Test prompt', mockAbortSignal)

      expect(toolRunRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'read-file',
          status: 'completed',
          metadata: expect.stringContaining('riskLevel')
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle runtime service errors', async () => {
      const mockAbortSignal = new AbortController().signal
      
      // Mock runtime service error
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockRejectedValue(new Error('Runtime error'))

      const result = await agentRunner.run('Test prompt', mockAbortSignal)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Runtime error')
    })

    it('should handle tool execution errors', async () => {
      const mockAbortSignal = new AbortController().signal
      
      // Mock runtime service with tool call
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { name: 'read-file', arguments: '{}' }
          }
        ]
      })

      // Mock execution provider error
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockRejectedValue(new Error('Tool error'))
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      const result = await agentRunner.run('Test prompt', mockAbortSignal)

      expect(result.success).toBe(true) // Agent can still succeed even if tool fails
      expect(result.toolsUsed).toContain('read-file')
    })
  })
})
