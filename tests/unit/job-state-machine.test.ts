/**
 * Job State Machine Tests
 * 
 * Unit tests for the job state machine and queue manager.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JobStateMachine, QueueManager } from '@/lib/app/services/job-state-machine'
import type { Job } from '@/lib/db/schema'

// Mock dependencies
vi.mock('@/lib/app/persistence/job-repository')

describe('JobStateMachine', () => {
  let stateMachine: JobStateMachine
  let mockJob: Job

  beforeEach(() => {
    vi.clearAllMocks()
    
    stateMachine = new JobStateMachine()
    
    mockJob = {
      id: 'test-job-1',
      type: 'agent_run',
      status: 'pending',
      config: '{}',
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

  describe('state transitions', () => {
    it('should allow valid transitions', () => {
      expect(stateMachine.canTransition('pending', 'running')).toBe(true)
      expect(stateMachine.canTransition('running', 'completed')).toBe(true)
      expect(stateMachine.canTransition('running', 'failed')).toBe(true)
      expect(stateMachine.canTransition('failed', 'retrying')).toBe(true)
      expect(stateMachine.canTransition('retrying', 'pending')).toBe(true)
    })

    it('should reject invalid transitions', () => {
      expect(stateMachine.canTransition('completed', 'running')).toBe(false)
      expect(stateMachine.canTransition('failed', 'completed')).toBe(false)
      expect(stateMachine.canTransition('pending', 'completed')).toBe(false)
    })

    it('should execute valid transitions', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.update).mockResolvedValue({
        ...mockJob,
        status: 'running',
        startedAt: new Date()
      })

      const result = await stateMachine.transition(mockJob, 'running')

      expect(result).toBeDefined()
      expect(result?.status).toBe('running')
      expect(jobRepository.update).toHaveBeenCalledWith(
        mockJob.id,
        expect.objectContaining({
          status: 'running',
          startedAt: expect.any(Date)
        })
      )
    })

    it('should reject invalid transitions with error', async () => {
      await expect(stateMachine.transition(mockJob, 'completed'))
        .rejects.toThrow('Invalid state transition')
    })
  })

  describe('retry logic', () => {
    it('should allow retry when under limit', () => {
      const jobWithRetries = {
        ...mockJob,
        retryCount: 1,
        maxRetries: 3
      } as Job

      expect(stateMachine.canTransition('failed', 'retrying', jobWithRetries)).toBe(true)
    })

    it('should reject retry when at limit', () => {
      const jobWithMaxRetries = {
        ...mockJob,
        retryCount: 3,
        maxRetries: 3
      } as Job

      expect(stateMachine.canTransition('failed', 'retrying', jobWithMaxRetries)).toBe(false)
    })

    it('should schedule retry with exponential backoff', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.update).mockResolvedValue(mockJob)

      const jobWithRetries = {
        ...mockJob,
        retryCount: 1,
        maxRetries: 3,
        status: 'failed'
      } as Job

      await stateMachine.transition(jobWithRetries, 'retrying')

      expect(jobRepository.update).toHaveBeenCalledWith(
        jobWithRetries.id,
        expect.objectContaining({
          retryCount: 2,
          nextRetryAt: expect.any(Date)
        })
      )
    })
  })

  describe('timeout detection', () => {
    it('should detect timed out jobs', () => {
      const oldDate = new Date(Date.now() - 400000) // 400 seconds ago
      const timedOutJob = {
        ...mockJob,
        status: 'running',
        startedAt: oldDate
      } as Job

      expect(stateMachine.isTimedOut(timedOutJob)).toBe(true)
    })

    it('should not detect recent jobs as timed out', () => {
      const recentJob = {
        ...mockJob,
        status: 'running',
        startedAt: new Date(Date.now() - 10000) // 10 seconds ago
      } as Job

      expect(stateMachine.isTimedOut(recentJob)).toBe(false)
    })

    it('should not timeout non-running jobs', () => {
      const pendingJob = {
        ...mockJob,
        status: 'pending',
        startedAt: new Date(Date.now() - 400000)
      } as Job

      expect(stateMachine.isTimedOut(pendingJob)).toBe(false)
    })
  })

  describe('queue operations', () => {
    it('should get next available jobs', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.list).mockResolvedValue([
        mockJob,
        { ...mockJob, id: 'job-2' }
      ])

      const jobs = await stateMachine.getNextJobs(5)

      expect(jobs).toHaveLength(2)
      expect(jobRepository.list).toHaveBeenCalledWith({
        limit: 5,
        status: 'pending',
        type: undefined
      })
    })

    it('should filter jobs by retry delay', async () => {
      const futureDate = new Date(Date.now() + 60000) // 1 minute in future
      const jobWithRetryDelay = {
        ...mockJob,
        nextRetryAt: futureDate
      } as Job

      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.list).mockResolvedValue([jobWithRetryDelay])

      const jobs = await stateMachine.getNextJobs(5)

      // Should filter out jobs with future retry times
      expect(jobs).toHaveLength(0)
    })
  })

  describe('statistics', () => {
    it('should get queue statistics', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.getStats).mockResolvedValue({
        total: 100,
        byStatus: {
          pending: 10,
          running: 5,
          completed: 80,
          failed: 3,
          cancelled: 2,
          retrying: 0
        },
        byType: {
          agent_run: 50,
          rag_index: 30,
          other: 20
        },
        runningJobs: []
      })

      const stats = await stateMachine.getQueueStats()

      expect(stats.pending).toBe(10)
      expect(stats.running).toBe(5)
      expect(stats.completed).toBe(80)
      expect(stats.failed).toBe(3)
      expect(stats.overdue).toBe(0)
    })
  })
})

describe('QueueManager', () => {
  let queueManager: QueueManager
  let mockJob: Job

  beforeEach(() => {
    vi.clearAllMocks()
    
    queueManager = new QueueManager()
    
    mockJob = {
      id: 'test-job-1',
      type: 'agent_run',
      status: 'pending',
      config: '{}',
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

  describe('job operations', () => {
    it('should enqueue new job', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.create).mockResolvedValue(mockJob)

      const job = await queueManager.enqueue({
        type: 'agent_run',
        status: 'pending',
        config: '{}',
        progress: 0
      })

      expect(job).toBeDefined()
      expect(job.id).toBe(mockJob.id)
      expect(jobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_run',
          status: 'pending'
        })
      )
    })

    it('should dequeue available jobs', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.list).mockResolvedValue([mockJob])
      vi.mocked(jobRepository.update).mockResolvedValue({
        ...mockJob,
        status: 'running',
        startedAt: new Date()
      })

      const jobs = await queueManager.dequeue(5)

      expect(jobs).toHaveLength(1)
      expect(jobs[0].status).toBe('running')
      expect(jobRepository.update).toHaveBeenCalledWith(
        mockJob.id,
        expect.objectContaining({
          status: 'running'
        })
      )
    })

    it('should complete job successfully', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.getById).mockResolvedValue(mockJob)
      vi.mocked(jobRepository.update).mockResolvedValue({
        ...mockJob,
        status: 'completed',
        result: '{"success": true}'
      })

      const result = await queueManager.completeJob(mockJob.id, { success: true })

      expect(result).toBeDefined()
      expect(result?.status).toBe('completed')
      expect(jobRepository.update).toHaveBeenCalledWith(
        mockJob.id,
        expect.objectContaining({
          result: '{"success": true}'
        })
      )
    })

    it('should fail job with error', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.getById).mockResolvedValue(mockJob)
      vi.mocked(jobRepository.update).mockResolvedValue({
        ...mockJob,
        status: 'failed',
        error: 'Test error'
      })

      const result = await queueManager.failJob(mockJob.id, 'Test error')

      expect(result).toBeDefined()
      expect(result?.status).toBe('failed')
      expect(result?.error).toBe('Test error')
    })

    it('should cancel job', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.getById).mockResolvedValue(mockJob)
      vi.mocked(jobRepository.update).mockResolvedValue({
        ...mockJob,
        status: 'cancelled'
      })

      const result = await queueManager.cancelJob(mockJob.id)

      expect(result).toBeDefined()
      expect(result?.status).toBe('cancelled')
    })
  })

  describe('job tracking', () => {
    it('should track processing jobs', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.list).mockResolvedValue([mockJob])
      vi.mocked(jobRepository.update).mockResolvedValue({
        ...mockJob,
        status: 'running'
      })

      await queueManager.dequeue(1)

      const processingJobs = queueManager.getProcessingJobIds()
      expect(processingJobs).toContain(mockJob.id)
    })

    it('should clear processing jobs on completion', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.list).mockResolvedValue([mockJob])
      vi.mocked(jobRepository.getById).mockResolvedValue(mockJob)
      vi.mocked(jobRepository.update)
        .mockResolvedValueOnce({ ...mockJob, status: 'running' })
        .mockResolvedValueOnce({ ...mockJob, status: 'completed' })

      await queueManager.dequeue(1)
      await queueManager.completeJob(mockJob.id)

      const processingJobs = queueManager.getProcessingJobIds()
      expect(processingJobs).not.toContain(mockJob.id)
    })
  })

  describe('overdue job handling', () => {
    it('should handle overdue jobs', async () => {
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      vi.mocked(jobRepository.getStats).mockResolvedValue({
        total: 1,
        byStatus: { running: 1, pending: 0, completed: 0, failed: 0, cancelled: 0, retrying: 0 },
        byType: {},
        runningJobs: [
          {
            ...mockJob,
            status: 'running',
            startedAt: new Date(Date.now() - 400000) // 400 seconds ago
          }
        ]
      })
      vi.mocked(jobRepository.update).mockResolvedValue({
        ...mockJob,
        status: 'failed',
        error: 'Job timed out'
      })

      const handled = await queueManager.handleOverdueJobs()

      expect(handled).toBe(1)
      expect(jobRepository.update).toHaveBeenCalledWith(
        mockJob.id,
        expect.objectContaining({
          status: 'failed',
          error: expect.stringContaining('timed out')
        })
      )
    })
  })
})
