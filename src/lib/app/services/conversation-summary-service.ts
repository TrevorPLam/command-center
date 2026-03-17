/**
 * Conversation Summary Service
 * 
 * Manages rolling summaries for long conversations. Automatically generates,
 * updates, and maintains conversation summaries to preserve context while
 * reducing token usage.
 */

import { conversationRepository, messageRepository } from '../app/persistence/conversation-repository'
import type { Conversation, Message } from '../../lib/db/schema'
import { createOllamaAdapter } from '../runtime/ollama-adapter'
import type { RuntimeAdapter } from '../runtime/types'
import { estimateTokens } from './context-budget-service'
import { env } from '../../lib/config/env'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// TYPES
// ============================================================================

export interface ConversationSummary {
  id: string
  conversationId: string
  userGoal: string
  openQuestions: string[]
  constraints: string[]
  decisionsMade: string[]
  artifactsCreated: string[]
  nextActions: string[]
  keyTopics: string[]
  contextWindow: {
    summarizedMessageCount: number
    totalMessageCount: number
    summaryTokenCount: number
    lastUpdated: string
  }
  metadata: {
    generatedBy: string
    model: string
    confidence: number
    version: number
  }
}

export interface SummaryGenerationOptions {
  model?: string
  maxSummaryTokens?: number
  includeReasoning?: boolean
  confidence?: number
}

export interface SummaryUpdate {
  type: 'incremental' | 'full' | 'compression'
  newMessages: Message[]
  previousSummary?: ConversationSummary
  updatedSummary: ConversationSummary
  tokensSaved: number
}

export interface SummaryTrigger {
  type: 'message_count' | 'token_threshold' | 'time_interval' | 'manual'
  threshold?: number
  lastTriggered?: string
}

// ============================================================================
// SUMMARY PROMPTS
// ============================================================================

const SUMMARY_PROMPTS = {
  // Generate initial comprehensive summary
  initial: `Analyze this conversation and create a structured summary. Focus on:

1. **User Goal**: What is the user trying to achieve?
2. **Open Questions**: What questions remain unanswered?
3. **Constraints**: What limitations or requirements were mentioned?
4. **Decisions Made**: What conclusions have been reached?
5. **Artifacts Created**: What files, code, or outputs were produced?
6. **Next Actions**: What should happen next?
7. **Key Topics**: Main themes and topics discussed

Respond in JSON format:
{
  "userGoal": "Brief description of user's objective",
  "openQuestions": ["question1", "question2"],
  "constraints": ["constraint1", "constraint2"],
  "decisionsMade": ["decision1", "decision2"],
  "artifactsCreated": ["artifact1", "artifact2"],
  "nextActions": ["action1", "action2"],
  "keyTopics": ["topic1", "topic2"],
  "confidence": 0.8
}

Conversation:
{messages}`,

  // Incremental update for new messages
  incremental: `Given the previous conversation summary and new messages, update the summary.

Previous Summary:
{previousSummary}

New Messages:
{newMessages}

Update the summary incorporating the new information. Keep the same JSON structure but update any fields that changed. If no changes needed for a field, keep it the same.

Respond in JSON format with the updated summary.`,

  // Compression for very long conversations
  compression: `This conversation is very long. Create a highly compressed summary focusing only on the most critical information.

Conversation:
{messages}

Provide a concise summary in JSON format:
{
  "userGoal": "Primary objective",
  "openQuestions": ["Most important unanswered questions"],
  "constraints": ["Critical limitations"],
  "decisionsMade": ["Key conclusions"],
  "artifactsCreated": ["Important outputs"],
  "nextActions": ["Immediate next steps"],
  "keyTopics": ["Main themes"],
  "confidence": 0.7
}`,

  // Extract key topics
  topics: `Extract the main topics and themes from this conversation. Return as a JSON array of topic strings.

Conversation:
{messages}

Topics:
["topic1", "topic2", "topic3"]`
}

// ============================================================================
// CONVERSATION SUMMARY SERVICE
// ============================================================================

export class ConversationSummaryService {
  private runtime: RuntimeAdapter
  private defaultModel: string
  private summaryTriggers: Map<string, SummaryTrigger> = new Map()

  constructor(runtime?: RuntimeAdapter, defaultModel?: string) {
    this.runtime = runtime || createOllamaAdapter({ baseUrl: env.OLLAMA_BASE_URL })
    this.defaultModel = defaultModel || 'llama3.1:8b'
  }

  /**
   * Generate an initial summary for a conversation
   */
  async generateInitialSummary(
    conversationId: string,
    options: SummaryGenerationOptions = {}
  ): Promise<ConversationSummary> {
    const model = options.model || this.defaultModel
    const messages = await messageRepository.getByConversationId(conversationId, {
      limit: 50 // Get first 50 messages for initial summary
    })

    if (messages.length === 0) {
      throw new Error('No messages found for conversation')
    }

    const messagesText = this.formatMessagesForSummary(messages)
    const prompt = SUMMARY_PROMPTS.initial.replace('{messages}', messagesText)

    const summaryData = await this.generateSummaryWithLLM(prompt, model)
    
    const summary: ConversationSummary = {
      id: uuidv4(),
      conversationId,
      userGoal: summaryData.userGoal || 'No clear goal identified',
      openQuestions: summaryData.openQuestions || [],
      constraints: summaryData.constraints || [],
      decisionsMade: summaryData.decisionsMade || [],
      artifactsCreated: summaryData.artifactsCreated || [],
      nextActions: summaryData.nextActions || [],
      keyTopics: summaryData.keyTopics || [],
      contextWindow: {
        summarizedMessageCount: messages.length,
        totalMessageCount: await this.getTotalMessageCount(conversationId),
        summaryTokenCount: estimateTokens(JSON.stringify(summaryData)),
        lastUpdated: new Date().toISOString()
      },
      metadata: {
        generatedBy: 'conversation-summary-service',
        model,
        confidence: summaryData.confidence || 0.7,
        version: 1
      }
    }

    // Store summary in conversation metadata
    await this.saveSummaryToConversation(conversationId, summary)

    return summary
  }

  /**
   * Update an existing summary with new messages
   */
  async updateSummary(
    conversationId: string,
    previousSummary: ConversationSummary,
    newMessages: Message[],
    options: SummaryGenerationOptions = {}
  ): Promise<SummaryUpdate> {
    const model = options.model || this.defaultModel
    
    if (newMessages.length === 0) {
      throw new Error('No new messages to incorporate')
    }

    const messagesText = this.formatMessagesForSummary(newMessages)
    const previousSummaryText = JSON.stringify(previousSummary)
    const prompt = SUMMARY_PROMPTS.incremental
      .replace('{previousSummary}', previousSummaryText)
      .replace('{newMessages}', messagesText)

    const updatedSummaryData = await this.generateSummaryWithLLM(prompt, model)
    
    const updatedSummary: ConversationSummary = {
      ...previousSummary,
      userGoal: updatedSummaryData.userGoal || previousSummary.userGoal,
      openQuestions: updatedSummaryData.openQuestions || previousSummary.openQuestions,
      constraints: updatedSummaryData.constraints || previousSummary.constraints,
      decisionsMade: updatedSummaryData.decisionsMade || previousSummary.decisionsMade,
      artifactsCreated: updatedSummaryData.artifactsCreated || previousSummary.artifactsCreated,
      nextActions: updatedSummaryData.nextActions || previousSummary.nextActions,
      keyTopics: updatedSummaryData.keyTopics || previousSummary.keyTopics,
      contextWindow: {
        ...previousSummary.contextWindow,
        summarizedMessageCount: previousSummary.contextWindow.summarizedMessageCount + newMessages.length,
        summaryTokenCount: estimateTokens(JSON.stringify(updatedSummaryData)),
        lastUpdated: new Date().toISOString()
      },
      metadata: {
        ...previousSummary.metadata,
        confidence: updatedSummaryData.confidence || previousSummary.metadata.confidence,
        version: previousSummary.metadata.version + 1
      }
    }

    // Calculate tokens saved
    const originalTokens = newMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
    const summaryTokens = updatedSummary.contextWindow.summaryTokenCount
    const tokensSaved = Math.max(0, originalTokens - summaryTokens)

    // Save updated summary
    await this.saveSummaryToConversation(conversationId, updatedSummary)

    return {
      type: 'incremental',
      newMessages,
      previousSummary,
      updatedSummary,
      tokensSaved
    }
  }

  /**
   * Compress a conversation summary for very long conversations
   */
  async compressSummary(
    conversationId: string,
    previousSummary: ConversationSummary,
    options: SummaryGenerationOptions = {}
  ): Promise<SummaryUpdate> {
    const model = options.model || this.defaultModel
    
    // Get all messages for full compression
    const allMessages = await messageRepository.getByConversationId(conversationId, {
      limit: 200
    })

    const messagesText = this.formatMessagesForSummary(allMessages)
    const prompt = SUMMARY_PROMPTS.compression.replace('{messages}', messagesText)

    const compressedSummaryData = await this.generateSummaryWithLLM(prompt, model)
    
    const compressedSummary: ConversationSummary = {
      ...previousSummary,
      userGoal: compressedSummaryData.userGoal || previousSummary.userGoal,
      openQuestions: compressedSummaryData.openQuestions || previousSummary.openQuestions.slice(0, 3),
      constraints: compressedSummaryData.constraints || previousSummary.constraints.slice(0, 3),
      decisionsMade: compressedSummaryData.decisionsMade || previousSummary.decisionsMade.slice(0, 5),
      artifactsCreated: compressedSummaryData.artifactsCreated || previousSummary.artifactsCreated.slice(0, 3),
      nextActions: compressedSummaryData.nextActions || previousSummary.nextActions.slice(0, 3),
      keyTopics: compressedSummaryData.keyTopics || previousSummary.keyTopics.slice(0, 5),
      contextWindow: {
        summarizedMessageCount: allMessages.length,
        totalMessageCount: allMessages.length,
        summaryTokenCount: estimateTokens(JSON.stringify(compressedSummaryData)),
        lastUpdated: new Date().toISOString()
      },
      metadata: {
        ...previousSummary.metadata,
        generatedBy: 'conversation-summary-service:compression',
        model,
        confidence: Math.min(compressedSummaryData.confidence || 0.7, previousSummary.metadata.confidence),
        version: previousSummary.metadata.version + 1
      }
    }

    // Calculate tokens saved
    const originalTokens = allMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0)
    const summaryTokens = compressedSummary.contextWindow.summaryTokenCount
    const tokensSaved = originalTokens - summaryTokens

    // Save compressed summary
    await this.saveSummaryToConversation(conversationId, compressedSummary)

    return {
      type: 'compression',
      newMessages: allMessages,
      previousSummary,
      updatedSummary: compressedSummary,
      tokensSaved
    }
  }

  /**
   * Check if a conversation needs summary update
   */
  async shouldUpdateSummary(conversationId: string): Promise<{
    shouldUpdate: boolean
    reason?: string
    trigger?: SummaryTrigger
  }> {
    const conversation = await conversationRepository.getById(conversationId)
    if (!conversation) {
      return { shouldUpdate: false }
    }

    const currentSummary = await this.getSummaryFromConversation(conversationId)
    const messageCount = await this.getTotalMessageCount(conversationId)
    
    // Check if we have any summary
    if (!currentSummary) {
      return { 
        shouldUpdate: true, 
        reason: 'No existing summary',
        trigger: { type: 'message_count', threshold: 10 }
      }
    }

    // Check message count threshold
    const messagesSinceSummary = messageCount - currentSummary.contextWindow.summarizedMessageCount
    if (messagesSinceSummary >= 10) {
      return { 
        shouldUpdate: true, 
        reason: '10 new messages since last summary',
        trigger: { type: 'message_count', threshold: 10 }
      }
    }

    // Check time interval (24 hours)
    const lastUpdated = new Date(currentSummary.contextWindow.lastUpdated)
    const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60)
    if (hoursSinceUpdate >= 24) {
      return { 
        shouldUpdate: true, 
        reason: '24 hours since last summary update',
        trigger: { type: 'time_interval', threshold: 24 }
      }
    }

    // Check if conversation is getting very long
    if (messageCount >= 100) {
      return { 
        shouldUpdate: true, 
        reason: 'Very long conversation - compression recommended',
        trigger: { type: 'compression' }
      }
    }

    return { shouldUpdate: false }
  }

  /**
   * Get the current summary for a conversation
   */
  async getCurrentSummary(conversationId: string): Promise<ConversationSummary | null> {
    return await this.getSummaryFromConversation(conversationId)
  }

  /**
   * Generate summary using LLM
   */
  private async generateSummaryWithLLM(prompt: string, model: string): Promise<any> {
    try {
      const response = await this.runtime.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: 0.3,
          num_predict: 2048
        }
      })

      let responseText = ''
      for await (const event of response) {
        if (event.type === 'token') {
          responseText += event.text
        } else if (event.type === 'done') {
          break
        } else if (event.type === 'error') {
          throw new Error(`Summary generation failed: ${event.message}`)
        }
      }

      // Parse JSON response
      try {
        return JSON.parse(responseText.trim())
      } catch (parseError) {
        console.error('Failed to parse summary JSON:', parseError)
        // Return basic structure on parse failure
        return {
          userGoal: 'Summary parsing failed',
          openQuestions: [],
          constraints: [],
          decisionsMade: [],
          artifactsCreated: [],
          nextActions: [],
          keyTopics: [],
          confidence: 0.3
        }
      }
    } catch (error) {
      console.error('Failed to generate summary:', error)
      throw error
    }
  }

  /**
   * Format messages for summary generation
   */
  private formatMessagesForSummary(messages: Message[]): string {
    return messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n')
  }

  /**
   * Get total message count for conversation
   */
  private async getTotalMessageCount(conversationId: string): Promise<number> {
    const messages = await messageRepository.getByConversationId(conversationId, { limit: 1000 })
    return messages.length
  }

  /**
   * Save summary to conversation metadata
   */
  private async saveSummaryToConversation(conversationId: string, summary: ConversationSummary): Promise<void> {
    await conversationRepository.update(conversationId, {
      summaryJson: JSON.stringify(summary)
    })
  }

  /**
   * Get summary from conversation metadata
   */
  private async getSummaryFromConversation(conversationId: string): Promise<ConversationSummary | null> {
    const conversation = await conversationRepository.getById(conversationId)
    if (!conversation || !conversation.summaryJson) {
      return null
    }

    try {
      return JSON.parse(conversation.summaryJson) as ConversationSummary
    } catch (error) {
      console.error('Failed to parse conversation summary:', error)
      return null
    }
  }

  /**
   * Extract key topics from messages
   */
  async extractKeyTopics(messages: Message[], model?: string): Promise<string[]> {
    const targetModel = model || this.defaultModel
    const messagesText = this.formatMessagesForSummary(messages)
    const prompt = SUMMARY_PROMPTS.topics.replace('{messages}', messagesText)

    try {
      const response = await this.runtime.chat({
        model: targetModel,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: 0.2,
          num_predict: 500
        }
      })

      let responseText = ''
      for await (const event of response) {
        if (event.type === 'token') {
          responseText += event.text
        } else if (event.type === 'done') {
          break
        }
      }

      // Parse topics array
      try {
        const topics = JSON.parse(responseText.trim())
        return Array.isArray(topics) ? topics : []
      } catch (parseError) {
        // Fallback: extract topics from plain text
        return responseText
          .split(',')
          .map(topic => topic.trim().replace(/["\[\]]/g, ''))
          .filter(topic => topic.length > 0)
          .slice(0, 10)
      }
    } catch (error) {
      console.error('Failed to extract topics:', error)
      return []
    }
  }

  /**
   * Get summary statistics
   */
  async getSummaryStats(conversationId: string): Promise<{
    hasSummary: boolean
    summaryAge: number
    messagesSinceSummary: number
    tokensSaved: number
    compressionRatio: number
  } | null> {
    const summary = await this.getCurrentSummary(conversationId)
    if (!summary) {
      return null
    }

    const messageCount = await this.getTotalMessageCount(conversationId)
    const messagesSinceSummary = messageCount - summary.contextWindow.summarizedMessageCount
    const summaryAge = Date.now() - new Date(summary.contextWindow.lastUpdated).getTime()
    
    // Estimate tokens saved
    const estimatedOriginalTokens = messagesSinceSummary * 100 // Rough estimate
    const tokensSaved = Math.max(0, estimatedOriginalTokens - summary.contextWindow.summaryTokenCount)
    const compressionRatio = messageCount > 0 ? summary.contextWindow.summaryTokenCount / (messageCount * 100) : 0

    return {
      hasSummary: true,
      summaryAge,
      messagesSinceSummary,
      tokensSaved,
      compressionRatio
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export let conversationSummaryService: ConversationSummaryService

export function initializeConversationSummaryService(
  runtime?: RuntimeAdapter, 
  defaultModel?: string
): void {
  conversationSummaryService = new ConversationSummaryService(runtime, defaultModel)
}
