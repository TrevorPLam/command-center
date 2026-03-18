/**
 * Job Worker Service
 * 
 * Background worker process for executing queued jobs with proper
 * concurrency control, error handling, and graceful shutdown.
 */

import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import type { Job } from '@/lib/db/schema'
import { queueManager } from '@/lib/app/services/job-state-machine'
import { restartRecoveryService } from '@/lib/app/services/restart-recovery'
import { jobRepository } from '@/lib/app/persistence/job-repository'

export interface WorkerConfig {
  workerId: string
  maxConcurrentJobs: number
  pollIntervalMs: number
  heartbeatIntervalMs: number
  jobTimeoutMs: number
  enableMetrics: boolean
}

export interface WorkerMetrics {
  workerId: string
  startTime: Date
  jobsProcessed: number
  jobsSucceeded: number
  jobsFailed: number
  jobsTimedOut: number
  averageProcessingTimeMs: number
  currentConcurrency: number
  lastActivity: Date
}

export interface JobProcessor {
  canProcess(job: Job): boolean
  process(job: Job, signal: AbortSignal): Promise<any>
}

/**
 * Job Worker Class
 * 
 * Manages the execution of queued jobs with proper lifecycle management.
 */
export class JobWorker extends EventEmitter {
  private config: WorkerConfig
  private isRunning: boolean = false
  private isShuttingDown: boolean = false
  private currentJobs: Map<string, { job: Job; startTime: Date; controller: AbortController }> = new Map()
  private processors: Map<string, JobProcessor> = new Map()
  private metrics: WorkerMetrics
  private pollTimer?: NodeJS.Timeout
  private heartbeatTimer?: NodeJS.Timeout

  constructor(config: Partial<WorkerConfig> = {}) {
    super()

    this.config = {
      workerId: config.workerId || `worker-${randomUUID()}`,
      maxConcurrentJobs: config.maxConcurrentJobs || 3,
      pollIntervalMs: config.pollIntervalMs || 5000,
      heartbeatIntervalMs: config.heartbeatIntervalMs || 30000,
      jobTimeoutMs: config.jobTimeoutMs || 300000, // 5 minutes
      enableMetrics: config.enableMetrics !== false,
      ...config
    }

    this.metrics = {
      workerId: this.config.workerId,
      startTime: new Date(),
      jobsProcessed: 0,
      jobsSucceeded: 0,
      jobsFailed: 0,
      jobsTimedOut: 0,
      averageProcessingTimeMs: 0,
      currentConcurrency: 0,
      lastActivity: new Date()
    }
  }

  /**
   * Register a job processor for a specific job type
   */
  registerProcessor(jobType: string, processor: JobProcessor): void {
    this.processors.set(jobType, processor)
    this.emit('processor-registered', { jobType, processor })
  }

  /**
   * Get processor for a job type
   */
  private getProcessor(job: Job): JobProcessor | null {
    return this.processors.get(job.type) || null
  }

  /**
   * Check if worker can process more jobs
   */
  private canProcessMore(): boolean {
    return this.currentJobs.size < this.config.maxConcurrentJobs && !this.isShuttingDown
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Worker is already running')
    }

    this.isRunning = true
    this.isShuttingDown = false

    // Register with recovery service
    restartRecoveryService.registerWorker(this.config.workerId, this.metrics)

    this.emit('worker-started', { workerId: this.config.workerId })

    // Start polling for jobs
    this.pollTimer = setInterval(() => {
      this.pollForJobs().catch(error => {
        this.emit('poll-error', error)
      })
    }, this.config.pollIntervalMs)

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat().catch(error => {
        this.emit('heartbeat-error', error)
      })
    }, this.config.heartbeatIntervalMs)

    // Initial poll
    await this.pollForJobs()
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning || this.isShuttingDown) {
      return
    }

    this.isShuttingDown = true

    // Unregister from recovery service
    restartRecoveryService.unregisterWorker(this.config.workerId)

    this.emit('worker-stopping', { workerId: this.config.workerId })

    // Clear timers
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }

    // Wait for current jobs to finish or timeout
    const timeout = setTimeout(() => {
      // Force abort remaining jobs
      for (const [jobId, jobData] of this.currentJobs) {
        jobData.controller.abort()
      }
    }, this.config.jobTimeoutMs)

    // Wait for all jobs to complete
    while (this.currentJobs.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    clearTimeout(timeout)
    this.isRunning = false
    this.emit('worker-stopped', { workerId: this.config.workerId, metrics: this.metrics })
  }

  /**
   * Poll for available jobs
   */
  private async pollForJobs(): Promise<void> {
    if (!this.canProcessMore()) {
      return
    }

    try {
      // Handle overdue jobs first
      await this.handleOverdueJobs()

      // Get available jobs
      const jobs = await queueManager.dequeue(this.config.maxConcurrentJobs - this.currentJobs.size)

      // Process each job
      for (const job of jobs) {
        if (!this.canProcessMore()) {
          break
        }

        this.processJob(job).catch(error => {
          this.emit('job-process-error', { job, error })
        })
      }
    } catch (error) {
      this.emit('poll-error', error)
    }
  }

  /**
   * Handle overdue jobs
   */
  private async handleOverdueJobs(): Promise<void> {
    try {
      const handled = await queueManager.handleOverdueJobs()
      if (handled > 0) {
        this.emit('overdue-jobs-handled', { count: handled })
      }
    } catch (error) {
      this.emit('overdue-jobs-error', error)
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    const processor = this.getProcessor(job)
    if (!processor) {
      await queueManager.failJob(job.id, `No processor found for job type: ${job.type}`)
      this.metrics.jobsFailed++
      return
    }

    if (!processor.canProcess(job)) {
      // Requeue job for later
      await queueManager.failJob(job.id, 'Processor cannot handle this job currently')
      this.metrics.jobsFailed++
      return
    }

    const controller = new AbortController()
    const startTime = new Date()

    // Track the job
    this.currentJobs.set(job.id, { job, startTime, controller })
    this.metrics.currentConcurrency = this.currentJobs.size
    this.metrics.lastActivity = new Date()

    // Register with recovery service
    restartRecoveryService.registerActiveJob(job.id)

    this.emit('job-started', { job, workerId: this.config.workerId })

    try {
      // Process the job
      const result = await processor.process(job, controller.signal)
      
      // Mark as successful
      await queueManager.completeJob(job.id, result)
      
      const processingTime = Date.now() - startTime.getTime()
      this.updateMetrics(processingTime, true)
      
      this.emit('job-completed', { job, result, processingTime })
    } catch (error) {
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await queueManager.failJob(job.id, errorMessage)
      
      const processingTime = Date.now() - startTime.getTime()
      this.updateMetrics(processingTime, false)
      
      this.emit('job-failed', { job, error, processingTime })
    } finally {
      // Clean up
      this.currentJobs.delete(job.id)
      this.metrics.currentConcurrency = this.currentJobs.size
      
      // Unregister from recovery service
      restartRecoveryService.unregisterActiveJob(job.id)
    }
  }

  /**
   * Update worker metrics
   */
  private updateMetrics(processingTimeMs: number, success: boolean): void {
    this.metrics.jobsProcessed++
    
    if (success) {
      this.metrics.jobsSucceeded++
    } else {
      this.metrics.jobsFailed++
    }

    // Update average processing time
    const totalTime = this.metrics.averageProcessingTimeMs * (this.metrics.jobsProcessed - 1) + processingTimeMs
    this.metrics.averageProcessingTimeMs = totalTime / this.metrics.jobsProcessed
  }

  /**
   * Send heartbeat to update worker status
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      // Update any jobs that are still running
      for (const [jobId, jobData] of this.currentJobs) {
        const elapsed = Date.now() - jobData.startTime.getTime()
        if (elapsed > this.config.jobTimeoutMs) {
          // Job has timed out
          jobData.controller.abort()
          await queueManager.failJob(jobId, `Job timed out after ${elapsed}ms`)
          this.metrics.jobsTimedOut++
          this.currentJobs.delete(jobId)
        }
      }

      this.metrics.currentConcurrency = this.currentJobs.size
      this.emit('heartbeat', { metrics: this.metrics })
    } catch (error) {
      this.emit('heartbeat-error', error)
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): WorkerMetrics {
    return { ...this.metrics }
  }

  /**
   * Get currently processing jobs
   */
  getCurrentJobs(): Array<{ job: Job; startTime: Date; elapsedMs: number }> {
    return Array.from(this.currentJobs.entries()).map(([jobId, jobData]) => ({
      job: jobData.job,
      startTime: jobData.startTime,
      elapsedMs: Date.now() - jobData.startTime.getTime()
    }))
  }

  /**
   * Force stop a specific job
   */
  async stopJob(jobId: string): Promise<boolean> {
    const jobData = this.currentJobs.get(jobId)
    if (!jobData) {
      return false
    }

    jobData.controller.abort()
    await queueManager.failJob(jobId, 'Job was manually stopped')
    this.currentJobs.delete(jobId)
    this.metrics.currentConcurrency = this.currentJobs.size

    this.emit('job-stopped', { jobId, workerId: this.config.workerId })
    return true
  }
}

/**
 * Default Agent Job Processor
 * 
 * Handles agent_run job types with the agent runner.
 */
export class AgentJobProcessor implements JobProcessor {
  canProcess(job: Job): boolean {
    return job.type === 'agent_run'
  }

  async process(job: Job, signal: AbortSignal): Promise<any> {
    const { runAgent } = await import('./agent-runner')
    
    // Run the agent
    const result = await runAgent(job, signal)
    
    if (signal.aborted) {
      throw new Error('Agent job was aborted')
    }

    return {
      type: 'agent_result',
      success: result.success,
      finalResponse: result.finalResponse,
      turns: result.turns.length,
      steps: result.totalSteps,
      tokensUsed: result.totalTokensUsed,
      toolsUsed: result.toolsUsed,
      durationMs: result.totalDurationMs,
      aborted: result.aborted,
      error: result.error
    }
  }
}

/**
 * Worker Manager
 * 
 * Manages multiple worker instances and provides a unified interface.
 */
export class WorkerManager {
  private workers: Map<string, JobWorker> = new Map()
  private config: Partial<WorkerConfig>

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = config
  }

  /**
   * Create and start a new worker
   */
  async createWorker(workerId?: string): Promise<JobWorker> {
    const id = workerId || `worker-${randomUUID()}`
    
    if (this.workers.has(id)) {
      throw new Error(`Worker ${id} already exists`)
    }

    const worker = new JobWorker({ ...this.config, workerId: id })
    
    // Register default processors
    worker.registerProcessor('agent_run', new AgentJobProcessor())
    
    // Set up event handlers
    worker.on('error', (error) => {
      console.error(`Worker ${id} error:`, error)
    })

    await worker.start()
    this.workers.set(id, worker)

    return worker
  }

  /**
   * Stop a worker
   */
  async stopWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId)
    if (!worker) {
      return
    }

    await worker.stop()
    this.workers.delete(workerId)
  }

  /**
   * Stop all workers
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.workers.keys()).map(id => 
      this.stopWorker(id)
    )
    
    await Promise.all(stopPromises)
  }

  /**
   * Get all workers
   */
  getWorkers(): JobWorker[] {
    return Array.from(this.workers.values())
  }

  /**
   * Get worker by ID
   */
  getWorker(workerId: string): JobWorker | undefined {
    return this.workers.get(workerId)
  }

  /**
   * Get aggregate metrics
   */
  getAggregateMetrics(): WorkerMetrics[] {
    return this.workers.values().map(worker => worker.getMetrics())
  }
}

// Export singleton worker manager
export const workerManager = new WorkerManager()
