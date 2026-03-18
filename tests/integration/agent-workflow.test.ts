/**
 * Agent Workflow Integration Tests
 * 
 * Integration tests for the complete agent workflow including
 * job creation, execution, and monitoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAgentJob, listJobs, getQueueStats } from '@/app/actions/jobs'
import { AgentJobProcessor } from '@/lib/app/services/job-worker'
import { runAgent } from '@/lib/app/services/agent-runner'
import type { Job } from '@/lib/db/schema'

// Mock dependencies
vi.mock('@/lib/app/services/runtime-service')
vi.mock('@/lib/app/tools/execution-provider')
vi.mock('@/lib/app/persistence/job-repository')
vi.mock('@/lib/app/persistence/tool-repository')
vi.mock('@/app/actions/tool-approvals')

describe('Agent Workflow Integration', () => {
  let mockJob: Job

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockJob = {
      id: 'test-agent-job',
      type: 'agent_run',
      status: 'pending',
      config: JSON.stringify({
        prompt: 'Test agent prompt',
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
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('complete agent workflow', () => {
    it('should execute full agent workflow from job creation to completion', async () => {
      // Mock job creation
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.create).mockResolvedValue(mockJob)

      // Mock runtime service
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Agent response',
        tool_calls: [],
        usage: { total_tokens: 50 }
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([
          {
            name: 'read-file',
            description: 'Read file contents',
            riskLevel: 'low',
            requiresApproval: false
          }
        ]),
        execute: vi.fn().mockResolvedValue({
          output: 'File content',
          durationMs: 100
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      // Create agent job
      const jobResult = await createAgentJob({
        prompt: 'Test prompt',
        maxSteps: 5,
        tools: ['read-file']
      })

      expect(jobResult.success).toBe(true)
      expect(jobResult.job).toBeDefined()
      expect(jobResult.job?.type).toBe('agent_run')

      // Process job with agent processor
      const processor = new AgentJobProcessor()
      const abortSignal = new AbortController().signal

      const result = await processor.process(mockJob, abortSignal)

      expect(result.success).toBe(true)
      expect(result.finalResponse).toBe('Agent response')
      expect(result.steps).toBe(1)
      expect(result.tokensUsed).toBe(50)
    })

    it('should handle agent workflow with tool calls', async () => {
      // Mock job creation
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.create).mockResolvedValue(mockJob)

      // Mock runtime service with tool calls
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response with tool result',
        tool_calls: [
          {
            id: 'tool-1',
            function: { 
              name: 'read-file', 
              arguments: '{"path": "test.txt"}' 
            }
          }
        ]
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([
          {
            name: 'read-file',
            description: 'Read file contents',
            riskLevel: 'low',
            requiresApproval: false
          }
        ]),
        execute: vi.fn().mockResolvedValue({
          output: 'Test file content',
          durationMs: 150
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      // Mock tool run repository
      const { toolRunRepository } = await import('@/lib/app/persistence/tool-repository')
      vi.mocked(toolRunRepository.create).mockResolvedValue({} as any)

      // Create and process job
      const jobResult = await createAgentJob({
        prompt: 'Read test.txt file',
        maxSteps: 5,
        tools: ['read-file']
      })

      const processor = new AgentJobProcessor()
      const result = await processor.process(jobResult.job!, new AbortController().signal)

      expect(result.success).toBe(true)
      expect(result.toolsUsed).toContain('read-file')
      expect(result.durationMs).toBeGreaterThan(0)
      expect(mockProvider.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'read-file',
          input: { path: 'test.txt' }
        }),
        expect.any(AbortSignal)
      )
    })

    it('should handle agent workflow with approval requirements', async () => {
      // Mock job with approval requirement
      const jobWithApproval = {
        ...mockJob,
        config: JSON.stringify({
          prompt: 'Test prompt',
          requireApproval: true
        })
      } as Job

      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.create).mockResolvedValue(jobWithApproval)

      // Mock approval workflow
      const { createApprovalRequest, getApprovalStatus } = await import('@/app/actions/tool-approvals')
      vi.mocked(createApprovalRequest).mockResolvedValue({
        success: true,
        requestId: 'approval-123'
      })
      vi.mocked(getApprovalStatus).mockResolvedValue({
        success: true,
        status: { status: 'approved' }
      })

      // Mock runtime service with tool calls
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { 
              name: 'read-file', 
              arguments: '{}' 
            }
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

      // Create and process job
      const jobResult = await createAgentJob({
        prompt: 'Test prompt with approval',
        requireApproval: true
      })

      const processor = new AgentJobProcessor()
      const result = await processor.process(jobResult.job!, new AbortController().signal)

      expect(result.success).toBe(true)
      expect(createApprovalRequest).toHaveBeenCalled()
      expect(getApprovalStatus).toHaveBeenCalled()
    })
  })

  describe('error handling and recovery', () => {
    it('should handle runtime service failures gracefully', async () => {
      // Mock job creation
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.create).mockResolvedValue(mockJob)

      // Mock runtime service failure
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockRejectedValue(new Error('Runtime service unavailable'))

      const processor = new AgentJobProcessor()
      
      await expect(processor.process(mockJob, new AbortController().signal))
        .rejects.toThrow('Runtime service unavailable')
    })

    it('should handle tool execution failures', async () => {
      // Mock job creation
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.create).mockResolvedValue(mockJob)

      // Mock runtime service with tool calls
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { 
              name: 'read-file', 
              arguments: '{}' 
            }
          }
        ]
      })

      // Mock execution provider failure
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockRejectedValue(new Error('Tool execution failed'))
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      // Agent should still succeed even if tool fails
      const processor = new AgentJobProcessor()
      const result = await processor.process(mockJob, new AbortController().signal)

      expect(result.success).toBe(true) // Agent completion doesn't depend on tool success
      expect(result.toolsUsed).toContain('read-file')
    })

    it('should handle approval denial', async () => {
      // Mock job with approval requirement
      const jobWithApproval = {
        ...mockJob,
        config: JSON.stringify({
          prompt: 'Test prompt',
          requireApproval: true
        })
      } as Job

      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.create).mockResolvedValue(jobWithApproval)

      // Mock approval denial
      const { createApprovalRequest, getApprovalStatus } = await import('@/app/actions/tool-approvals')
      vi.mocked(createApprovalRequest).mockResolvedValue({
        success: true,
        requestId: 'approval-123'
      })
      vi.mocked(getApprovalStatus).mockResolvedValue({
        success: true,
        status: { status: 'denied' }
      })

      // Mock runtime service with tool calls
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { 
              name: 'read-file', 
              arguments: '{}' 
            }
          }
        ]
      })

      const processor = new AgentJobProcessor()
      const result = await processor.process(jobWithApproval, new AbortController().signal)

      expect(result.success).toBe(true) // Agent can still complete without tool
      expect(createApprovalRequest).toHaveBeenCalled()
    })
  })

  describe('job monitoring and statistics', () => {
    it('should provide accurate queue statistics', async () => {
      // Mock queue statistics
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.getStats).mockResolvedValue({
        total: 50,
        byStatus: {
          pending: 10,
          running: 3,
          completed: 35,
          failed: 2,
          cancelled: 0,
          retrying: 0
        },
        byType: {
          agent_run: 30,
          rag_index: 15,
          other: 5
        },
        runningJobs: []
      })

      const stats = await getQueueStats()

      expect(stats.success).toBe(true)
      expect(stats.stats).toBeDefined()
      expect(stats.stats?.pending).toBe(10)
      expect(stats.stats?.running).toBe(3)
      expect(stats.stats?.completed).toBe(35)
      expect(stats.stats?.failed).toBe(2)
    })

    it('should list jobs with filtering', async () => {
      // Mock job list
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.list).mockResolvedValue([mockJob])

      const jobs = await listJobs({ 
        status: 'pending', 
        type: 'agent_run',
        limit: 10 
      })

      expect(jobs.success).toBe(true)
      expect(jobs.jobs).toHaveLength(1)
      expect(jobs.jobs?.[0].type).toBe('agent_run')
      expect(jobs.jobs?.[0].status).toBe('pending')
      expect(jobRepository.list).toHaveBeenCalledWith({
        status: 'pending',
        type: 'agent_run',
        limit: 10,
        offset: 0
      })
    })
  })

  describe('agent runner integration', () => {
    it('should run agent with complete workflow', async () => {
      // Mock runtime service
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Final agent response',
        tool_calls: [],
        usage: { total_tokens: 100 }
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({
          output: 'Tool result',
          durationMs: 50
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      // Mock repositories
      const { jobRepository, toolRunRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.getById).mockResolvedValue(mockJob)
      vi.mocked(jobRepository.update).mockResolvedValue(mockJob)
      vi.mocked(toolRunRepository.create).mockResolvedValue({} as any)

      const result = await runAgent(mockJob, new AbortController().signal)

      expect(result.success).toBe(true)
      expect(result.finalResponse).toBe('Final agent response')
      expect(result.totalSteps).toBe(1)
      expect(result.totalTokensUsed).toBe(100)
      expect(result.aborted).toBe(false)
    })

    it('should respect agent limits and constraints', async () => {
      // Mock runtime service that always calls tools
      const { runtimeService } = await import('@/lib/app/services/runtime-service')
      vi.mocked(runtimeService.chat).mockResolvedValue({
        content: 'Response',
        tool_calls: [
          {
            id: 'tool-1',
            function: { 
              name: 'read-file', 
              arguments: '{}' 
            }
          }
        ]
      })

      // Mock execution provider
      const { getExecutionProvider } = await import('@/lib/app/tools/execution-provider')
      const mockProvider = {
        listTools: vi.fn().mockResolvedValue([]),
        execute: vi.fn().mockResolvedValue({
          output: 'Tool result',
          durationMs: 50
        })
      }
      vi.mocked(getExecutionProvider).mockReturnValue(mockProvider)

      // Mock repositories
      const { jobRepository, toolRunRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.getById).mockResolvedValue(mockJob)
      vi.mocked(jobRepository.update).mockResolvedValue(mockJob)
      vi.mocked(toolRunRepository.create).mockResolvedValue({} as any)

      // Job with low max steps
      const jobWithLowSteps = {
        ...mockJob,
        maxSteps: 2
      } as Job

      const result = await runAgent(jobWithLowSteps, new AbortController().signal)

      expect(result.totalSteps).toBeLessThanOrEqual(2)
      expect(result.success).toBe(true)
    })
  })
})
