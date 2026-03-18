/**
 * Reasoning Trace Repository
 * 
 * Handles persistence and management of thinking/reasoning traces
 * with proper CRUD operations, versioning, and analysis capabilities.
 */

import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { messages, Message } from '../db/schema'
import { RuntimeError, RuntimeErrorErrorCode } from '../runtime/errors'

export interface ReasoningTrace {
  id: string
  messageId: string
  conversationId: string
  traceContent: string
  reasoningSteps: ReasoningStep[]
  metadata: ReasoningMetadata
  createdAt: Date
  updatedAt: Date
}

export interface ReasoningStep {
  id: string
  type: 'thought' | 'analysis' | 'planning' | 'reflection' | 'correction'
  content: string
  confidence: number
  timestamp: Date
  dependencies?: string[] // IDs of steps this depends on
}

export interface ReasoningMetadata {
  modelId: string
  modelVersion?: string
  taskType: string
  complexity: 'low' | 'medium' | 'high'
  confidence: number
  tokenCount: number
  processingTimeMs: number
  temperature?: number
  maxTokens?: number
  isComplete: boolean
  hasCorrections: boolean
  stepCount: number
}

export interface ReasoningTraceCreateInput {
  messageId: string
  conversationId: string
  traceContent: string
  reasoningSteps: Omit<ReasoningStep, 'id' | 'timestamp'>[]
  metadata: Omit<ReasoningMetadata, 'hasCorrections' | 'stepCount'>
}

export interface ReasoningTraceUpdateInput {
  traceContent?: string
  reasoningSteps?: Partial<ReasoningStep>[]
  metadata?: Partial<ReasoningMetadata>
  isComplete?: boolean
}

/**
 * Repository class for reasoning trace operations
 */
export class ReasoningTraceRepository {
  /**
   * Create a new reasoning trace
   */
  async create(input: ReasoningTraceCreateInput): Promise<ReasoningTrace> {
    try {
      // Verify the message exists
      const message = await this.findMessageById(input.messageId)
      if (!message) {
        throw new RuntimeError(
          'message_not_found',
          `Message not found: ${input.messageId}`
        )
      }

      // Generate IDs and timestamps for reasoning steps
      const reasoningSteps: ReasoningStep[] = input.reasoningSteps.map((step, index) => ({
        ...step,
        id: `rs_${crypto.randomUUID()}`,
        timestamp: new Date(Date.now() + index * 100), // Stagger timestamps
      }))

      // Calculate derived metadata
      const metadata: ReasoningMetadata = {
        ...input.metadata,
        hasCorrections: reasoningSteps.some(step => step.type === 'correction'),
        stepCount: reasoningSteps.length,
      }

      const traceData = {
        id: `rt_${crypto.randomUUID()}`,
        messageId: input.messageId,
        conversationId: input.conversationId,
        traceContent: input.traceContent,
        reasoningSteps: JSON.stringify(reasoningSteps),
        metadata: JSON.stringify(metadata),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Store trace in message metadata (since we don't have a separate table)
      const updatedMessage = await db
        .update(messages)
        .set({
          metadata: JSON.stringify({
            ...(message.metadata ? JSON.parse(message.metadata) : {}),
            reasoningTrace: traceData,
          })
        })
        .where(eq(messages.id, input.messageId))
        .returning()

      if (!updatedMessage || updatedMessage.length === 0) {
        throw new RuntimeError(
          'reasoning_trace_create_failed',
          'Failed to create reasoning trace'
        )
      }

      return this.mapFromMessage(updatedMessage[0])
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      throw new RuntimeError(
        'reasoning_trace_create_failed',
        `Failed to create reasoning trace: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get reasoning trace by message ID
   */
  async findByMessageId(messageId: string): Promise<ReasoningTrace | null> {
    try {
      const message = await this.findMessageById(messageId)
      if (!message || !message.metadata) {
        return null
      }

      const metadata = JSON.parse(message.metadata)
      if (!metadata.reasoningTrace) {
        return null
      }

      return this.mapFromMessage(message)
    } catch (error) {
      throw new RuntimeError(
        'reasoning_trace_find_failed',
        `Failed to find reasoning trace: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get reasoning traces for a conversation
   */
  async findByConversationId(conversationId: string): Promise<ReasoningTrace[]> {
    try {
      const messageList = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))

      const traces: ReasoningTrace[] = []

      for (const message of messageList) {
        if (message.metadata) {
          const metadata = JSON.parse(message.metadata)
          if (metadata.reasoningTrace) {
            traces.push(this.mapFromMessage(message))
          }
        }
      }

      return traces
    } catch (error) {
      throw new RuntimeError(
        'reasoning_trace_find_failed',
        `Failed to find reasoning traces: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Update reasoning trace
   */
  async update(messageId: string, input: ReasoningTraceUpdateInput): Promise<ReasoningTrace> {
    try {
      const existingTrace = await this.findByMessageId(messageId)
      if (!existingTrace) {
        throw new RuntimeError(
          'reasoning_trace_not_found',
          `Reasoning trace not found for message: ${messageId}`
        )
      }

      // Update reasoning steps if provided
      let reasoningSteps = existingTrace.reasoningSteps
      if (input.reasoningSteps) {
        reasoningSteps = input.reasoningSteps.map((step, index) => {
          const existingStep = existingTrace.reasoningSteps[index]
          return {
            ...existingStep,
            ...step,
            updatedAt: new Date(),
          }
        })
      }

      // Update metadata
      let metadata = existingTrace.metadata
      if (input.metadata) {
        metadata = { ...metadata, ...input.metadata }
      }
      if (input.isComplete !== undefined) {
        metadata.isComplete = input.isComplete
      }
      metadata.hasCorrections = reasoningSteps.some(step => step.type === 'correction')
      metadata.stepCount = reasoningSteps.length

      // Update trace content if provided
      const traceContent = input.traceContent || existingTrace.traceContent

      const updatedTraceData = {
        ...existingTrace,
        traceContent,
        reasoningSteps,
        metadata,
        updatedAt: new Date(),
      }

      // Update the message metadata
      const message = await this.findMessageById(messageId)
      if (!message) {
        throw new RuntimeError(
          'message_not_found',
          `Message not found: ${messageId}`
        )
      }

      const currentMetadata = message.metadata ? JSON.parse(message.metadata) : {}
      currentMetadata.reasoningTrace = updatedTraceData

      const updatedMessage = await db
        .update(messages)
        .set({
          metadata: JSON.stringify(currentMetadata),
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId))
        .returning()

      if (!updatedMessage || updatedMessage.length === 0) {
        throw new RuntimeError(
          'reasoning_trace_update_failed',
          'Failed to update reasoning trace'
        )
      }

      return this.mapFromMessage(updatedMessage[0])
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      throw new RuntimeError(
        'reasoning_trace_update_failed',
        `Failed to update reasoning trace: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete reasoning trace
   */
  async delete(messageId: string): Promise<void> {
    try {
      const message = await this.findMessageById(messageId)
      if (!message) {
        throw new RuntimeError(
          'message_not_found',
          `Message not found: ${messageId}`
        )
      }

      const currentMetadata = message.metadata ? JSON.parse(message.metadata) : {}
      delete currentMetadata.reasoningTrace

      await db
        .update(messages)
        .set({
          metadata: Object.keys(currentMetadata).length > 0 ? JSON.stringify(currentMetadata) : null,
          updatedAt: new Date(),
        })
        .where(eq(messages.id, messageId))
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      throw new RuntimeError(
        'reasoning_trace_delete_failed',
        `Failed to delete reasoning trace: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get reasoning trace analytics
   */
  async getAnalytics(conversationId?: string): Promise<{
    totalTraces: number
    averageConfidence: number
    averageSteps: number
    complexityDistribution: Record<string, number>
    taskTypeDistribution: Record<string, number>
    correctionRate: number
    completionRate: number
  }> {
    try {
      let traces: ReasoningTrace[]
      
      if (conversationId) {
        traces = await this.findByConversationId(conversationId)
      } else {
        // Get all traces (would need to scan all messages in production)
        traces = [] // Placeholder for now
      }

      if (traces.length === 0) {
        return {
          totalTraces: 0,
          averageConfidence: 0,
          averageSteps: 0,
          complexityDistribution: {},
          taskTypeDistribution: {},
          correctionRate: 0,
          completionRate: 0,
        }
      }

      const totalTraces = traces.length
      const averageConfidence = traces.reduce((sum, trace) => sum + trace.metadata.confidence, 0) / totalTraces
      const averageSteps = traces.reduce((sum, trace) => sum + trace.metadata.stepCount, 0) / totalTraces

      const complexityDistribution = traces.reduce((acc, trace) => {
        acc[trace.metadata.complexity] = (acc[trace.metadata.complexity] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const taskTypeDistribution = traces.reduce((acc, trace) => {
        acc[trace.metadata.taskType] = (acc[trace.metadata.taskType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const correctionRate = traces.filter(trace => trace.metadata.hasCorrections).length / totalTraces
      const completionRate = traces.filter(trace => trace.metadata.isComplete).length / totalTraces

      return {
        totalTraces,
        averageConfidence,
        averageSteps,
        complexityDistribution,
        taskTypeDistribution,
        correctionRate,
        completionRate,
      }
    } catch (error) {
      throw new RuntimeError(
        'reasoning_trace_analytics_failed',
        `Failed to get reasoning trace analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Search reasoning traces
   */
  async search(query: {
    conversationId?: string
    taskType?: string
    complexity?: string
    hasCorrections?: boolean
    isComplete?: boolean
    limit?: number
    offset?: number
  }): Promise<{
    traces: ReasoningTrace[]
    total: number
  }> {
    try {
      const {
        conversationId,
        taskType,
        complexity,
        hasCorrections,
        isComplete,
        limit = 20,
        offset = 0,
      } = query

      // Start with base query
      let messageQuery = db.select().from(messages)

      // Apply filters
      const conditions = []
      if (conversationId) {
        conditions.push(eq(messages.conversationId, conversationId))
      }

      if (conditions.length > 0) {
        messageQuery = messageQuery.where(and(...conditions))
      }

      const messageList = await messageQuery.orderBy(desc(messages.createdAt))

      // Filter by metadata criteria
      const traces: ReasoningTrace[] = []
      for (const message of messageList) {
        if (message.metadata) {
          const metadata = JSON.parse(message.metadata)
          if (metadata.reasoningTrace) {
            const trace = this.mapFromMessage(message)
            
            // Apply additional filters
            if (taskType && trace.metadata.taskType !== taskType) continue
            if (complexity && trace.metadata.complexity !== complexity) continue
            if (hasCorrections !== undefined && trace.metadata.hasCorrections !== hasCorrections) continue
            if (isComplete !== undefined && trace.metadata.isComplete !== isComplete) continue
            
            traces.push(trace)
          }
        }
      }

      // Apply pagination
      const total = traces.length
      const paginatedTraces = traces.slice(offset, offset + limit)

      return {
        traces: paginatedTraces,
        total,
      }
    } catch (error) {
      throw new RuntimeError(
        'reasoning_trace_search_failed',
        `Failed to search reasoning traces: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Helper method to find message by ID
   */
  private async findMessageById(messageId: string): Promise<Message | null> {
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1)
    
    return message ?? null
  }

  /**
   * Map from message to reasoning trace
   */
  private mapFromMessage(message: Message): ReasoningTrace {
    if (!message.metadata) {
      throw new Error('Message metadata is required')
    }

    const metadata = JSON.parse(message.metadata)
    const traceData = metadata.reasoningTrace

    if (!traceData) {
      throw new Error('Reasoning trace not found in message metadata')
    }

    return {
      id: traceData.id,
      messageId: traceData.messageId,
      conversationId: traceData.conversationId,
      traceContent: traceData.traceContent,
      reasoningSteps: JSON.parse(traceData.reasoningSteps),
      metadata: JSON.parse(traceData.metadata),
      createdAt: new Date(traceData.createdAt),
      updatedAt: new Date(traceData.updatedAt),
    }
  }
}

// Singleton instance
export const reasoningTraceRepository = new ReasoningTraceRepository()
