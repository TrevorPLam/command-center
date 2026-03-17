/**
 * Job Repository
 * 
 * Repository helpers for background job management.
 * Provides typed CRUD operations with status tracking.
 */

import { eq, and, desc, inArray } from 'drizzle-orm'
import { db, withTransaction } from '@/lib/db/client'
import { jobs, toolRuns } from '@/lib/db/schema'
import type { Job, NewJob, ToolRun, NewToolRun } from '@/lib/db/schema'

export class JobRepository {
  /**
   * Create a new job
   */
  async create(data: NewJob): Promise<Job> {
    const [job] = await db
      .insert(jobs)
      .values(data)
      .returning()

    return job
  }

  /**
   * Get a job by ID with optional tool runs
   */
  async getById(id: string, includeToolRuns = false): Promise<Job | null> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1)

    if (!job) return null

    if (includeToolRuns) {
      const toolRuns = await db
        .select()
        .from(toolRuns)
        .where(eq(toolRuns.jobId, id))
        .orderBy(toolRuns.createdAt)

      return { ...job, toolRuns } as Job & { toolRuns: ToolRun[] }
    }

    return job
  }

  /**
   * List jobs with filtering and pagination
   */
  async list(options: {
    limit?: number
    offset?: number
    status?: Job['status']
    type?: Job['type']
  } = {}): Promise<Job[]> {
    const { limit = 50, offset = 0, status, type } = options

    let whereConditions = []
    
    if (status) {
      whereConditions.push(eq(jobs.status, status))
    }
    
    if (type) {
      whereConditions.push(eq(jobs.type, type))
    }

    const whereClause = whereConditions.length > 0 
      ? and(...whereConditions) 
      : undefined

    return await db
      .select()
      .from(jobs)
      .where(whereClause)
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset)
  }

  /**
   * Update a job
   */
  async update(id: string, data: Partial<NewJob>): Promise<Job | null> {
    const [job] = await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, id))
      .returning()

    return job || null
  }

  /**
   * Update job status and optionally progress
   */
  async updateStatus(
    id: string, 
    status: Job['status'], 
    progress?: number,
    result?: any,
    error?: string
  ): Promise<Job | null> {
    const updateData: Partial<NewJob> = {
      status,
      updatedAt: new Date()
    }

    if (progress !== undefined) {
      updateData.progress = progress
    }

    if (result !== undefined) {
      updateData.result = typeof result === 'string' ? result : JSON.stringify(result)
    }

    if (error) {
      updateData.error = error
    }

    // Set timestamps based on status
    if (status === 'running' && !updateData.startedAt) {
      updateData.startedAt = new Date()
    } else if (['completed', 'failed', 'cancelled'].includes(status)) {
      updateData.completedAt = new Date()
      if (progress === undefined) {
        updateData.progress = status === 'completed' ? 1.0 : 0.0
      }
    }

    return await this.update(id, updateData)
  }

  /**
   * Cancel a job
   */
  async cancel(id: string): Promise<Job | null> {
    return await this.updateStatus(id, 'cancelled')
  }

  /**
   * Delete a job and its tool runs (transactional)
   */
  async delete(id: string): Promise<boolean> {
    return await withTransaction(async (tx) => {
      // Delete tool runs first (foreign key constraint)
      await tx
        .delete(toolRuns)
        .where(eq(toolRuns.jobId, id))

      // Delete job
      const result = await tx
        .delete(jobs)
        .where(eq(jobs.id, id))

      return result.changes > 0
    })
  }

  /**
   * Get job statistics
   */
  async getStats(): Promise<{
    total: number
    byStatus: Record<Job['status'], number>
    byType: Record<string, number>
    runningJobs: Job[]
  }> {
    const [allJobs, statusCounts, typeCounts] = await Promise.all([
      db.select().from(jobs).where(eq(jobs.status, 'running')),
      db.select({ 
        status: jobs.status, 
        count: jobs.id 
      }).from(jobs).groupBy(jobs.status),
      db.select({ 
        type: jobs.type, 
        count: jobs.id 
      }).from(jobs).groupBy(jobs.type)
    ])

    const byStatus = statusCounts.reduce((acc, row) => {
      acc[row.status as Job['status']] = Number(row.count)
      return acc
    }, {} as Record<Job['status'], number>)

    const byType = typeCounts.reduce((acc, row) => {
      acc[row.type] = Number(row.count)
      return acc
    }, {} as Record<string, number>)

    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)

    return {
      total,
      byStatus,
      byType,
      runningJobs: allJobs
    }
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanup(olderThan: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThan)
    
    const result = await db
      .delete(jobs)
      .where(
        and(
          inArray(jobs.status, ['completed', 'failed', 'cancelled']),
          jobs.completedAt.lt(cutoffDate)
        )
      )

    return result.changes
  }
}

export class ToolRunRepository {
  /**
   * Create a new tool run
   */
  async create(data: NewToolRun): Promise<ToolRun> {
    const [toolRun] = await db
      .insert(toolRuns)
      .values(data)
      .returning()

    return toolRun
  }

  /**
   * Get a tool run by ID
   */
  async getById(id: string): Promise<ToolRun | null> {
    const [toolRun] = await db
      .select()
      .from(toolRuns)
      .where(eq(toolRuns.id, id))
      .limit(1)

    return toolRun || null
  }

  /**
   * List tool runs for a job
   */
  async getByJobId(jobId: string): Promise<ToolRun[]> {
    return await db
      .select()
      .from(toolRuns)
      .where(eq(toolRuns.jobId, jobId))
      .orderBy(toolRuns.createdAt)
  }

  /**
   * Update a tool run
   */
  async update(id: string, data: Partial<NewToolRun>): Promise<ToolRun | null> {
    const [toolRun] = await db
      .update(toolRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(toolRuns.id, id))
      .returning()

    return toolRun || null
  }

  /**
   * Update tool run status and result
   */
  async updateStatus(
    id: string,
    status: ToolRun['status'],
    result?: any,
    error?: string,
    durationMs?: number
  ): Promise<ToolRun | null> {
    const updateData: Partial<NewToolRun> = {
      status,
      updatedAt: new Date()
    }

    if (result !== undefined) {
      updateData.output = typeof result === 'string' ? result : JSON.stringify(result)
    }

    if (error) {
      updateData.error = error
    }

    if (durationMs !== undefined) {
      updateData.durationMs = durationMs
    }

    return await this.update(id, updateData)
  }

  /**
   * Get tool run statistics
   */
  async getStats(): Promise<{
    total: number
    byStatus: Record<ToolRun['status'], number>
    byTool: Record<string, number>
    averageDuration: number
  }> {
    const [statusCounts, toolCounts, avgDuration] = await Promise.all([
      db.select({ 
        status: toolRuns.status, 
        count: toolRuns.id 
      }).from(toolRuns).groupBy(toolRuns.status),
      db.select({ 
        toolName: toolRuns.toolName, 
        count: toolRuns.id 
      }).from(toolRuns).groupBy(toolRuns.toolName),
      db.select({ 
        avg: toolRuns.durationMs 
      }).from(toolRuns).where(eq(toolRuns.status, 'completed'))
    ])

    const byStatus = statusCounts.reduce((acc, row) => {
      acc[row.status as ToolRun['status']] = Number(row.count)
      return acc
    }, {} as Record<ToolRun['status'], number>)

    const byTool = toolCounts.reduce((acc, row) => {
      acc[row.toolName] = Number(row.count)
      return acc
    }, {} as Record<string, number>)

    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)
    const averageDuration = avgDuration[0]?.avg ? Number(avgDuration[0].avg) : 0

    return {
      total,
      byStatus,
      byTool,
      averageDuration
    }
  }
}

// Export singleton instances
export const jobRepository = new JobRepository()
export const toolRunRepository = new ToolRunRepository()
