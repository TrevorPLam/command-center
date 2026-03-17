/**
 * Chat Stream Service
 * 
 * Service for handling chat streaming with proper normalization, context assembly,
 * and persistence. This service bridges the raw runtime adapter with the chat API.
 */

import { 
  RuntimeAdapter, 
  ChatRequest,
  StreamEvent,
  ResponseStream,
  RuntimeModel
} from '../runtime/types'
import { 
  RuntimeError,
  RuntimeErrorCode
} from '../runtime/errors'
import { conversationRepository, messageRepository } from '../app/persistence/conversation-repository'
import type { Conversation, Message, NewMessage } from '../lib/db/schema'
import { v4 as uuidv4 } from 'uuid'
import { 
  contextBudgetService, 
  ContextWindow, 
  BudgetPlan,
  initializeContextBudgetService 
} from './context-budget-service'
import { 
  conversationSummaryService,
  initializeConversationSummaryService 
} from './conversation-summary-service'
import { 
  modelSwitchCompressionService,
  ModelSwitchPlan,
  ContextOptimizationResult,
  initializeModelSwitchCompressionService 
} from './model-switch-compression-service'

export interface ChatStreamRequest {
  conversationId?: string
  message: string
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface ChatStreamOptions {
  signal?: AbortSignal
  onEvent?: (event: StreamEvent) => Promise<void>
  persistEvents?: boolean
  enableContextOptimization?: boolean
  autoSummarize?: boolean
}

export interface ChatContext {
  conversationId: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  model: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  contextWindow?: ContextWindow
  optimizationResult?: ContextOptimizationResult
}

export interface ChatStreamResponse {
  conversationId: string
  messageId: string
  stream: ResponseStream
}

export class ChatStreamService {
  constructor(private readonly runtime: RuntimeAdapter) {
    // Initialize context budgeting services
    initializeContextBudgetService(runtime)
    initializeConversationSummaryService(runtime)
    initializeModelSwitchCompressionService(runtime)
  }

  /**
   * Initialize all services (call this after creating the service)
   */
  async initializeServices(): Promise<void> {
    await modelSwitchCompressionService.initializeAvailableModels()
  }

  /**
   * Create a new conversation and start streaming chat
   */
  async createConversationAndStream(
    request: ChatStreamRequest,
    options: ChatStreamOptions = {}
  ): Promise<ChatStreamResponse> {
    // Create conversation
    const conversationData = {
      id: uuidv4(),
      title: this.generateConversationTitle(request.message),
      modelProfileId: request.model,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const conversation = await conversationRepository.create(conversationData)

    // Add user message
    const userMessageData: NewMessage = {
      id: uuidv4(),
      conversationId: conversation.id,
      role: 'user',
      content: request.message,
      createdAt: new Date()
    }

    const userMessage = await messageRepository.create(userMessageData)

    // Start streaming response
    return await this.streamChatResponse(
      conversation.id,
      request,
      options
    )
  }

  /**
   * Continue an existing conversation with streaming
   */
  async continueConversationStream(
    conversationId: string,
    request: ChatStreamRequest,
    options: ChatStreamOptions = {}
  ): Promise<ChatStreamResponse> {
    // Verify conversation exists
    const conversation = await conversationRepository.getById(conversationId)
    if (!conversation) {
      throw new RuntimeError(
        RuntimeErrorCode.NOT_FOUND,
        `Conversation not found: ${conversationId}`
      )
    }

    // Add user message
    const userMessageData: NewMessage = {
      id: uuidv4(),
      conversationId,
      role: 'user',
      content: request.message,
      createdAt: new Date()
    }

    const userMessage = await messageRepository.create(userMessageData)

    // Start streaming response
    return await this.streamChatResponse(
      conversationId,
      request,
      options
    )
  }

  /**
   * Stream chat response with normalization and persistence
   */
  private async streamChatResponse(
    conversationId: string,
    request: ChatStreamRequest,
    options: ChatStreamOptions = {}
  ): Promise<ChatStreamResponse> {
    // Build chat context
    const context = await this.buildChatContext(conversationId, request, options)

    // Create assistant message placeholder
    const assistantMessageId = uuidv4()
    let assistantContent = ''
    let startTime = Date.now()
    let tokenCount = 0

    // Create assistant message (will be updated as stream progresses)
    const assistantMessageData: NewMessage = {
      id: assistantMessageId,
      conversationId,
      role: 'assistant',
      content: '',
      createdAt: new Date()
    }

    const assistantMessage = await messageRepository.create(assistantMessageData)

    // Create normalized stream
    const normalizedStream = this.createNormalizedStream(
      context,
      async (event) => {
        // Handle event persistence
        if (options.persistEvents !== false) {
          await this.handleStreamEvent(
            conversationId,
            assistantMessageId,
            event,
            startTime
          )
        }

        // Call custom event handler
        await options.onEvent?.(event)
      }
    )

    return {
      conversationId,
      messageId: assistantMessageId,
      stream: normalizedStream
    }
  }

  /**
   * Build chat context from conversation history with optimization
   */
  private async buildChatContext(
    conversationId: string,
    request: ChatStreamRequest,
    options: ChatStreamOptions = {}
  ): Promise<ChatContext> {
    let contextWindow: ContextWindow
    let optimizationResult: ContextOptimizationResult | undefined

    // Build initial context window
    contextWindow = await contextBudgetService.buildContextWindow(
      conversationId,
      request.model,
      request.systemPrompt,
      request.maxTokens
    )

    // Apply context optimization if enabled
    if (options.enableContextOptimization !== false) {
      // Analyze context and get optimization plan
      const optimizationPlan = await modelSwitchCompressionService.analyzeContext(
        conversationId,
        request.model,
        request.systemPrompt
      )

      // Apply optimization if needed
      if (optimizationPlan.compressionStrategy.type !== 'summarize' || 
          contextWindow.needsCompression) {
        optimizationResult = await modelSwitchCompressionService.applyOptimization(
          conversationId,
          optimizationPlan.compressionStrategy,
          contextWindow,
          request.model
        )
        contextWindow = optimizationResult.optimizedContext
      }

      // Auto-summarize if enabled and needed
      if (options.autoSummarize && contextWindow.needsCompression) {
        const shouldUpdate = await conversationSummaryService.shouldUpdateSummary(conversationId)
        if (shouldUpdate.shouldUpdate) {
          try {
            if (!shouldUpdate.reason?.includes('No existing summary')) {
              // Update existing summary
              const currentSummary = await conversationSummaryService.getCurrentSummary(conversationId)
              const newMessages = await messageRepository.getByConversationId(conversationId, {
                limit: 10
              })
              await conversationSummaryService.updateSummary(conversationId, currentSummary!, newMessages)
            } else {
              // Generate initial summary
              await conversationSummaryService.generateInitialSummary(conversationId)
            }
          } catch (error) {
            console.error('Failed to auto-summarize:', error)
          }
        }
      }
    }

    // Convert context window to chat messages format
    const chatMessages = contextWindow.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // Add summary as system message if present
    if (contextWindow.summary) {
      chatMessages.unshift({
        role: 'system',
        content: `[Previous conversation summary]: ${contextWindow.summary}`
      })
    }

    return {
      conversationId,
      messages: chatMessages,
      model: optimizationResult?.modelUsed || request.model,
      systemPrompt: request.systemPrompt,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      contextWindow,
      optimizationResult
    }
  }

  /**
   * Create normalized stream from runtime adapter
   */
  private createNormalizedStream(
    context: ChatContext,
    onEvent: (event: StreamEvent) => Promise<void>
  ): ResponseStream {
    const chatRequest: ChatRequest = {
      model: context.model,
      messages: context.messages,
      options: {
        temperature: context.temperature,
        num_predict: context.maxTokens
      }
    }

    const runtimeStream = this.runtime.chat(chatRequest)

    return this.normalizeRuntimeStream(runtimeStream, onEvent)
  }

  /**
   * Normalize runtime stream events to standard format
   */
  private async *normalizeRuntimeStream(
    runtimeStream: ResponseStream,
    onEvent: (event: StreamEvent) => Promise<void>
  ): AsyncGenerator<StreamEvent> {
    try {
      for await (const event of runtimeStream) {
        const normalizedEvent = this.normalizeEvent(event)
        if (normalizedEvent) {
          await onEvent(normalizedEvent)
          yield normalizedEvent
        }
      }
    } catch (error) {
      const errorEvent: StreamEvent = {
        type: 'error',
        code: error instanceof RuntimeError ? error.code : RuntimeErrorCode.RUNTIME_ERROR,
        message: error instanceof Error ? error.message : 'Unknown streaming error'
      }
      await onEvent(errorEvent)
      yield errorEvent
    }
  }

  /**
   * Normalize individual stream events
   */
  private normalizeEvent(event: StreamEvent): StreamEvent | null {
    switch (event.type) {
      case 'token':
        return event
      case 'thinking':
        return event
      case 'tool_call':
        return event
      case 'metrics':
        return event
      case 'done':
        return event
      case 'error':
        return event
      default:
        // Filter out unknown events
        return null
    }
  }

  /**
   * Handle stream event persistence
   */
  private async handleStreamEvent(
    conversationId: string,
    messageId: string,
    event: StreamEvent,
    startTime: number
  ): Promise<void> {
    switch (event.type) {
      case 'token':
        // Append token to message content
        await messageRepository.update(messageId, {
          content: event.text,
          tokenCount: (event.text.match(/\S+/g) || []).length // Simple word count
        })
        break

      case 'thinking':
        // Store thinking in message metadata
        await messageRepository.update(messageId, {
          metadata: JSON.stringify({
            type: 'thinking',
            content: event.text,
            timestamp: new Date().toISOString()
          })
        })
        break

      case 'tool_call':
        // Store tool call in message metadata
        await messageRepository.update(messageId, {
          metadata: JSON.stringify({
            type: 'tool_call',
            name: event.name,
            input: event.input,
            timestamp: new Date().toISOString()
          })
        })
        break

      case 'metrics':
        // Update message with performance metrics
        await messageRepository.update(messageId, {
          latencyMs: event.latencyMs
        })
        break

      case 'done':
        // Mark message as complete and update conversation timestamp
        await messageRepository.update(messageId, {
          metadata: JSON.stringify({
            type: 'completed',
            timestamp: new Date().toISOString()
          })
        })
        await conversationRepository.update(conversationId, {
          updatedAt: new Date()
        })
        break

      case 'error':
        // Store error in message metadata
        await messageRepository.update(messageId, {
          metadata: JSON.stringify({
            type: 'error',
            code: event.code,
            message: event.message,
            timestamp: new Date().toISOString()
          })
        })
        break
    }
  }

  /**
   * Generate a conversation title from the first message
   */
  private generateConversationTitle(message: string): string {
    // Take first 50 characters, ensure it ends cleanly
    const truncated = message.substring(0, 50)
    return truncated.length < message.length 
      ? truncated + '...'
      : truncated
  }

  /**
   * Cancel an active stream
   */
  async cancelStream(conversationId: string, messageId: string): Promise<boolean> {
    try {
      // Mark the message as cancelled
      await messageRepository.update(messageId, {
        metadata: JSON.stringify({
          type: 'cancelled',
          timestamp: new Date().toISOString()
        })
      })

      return true
    } catch (error) {
      console.error(`Failed to cancel stream for message ${messageId}:`, error)
      return false
    }
  }

  /**
   * Get available models for chat
   */
  async getChatModels(): Promise<RuntimeModel[]> {
    try {
      return await this.runtime.listModels()
    } catch (error) {
      console.error('Failed to get chat models:', error)
      return []
    }
  }

  /**
   * Get context budget information for a conversation
   */
  async getContextBudgetInfo(conversationId: string, model: string): Promise<BudgetPlan> {
    return await contextBudgetService.createBudgetPlan(conversationId, model)
  }

  /**
   * Get conversation summary information
   */
  async getConversationSummary(conversationId: string) {
    return await conversationSummaryService.getCurrentSummary(conversationId)
  }

  /**
   * Get model switch recommendations
   */
  async getModelSwitchRecommendation(conversationId: string, currentModel: string): Promise<ModelSwitchPlan> {
    return await modelSwitchCompressionService.analyzeContext(conversationId, currentModel)
  }

  /**
   * Get available model profiles
   */
  getAvailableModelProfiles() {
    return modelSwitchCompressionService.getAvailableModelProfiles()
  }
}

// Export singleton instance
export let chatStreamService: ChatStreamService

export function initializeChatStreamService(runtime: RuntimeAdapter): void {
  chatStreamService = new ChatStreamService(runtime)
}
