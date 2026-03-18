/**
 * Prompt Run Recorder Service
 * 
 * Captures prompt-run metadata from chat, RAG, and agent flows.
 * Provides automatic attribution to prompt versions and usage tracking.
 */

import { v4 as uuidv4 } from 'uuid'
import { promptRunRepository } from '@/lib/app/persistence/prompt-repository'
import { promptTemplateRepository } from '@/lib/app/persistence/prompt-repository'
import { experimentRepository } from '@/lib/app/persistence/experiment-repository'
import type { PromptRun, NewPromptRun } from '@/lib/db/schema'

export interface PromptRunContext {
  conversationId?: string
  messageId?: string
  modelProfileId?: string
  experimentId?: string
  source: 'chat' | 'rag' | 'agent' | 'evaluation'
  metadata?: Record<string, any>
}

export interface PromptRunInput {
  templateId?: string
  templateName?: string
  variables: Record<string, any>
  context: PromptRunContext
}

export interface PromptRunResult {
  output: string
  latencyMs: number
  tokenCount?: number
  error?: string
  metadata?: Record<string, any>
}

export class PromptRunRecorder {
  /**
   * Record a prompt run with automatic template resolution
   */
  async recordRun(input: PromptRunInput): Promise<PromptRun> {
    // Resolve template ID if not provided
    let templateId = input.templateId
    if (!templateId && input.templateName) {
      const activeTemplate = await promptTemplateRepository.getActiveVersion(input.templateName)
      if (activeTemplate) {
        templateId = activeTemplate.id
      }
    }

    if (!templateId) {
      throw new Error('Template ID or name must be provided')
    }

    // Create the prompt run
    const runData: NewPromptRun = {
      id: uuidv4(),
      templateId,
      variables: JSON.stringify(input.variables),
      status: 'pending',
      modelProfileId: input.context.modelProfileId,
      experimentId: input.context.experimentId,
      metadata: JSON.stringify({
        conversationId: input.context.conversationId,
        messageId: input.context.messageId,
        source: input.context.source,
        ...input.context.metadata
      }),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const run = await promptRunRepository.create(runData)

    // Increment template usage count
    await promptTemplateRepository.incrementUsage(templateId)

    return run
  }

  /**
   * Update a prompt run with results
   */
  async completeRun(runId: string, result: PromptRunResult): Promise<PromptRun> {
    const updateData = {
      status: result.error ? 'failed' : 'completed' as const,
      output: result.output,
      latencyMs: result.latencyMs,
      tokenCount: result.tokenCount,
      error: result.error,
      updatedAt: new Date()
    }

    return await promptRunRepository.update(runId, updateData)
  }

  /**
   * Record a prompt run from chat flow
   */
  async recordChatRun(
    templateName: string,
    variables: Record<string, any>,
    conversationId: string,
    messageId: string,
    modelProfileId: string
  ): Promise<PromptRun> {
    return await this.recordRun({
      templateName,
      variables,
      context: {
        conversationId,
        messageId,
        modelProfileId,
        source: 'chat'
      }
    })
  }

  /**
   * Record a prompt run from RAG flow
   */
  async recordRagRun(
    templateName: string,
    variables: Record<string, any>,
    modelProfileId: string,
    retrievalContext: Record<string, any>
  ): Promise<PromptRun> {
    return await this.recordRun({
      templateName,
      variables,
      context: {
        modelProfileId,
        source: 'rag',
        metadata: { retrievalContext }
      }
    })
  }

  /**
   * Record a prompt run from agent flow
   */
  async recordAgentRun(
    templateName: string,
    variables: Record<string, any>,
    modelProfileId: string,
    agentId: string,
    stepNumber: number
  ): Promise<PromptRun> {
    return await this.recordRun({
      templateName,
      variables,
      context: {
        modelProfileId,
        source: 'agent',
        metadata: { agentId, stepNumber }
      }
    })
  }

  /**
   * Record a prompt run from evaluation
   */
  async recordEvaluationRun(
    templateId: string,
    variables: Record<string, any>,
    experimentId: string,
    testCaseId: string
  ): Promise<PromptRun> {
    return await this.recordRun({
      templateId,
      variables,
      context: {
        experimentId,
        source: 'evaluation',
        metadata: { testCaseId }
      }
    })
  }

  /**
   * Get runs for a conversation
   */
  async getConversationRuns(conversationId: string): Promise<PromptRun[]> {
    // This would need to be added to the repository
    // For now, we'll get all runs and filter
    const allRuns = await promptRunRepository.list({ limit: 1000 })
    return allRuns.filter(run => {
      const metadata = run.metadata ? JSON.parse(run.metadata) : {}
      return metadata.conversationId === conversationId
    })
  }

  /**
   * Get runs for an experiment
   */
  async getExperimentRuns(experimentId: string): Promise<PromptRun[]> {
    return await experimentRepository.getRuns(experimentId)
  }

  /**
   * Get usage statistics for templates
   */
  async getTemplateUsageStats(templateName?: string, days: number = 30): Promise<Array<{
    templateId: string
    templateName: string
    runCount: number
    successCount: number
    averageLatency: number
    averageTokens: number
    lastUsed: Date | null
  }>> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get all templates
    const templates = templateName 
      ? [await promptTemplateRepository.getActiveVersion(templateName)].filter(Boolean)
      : await promptTemplateRepository.list({ limit: 100 })

    const stats = []

    for (const template of templates) {
      if (!template) continue

      // Get runs for this template
      const runs = await promptRunRepository.getByTemplateId(template.id, 1000)
      
      // Filter by date
      const recentRuns = runs.filter(run => 
        new Date(run.createdAt) > cutoffDate
      )

      const completedRuns = recentRuns.filter(run => run.status === 'completed')
      const successCount = completedRuns.length

      const averageLatency = successCount > 0
        ? completedRuns.reduce((sum, run) => sum + (run.latencyMs || 0), 0) / successCount
        : 0

      const averageTokens = successCount > 0
        ? completedRuns.reduce((sum, run) => sum + (run.tokenCount || 0), 0) / successCount
        : 0

      const lastUsed = recentRuns.length > 0
        ? new Date(Math.max(...recentRuns.map(run => new Date(run.createdAt).getTime())))
        : null

      stats.push({
        templateId: template.id,
        templateName: template.name,
        runCount: recentRuns.length,
        successCount,
        averageLatency,
        averageTokens,
        lastUsed
      })
    }

    return stats.sort((a, b) => b.runCount - a.runCount)
  }

  /**
   * Get performance trends for a template
   */
  async getTemplatePerformanceTrends(
    templateName: string,
    days: number = 30
  ): Promise<Array<{
    date: string
    runCount: number
    successRate: number
    averageLatency: number
    averageTokens: number
  }>> {
    const template = await promptTemplateRepository.getActiveVersion(templateName)
    if (!template) {
      return []
    }

    const runs = await promptRunRepository.getByTemplateId(template.id, 1000)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const recentRuns = runs.filter(run => new Date(run.createdAt) > cutoffDate)

    // Group by date
    const dailyStats = new Map<string, {
      runCount: number
      successCount: number
      totalLatency: number
      totalTokens: number
    }>()

    for (const run of recentRuns) {
      const date = new Date(run.createdAt).toISOString().split('T')[0]
      
      if (!dailyStats.has(date)) {
        dailyStats.set(date, {
          runCount: 0,
          successCount: 0,
          totalLatency: 0,
          totalTokens: 0
        })
      }

      const stats = dailyStats.get(date)!
      stats.runCount++
      
      if (run.status === 'completed') {
        stats.successCount++
        stats.totalLatency += run.latencyMs || 0
        stats.totalTokens += run.tokenCount || 0
      }
    }

    // Convert to array and calculate averages
    return Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        runCount: stats.runCount,
        successRate: stats.runCount > 0 ? stats.successCount / stats.runCount : 0,
        averageLatency: stats.successCount > 0 ? stats.totalLatency / stats.successCount : 0,
        averageTokens: stats.successCount > 0 ? stats.totalTokens / stats.successCount : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Cleanup old runs
   */
  async cleanup(olderThanDays: number = 90): Promise<number> {
    const olderThanMs = olderThanDays * 24 * 60 * 60 * 1000
    return await promptRunRepository.cleanup(olderThanMs)
  }
}

// Singleton instance
export const promptRunRecorder = new PromptRunRecorder()
