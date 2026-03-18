/**
 * Restart Recovery Service
 * 
 * Handles system restart recovery, ensuring job state consistency
 * and worker recovery after unexpected shutdowns.
 */

import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import type { Job } from '@/lib/db/schema'
import { jobRepository } from '@/lib/app/persistence/job-repository'
import { queueManager } from './job-state-machine'

export interface RecoveryState {
  sessionId: string
  startTime: Date
  lastHeartbeat: Date
  activeJobs: string[]
  workerStates: WorkerState[]
}

export interface WorkerState {
  workerId: string
  status: 'active' | 'inactive' | 'crashed'
  lastSeen: Date
  currentJobs: string[]
  metrics: any
}

export interface RecoveryReport {
  sessionId: string
  recoveryTime: Date
  previousSession: RecoveryState | null
  actions: RecoveryAction[]
  summary: {
    jobsRecovered: number
    jobsReset: number
    workersRecovered: number
    issuesFound: string[]
  }
}

export interface RecoveryAction {
  id: string
  type: 'job_reset' | 'job_recovery' | 'worker_recovery' | 'cleanup'
  description: string
  status: 'pending' | 'completed' | 'failed'
  details: any
  timestamp: Date
}

/**
 * Restart Recovery Service
 */
export class RestartRecoveryService {
  private recoveryStatePath: string
  private currentSession: RecoveryState | null = null
  private heartbeatInterval?: NodeJS.Timeout

  constructor(
    private dataDir: string = './data'
  ) {
    this.recoveryStatePath = join(dataDir, 'recovery-state.json')
    this.ensureDataDir()
  }

  /**
   * Initialize recovery service
   */
  async initialize(): Promise<RecoveryReport> {
    const sessionId = randomUUID()
    const startTime = new Date()
    
    // Load previous recovery state if exists
    const previousSession = this.loadRecoveryState()
    
    // Create new session
    this.currentSession = {
      sessionId,
      startTime,
      lastHeartbeat: startTime,
      activeJobs: [],
      workerStates: []
    }

    // Perform recovery actions
    const actions = await this.performRecovery(previousSession)
    
    // Save current state
    this.saveRecoveryState()
    
    // Start heartbeat
    this.startHeartbeat()

    // Generate recovery report
    const report: RecoveryReport = {
      sessionId,
      recoveryTime: startTime,
      previousSession,
      actions,
      summary: this.generateSummary(actions)
    }

    return report
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDir(): void {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true })
    }
  }

  /**
   * Load previous recovery state
   */
  private loadRecoveryState(): RecoveryState | null {
    try {
      if (!existsSync(this.recoveryStatePath)) {
        return null
      }

      const data = readFileSync(this.recoveryStatePath, 'utf-8')
      const state = JSON.parse(data) as RecoveryState
      
      // Convert date strings back to Date objects
      state.startTime = new Date(state.startTime)
      state.lastHeartbeat = new Date(state.lastHeartbeat)
      state.workerStates = state.workerStates.map((worker: any) => ({
        ...worker,
        lastSeen: new Date(worker.lastSeen)
      }))

      return state
    } catch (error) {
      console.error('Failed to load recovery state:', error)
      return null
    }
  }

  /**
   * Save current recovery state
   */
  private saveRecoveryState(): void {
    if (!this.currentSession) return

    try {
      const data = JSON.stringify(this.currentSession, null, 2)
      writeFileSync(this.recoveryStatePath, data, 'utf-8')
    } catch (error) {
      console.error('Failed to save recovery state:', error)
    }
  }

  /**
   * Perform recovery actions
   */
  private async performRecovery(previousSession: RecoveryState | null): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = []

    if (!previousSession) {
      // Clean startup - no recovery needed
      actions.push({
        id: randomUUID(),
        type: 'cleanup',
        description: 'Clean startup - no previous session to recover',
        status: 'completed',
        details: {},
        timestamp: new Date()
      })
      return actions
    }

    // Check for jobs that were running
    const runningJobs = await this.findRunningJobs(previousSession.activeJobs)
    
    for (const job of runningJobs) {
      const action = await this.recoverRunningJob(job)
      actions.push(action)
    }

    // Check for crashed workers
    const crashedWorkers = previousSession.workerStates.filter(
      worker => worker.status === 'crashed' || 
                (Date.now() - worker.lastSeen.getTime() > 60000) // 1 minute
    )

    for (const worker of crashedWorkers) {
      const action = await this.recoverWorker(worker)
      actions.push(action)
    }

    // Cleanup orphaned jobs
    const cleanupAction = await this.cleanupOrphanedJobs()
    actions.push(cleanupAction)

    return actions
  }

  /**
   * Find jobs that were running
   */
  private async findRunningJobs(jobIds: string[]): Promise<Job[]> {
    const jobs: Job[] = []
    
    for (const jobId of jobIds) {
      try {
        const job = await jobRepository.getById(jobId)
        if (job && job.status === 'running') {
          jobs.push(job)
        }
      } catch (error) {
        console.error(`Failed to check job ${jobId}:`, error)
      }
    }

    return jobs
  }

  /**
   * Recover a running job
   */
  private async recoverRunningJob(job: Job): Promise<RecoveryAction> {
    const actionId = randomUUID()
    
    try {
      // Check how long the job has been running
      const runningTime = Date.now() - job.startedAt!.getTime()
      const maxRuntime = 30 * 60 * 1000 // 30 minutes

      if (runningTime > maxRuntime) {
        // Job has been running too long, mark as failed
        await queueManager.failJob(job.id, 'Job recovered after restart - exceeded maximum runtime')
        
        return {
          id: actionId,
          type: 'job_reset',
          description: `Reset job ${job.id} - exceeded maximum runtime`,
          status: 'completed',
          details: { jobId: job.id, runningTime },
          timestamp: new Date()
        }
      } else {
        // Job can be recovered, reset to pending
        await jobRepository.update(job.id, {
          status: 'pending',
          startedAt: null,
          workerId: null
        })

        return {
          id: actionId,
          type: 'job_recovery',
          description: `Recovered job ${job.id} - reset to pending`,
          status: 'completed',
          details: { jobId: job.id, runningTime },
          timestamp: new Date()
        }
      }
    } catch (error) {
      return {
        id: actionId,
        type: 'job_recovery',
        description: `Failed to recover job ${job.id}`,
        status: 'failed',
        details: { jobId: job.id, error },
        timestamp: new Date()
      }
    }
  }

  /**
   * Recover a crashed worker
   */
  private async recoverWorker(worker: WorkerState): Promise<RecoveryAction> {
    const actionId = randomUUID()

    try {
      // Reset any jobs that were assigned to this worker
      for (const jobId of worker.currentJobs) {
        const job = await jobRepository.getById(jobId)
        if (job && job.status === 'running') {
          await jobRepository.update(jobId, {
            status: 'pending',
            startedAt: null,
            workerId: null
          })
        }
      }

      return {
        id: actionId,
        type: 'worker_recovery',
        description: `Recovered crashed worker ${worker.workerId}`,
        status: 'completed',
        details: { workerId: worker.workerId, jobsReset: worker.currentJobs.length },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        id: actionId,
        type: 'worker_recovery',
        description: `Failed to recover worker ${worker.workerId}`,
        status: 'failed',
        details: { workerId: worker.workerId, error },
        timestamp: new Date()
      }
    }
  }

  /**
   * Cleanup orphaned jobs
   */
  private async cleanupOrphanedJobs(): Promise<RecoveryAction> {
    const actionId = randomUUID()

    try {
      // Find jobs that are running but have no assigned worker
      const orphanedJobs = await jobRepository.list({ status: 'running' })
      let cleaned = 0

      for (const job of orphanedJobs) {
        if (!job.workerId) {
          await jobRepository.update(job.id, {
            status: 'pending',
            startedAt: null
          })
          cleaned++
        }
      }

      return {
        id: actionId,
        type: 'cleanup',
        description: `Cleaned up ${cleaned} orphaned jobs`,
        status: 'completed',
        details: { cleanedCount: cleaned },
        timestamp: new Date()
      }
    } catch (error) {
      return {
        id: actionId,
        type: 'cleanup',
        description: 'Failed to cleanup orphaned jobs',
        status: 'failed',
        details: { error },
        timestamp: new Date()
      }
    }
  }

  /**
   * Generate recovery summary
   */
  private generateSummary(actions: RecoveryAction[]) {
    const jobsRecovered = actions.filter(a => a.type === 'job_recovery' && a.status === 'completed').length
    const jobsReset = actions.filter(a => a.type === 'job_reset' && a.status === 'completed').length
    const workersRecovered = actions.filter(a => a.type === 'worker_recovery' && a.status === 'completed').length
    const issuesFound = actions.filter(a => a.status === 'failed').map(a => a.description)

    return {
      jobsRecovered,
      jobsReset,
      workersRecovered,
      issuesFound
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.currentSession) {
        this.currentSession.lastHeartbeat = new Date()
        this.saveRecoveryState()
      }
    }, 30000) // 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = undefined
    }
  }

  /**
   * Register active job
   */
  registerActiveJob(jobId: string): void {
    if (this.currentSession && !this.currentSession.activeJobs.includes(jobId)) {
      this.currentSession.activeJobs.push(jobId)
      this.saveRecoveryState()
    }
  }

  /**
   * Unregister active job
   */
  unregisterActiveJob(jobId: string): void {
    if (this.currentSession) {
      this.currentSession.activeJobs = this.currentSession.activeJobs.filter(id => id !== jobId)
      this.saveRecoveryState()
    }
  }

  /**
   * Register worker
   */
  registerWorker(workerId: string, metrics?: any): void {
    if (!this.currentSession) return

    const existingWorker = this.currentSession.workerStates.find(w => w.workerId === workerId)
    
    if (existingWorker) {
      existingWorker.status = 'active'
      existingWorker.lastSeen = new Date()
      existingWorker.metrics = metrics
    } else {
      this.currentSession.workerStates.push({
        workerId,
        status: 'active',
        lastSeen: new Date(),
        currentJobs: [],
        metrics
      })
    }

    this.saveRecoveryState()
  }

  /**
   * Unregister worker
   */
  unregisterWorker(workerId: string): void {
    if (!this.currentSession) return

    const worker = this.currentSession.workerStates.find(w => w.workerId === workerId)
    if (worker) {
      worker.status = 'crashed'
      worker.lastSeen = new Date()
      this.saveRecoveryState()
    }
  }

  /**
   * Get current session
   */
  getCurrentSession(): RecoveryState | null {
    return this.currentSession
  }

  /**
   * Shutdown recovery service
   */
  async shutdown(): Promise<void> {
    this.stopHeartbeat()
    
    if (this.currentSession) {
      // Mark all workers as crashed for next recovery
      this.currentSession.workerStates.forEach(worker => {
        worker.status = 'crashed'
      })
      this.saveRecoveryState()
    }
  }
}

// Export singleton instance
export const restartRecoveryService = new RestartRecoveryService()
