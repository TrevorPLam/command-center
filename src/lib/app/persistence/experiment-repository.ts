/**
 * Experiment Repository
 * 
 * Repository helpers for experiment management and evaluation tracking.
 * Provides typed CRUD operations with experiment grouping and result tracking.
 */

import { eq, and, desc, like, count, sql, inArray } from 'drizzle-orm'
import { db, withTransaction } from '@/lib/db/client'
import { experiments, promptRuns, promptTemplates } from '@/lib/db/schema'
import type { 
  Experiment, 
  NewExperiment,
  PromptRun,
  PromptTemplate
} from '@/lib/db/schema'

export type ExperimentStatus = 'draft' | 'running' | 'completed' | 'failed' | 'archived'

export interface ExperimentCreateInput {
  name: string
  description?: string
  status?: ExperimentStatus
  config?: Record<string, any>
  metadata?: Record<string, any>
}

export interface ExperimentUpdateInput {
  name?: string
  description?: string
  status?: ExperimentStatus
  config?: Record<string, any>
  metadata?: Record<string, any>
}

export interface ExperimentRunInput {
  templateId: string
  variables: Record<string, any>
  modelProfileId?: string
  metadata?: Record<string, any>
}

export interface ExperimentSummary {
  experiment: Experiment
  runCount: number
  successCount: number
  averageLatency: number
  lastRunAt: Date | null
  bestPerformingTemplate: string | null
}

export class ExperimentRepository {
  /**
   * Create a new experiment
   */
  async create(data: NewExperiment): Promise<Experiment> {
    const database = await db
    const [experiment] = await database
      .insert(experiments)
      .values(data)
      .returning()

    return experiment
  }

  /**
   * Get an experiment by ID
   */
  async getById(id: string): Promise<Experiment | null> {
    const database = await db
    const [experiment] = await database
      .select()
      .from(experiments)
      .where(eq(experiments.id, id))
      .limit(1)

    return experiment || null
  }

  /**
   * Get an experiment by name
   */
  async getByName(name: string): Promise<Experiment | null> {
    const database = await db
    const [experiment] = await database
      .select()
      .from(experiments)
      .where(eq(experiments.name, name))
      .limit(1)

    return experiment || null
  }

  /**
   * List experiments with optional filtering
   */
  async list(options: {
    status?: ExperimentStatus
    limit?: number
    offset?: number
    search?: string
  } = {}): Promise<Experiment[]> {
    const database = await db
    let query = database.select().from(experiments)

    // Apply filters
    const conditions = []
    if (options.status) {
      conditions.push(eq(experiments.status, options.status))
    }
    if (options.search) {
      conditions.push(
        sql`(${experiments.name} LIKE ${`%${options.search}%`} OR ${experiments.description} LIKE ${`%${options.search}%`})`
      )
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions))
    }

    // Apply ordering and pagination
    query = query.orderBy(desc(experiments.createdAt))

    if (options.limit) {
      query = query.limit(options.limit)
    }
    if (options.offset) {
      query = query.offset(options.offset)
    }

    return await query
  }

  /**
   * Update an experiment
   */
  async update(id: string, data: Partial<ExperimentUpdateInput>): Promise<Experiment> {
    const database = await db
    const [experiment] = await database
      .update(experiments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(experiments.id, id))
      .returning()

    return experiment
  }

  /**
   * Delete an experiment
   */
  async delete(id: string): Promise<void> {
    const database = await db
    await database.delete(experiments).where(eq(experiments.id, id))
  }

  /**
   * Get experiment summaries with run statistics
   */
  async getSummaries(): Promise<ExperimentSummary[]> {
    const database = await db

    // Get experiment run statistics
    const runStats = await database
      .select({
        experimentId: promptRuns.experimentId,
        runCount: count(promptRuns.id),
        successCount: count(sql`CASE WHEN ${promptRuns.status} = 'completed' THEN 1 END`),
        averageLatency: sql`AVG(${promptRuns.latencyMs})`,
        lastRunAt: sql`MAX(${promptRuns.createdAt})`,
      })
      .from(promptRuns)
      .where(promptRuns.experimentId.isNotNull())
      .groupBy(promptRuns.experimentId)

    // Get experiments
    const experimentsList = await this.list()

    // Combine data
    const summaries: ExperimentSummary[] = []
    for (const experiment of experimentsList) {
      const stats = runStats.find(s => s.experimentId === experiment.id)
      
      summaries.push({
        experiment,
        runCount: stats?.runCount || 0,
        successCount: stats?.successCount || 0,
        averageLatency: stats?.averageLatency || 0,
        lastRunAt: stats?.lastRunAt ? new Date(stats.lastRunAt as number) : null,
        bestPerformingTemplate: null // TODO: Calculate from run results
      })
    }

    return summaries
  }

  /**
   * Add a prompt run to an experiment
   */
  async addRun(experimentId: string, runData: ExperimentRunInput): Promise<PromptRun> {
    return await withTransaction(async (tx) => {
      // Create the prompt run
      const [run] = await tx
        .insert(promptRuns)
        .values({
          ...runData,
          experimentId,
          status: 'pending',
          createdAt: new Date()
        })
        .returning()

      return run
    })
  }

  /**
   * Get runs for an experiment
   */
  async getRuns(experimentId: string, options: {
    limit?: number
    offset?: number
    status?: string
  } = {}): Promise<PromptRun[]> {
    const database = await db
    let query = database
      .select({
        ...promptRuns,
        templateName: promptTemplates.name
      })
      .from(promptRuns)
      .leftJoin(promptTemplates, eq(promptRuns.templateId, promptTemplates.id))
      .where(eq(promptRuns.experimentId, experimentId))

    if (options.status) {
      query = query.where(and(
        eq(promptRuns.experimentId, experimentId),
        eq(promptRuns.status, options.status)
      ))
    }

    query = query.orderBy(desc(promptRuns.createdAt))

    if (options.limit) {
      query = query.limit(options.limit)
    }
    if (options.offset) {
      query = query.offset(options.offset)
    }

    return await query
  }

  /**
   * Update run status and results
   */
  async updateRun(id: string, data: {
    status?: string
    output?: string
    latencyMs?: number
    tokenCount?: number
    error?: string
    metadata?: Record<string, any>
  }): Promise<PromptRun> {
    const database = await db
    const [run] = await database
      .update(promptRuns)
      .set(data)
      .where(eq(promptRuns.id, id))
      .returning()

    return run
  }

  /**
   * Get experiment comparison data
   */
  async compareExperiments(experimentIds: string[]): Promise<Record<string, ExperimentSummary>> {
    const summaries = await this.getSummaries()
    const filtered = summaries.filter(s => experimentIds.includes(s.experiment.id))
    
    return filtered.reduce((acc, summary) => {
      acc[summary.experiment.id] = summary
      return acc
    }, {} as Record<string, ExperimentSummary>)
  }

  /**
   * Archive old experiments
   */
  async archiveOldExperiments(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const database = await db
    const result = await database
      .update(experiments)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(
        eq(experiments.status, 'completed'),
        sql`${experiments.updatedAt} < ${cutoffDate.getTime()}`
      ))

    return result.changes || 0
  }
}

// Singleton instance
export const experimentRepository = new ExperimentRepository()
