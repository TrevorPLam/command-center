/**
 * Context Budget Service
 * 
 * Manages conversation context windows, token counting, and intelligent context
 * trimming for long conversations. Implements rolling summaries and model-switch
 * compression to maintain conversation continuity within context limits.
 */

import { conversationRepository, messageRepository } from '../app/persistence/conversation-repository'
import type { Conversation, Message } from '../../lib/db/schema'
import { createOllamaAdapter } from '../runtime/ollama-adapter'
import type { RuntimeAdapter } from '../runtime/types'
import { env } from '../../lib/config/env'

// ============================================================================
// TYPES
// ============================================================================

export interface TokenCount {
  total: number
  system: number
  user: number
  assistant: number
  metadata: number
}

export interface ContextBudget {
  maxTokens: number
  reservedTokens: number
  availableTokens: number
  currentUsage: TokenCount
  safetyMargin: number
}

export interface ContextWindow {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
    tokenCount: number
    messageId?: string
  }>
  summary?: string
  summaryTokenCount: number
  totalTokenCount: number
  needsCompression: boolean
  compressionStrategy?: 'summarize' | 'truncate' | 'model_switch'
}

export interface BudgetPlan {
  contextWindow: ContextWindow
  budget: ContextBudget
  recommendations: string[]
  warnings: string[]
}

export interface ModelContextLimits {
  [modelName: string]: {
    maxTokens: number
    recommendedMargin: number
    compressionThreshold: number
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONTEXT_LIMITS: ModelContextLimits = {
  // Common model context limits (conservative estimates)
  'llama3.1:8b': { maxTokens: 128000, recommendedMargin: 8192, compressionThreshold: 0.8 },
  'llama3.1:70b': { maxTokens: 128000, recommendedMargin: 8192, compressionThreshold: 0.8 },
  'llama3:8b': { maxTokens: 8192, recommendedMargin: 1024, compressionThreshold: 0.75 },
  'llama3:70b': { maxTokens: 8192, recommendedMargin: 1024, compressionThreshold: 0.75 },
  'qwen2.5:7b': { maxTokens: 128000, recommendedMargin: 8192, compressionThreshold: 0.8 },
  'qwen2.5:14b': { maxTokens: 128000, recommendedMargin: 8192, compressionThreshold: 0.8 },
  'mistral:7b': { maxTokens: 32768, recommendedMargin: 4096, compressionThreshold: 0.8 },
  'mixtral:8x7b': { maxTokens: 32768, recommendedMargin: 4096, compressionThreshold: 0.8 },
  'codellama:7b': { maxTokens: 16384, recommendedMargin: 2048, compressionThreshold: 0.8 },
  'codellama:13b': { maxTokens: 16384, recommendedMargin: 2048, compressionThreshold: 0.8 },
  // Default fallback
  'default': { maxTokens: 4096, recommendedMargin: 512, compressionThreshold: 0.75 }
}

const COMPRESSION_PROMPTS = {
  summarize: `Summarize the following conversation messages concisely while preserving:
1. Key decisions and conclusions
2. Important context and constraints
3. Action items and next steps
4. User preferences and requirements

Keep the summary under 25% of the original token count. Focus on information that would be needed to continue the conversation effectively.

Conversation:
{messages}

Summary:`,

  compress_for_model: `Compress this conversation for a model with smaller context window. Prioritize:
1. Recent messages (keep last 5 turns intact)
2. Key technical details and constraints
3. User goals and requirements
4. Critical decisions made

Older context should be summarized very briefly. Maintain conversation continuity.

Conversation:
{messages}

Compressed context:`
}

// ============================================================================
// TOKEN COUNTING
// ============================================================================

/**
 * Simple token counting approximation
 * In production, use a proper tokenizer like tiktoken
 */
export function estimateTokens(text: string): number {
  if (!text) return 0
  
  // Approximate: 1 token ≈ 4 characters for most models
  // Add some overhead for special tokens and formatting
  const charCount = text.length
  const tokenCount = Math.ceil(charCount / 3.5) + 2 // +2 for special tokens
  
  return tokenCount
}

/**
 * Count tokens in a message with role and formatting overhead
 */
export function countMessageTokens(message: {
  role: string
  content: string
  metadata?: string
}): number {
  const roleTokens = estimateTokens(message.role)
  const contentTokens = estimateTokens(message.content)
  const metadataTokens = message.metadata ? estimateTokens(message.metadata) : 0
  const formattingTokens = 10 // Approximate overhead for JSON formatting
  
  return roleTokens + contentTokens + metadataTokens + formattingTokens
}

// ============================================================================
// CONTEXT BUDGET SERVICE
// ============================================================================

export class ContextBudgetService {
  private runtime: RuntimeAdapter
  private modelLimits: ModelContextLimits

  constructor(runtime?: RuntimeAdapter) {
    this.runtime = runtime || createOllamaAdapter({ baseUrl: env.OLLAMA_BASE_URL })
    this.modelLimits = { ...DEFAULT_CONTEXT_LIMITS }
  }

  /**
   * Get context limits for a specific model
   */
  private getModelLimits(modelName: string): ModelContextLimits[string] {
    // Try exact match first
    if (this.modelLimits[modelName]) {
      return this.modelLimits[modelName]
    }
    
    // Try partial match (for model families)
    const modelFamily = modelName.split(':')[0]
    const matchingKey = Object.keys(this.modelLimits).find(key => 
      key.startsWith(modelFamily) && key !== 'default'
    )
    
    if (matchingKey) {
      return this.modelLimits[matchingKey]
    }
    
    // Fallback to default
    return this.modelLimits['default']
  }

  /**
   * Calculate current token usage for a conversation
   */
  async calculateTokenUsage(conversationId: string): Promise<TokenCount> {
    const messages = await messageRepository.getByConversationId(conversationId, {
      limit: 1000 // Get all messages for accurate counting
    })

    let system = 0
    let user = 0
    let assistant = 0
    let metadata = 0

    for (const message of messages) {
      const messageTokens = countMessageTokens({
        role: message.role,
        content: message.content,
        metadata: message.metadata
      })

      switch (message.role) {
        case 'system':
          system += messageTokens
          break
        case 'user':
          user += messageTokens
          break
        case 'assistant':
          assistant += messageTokens
          break
        case 'tool':
          metadata += messageTokens
          break
        default:
          // Unknown role, count as metadata
          metadata += messageTokens
      }
    }

    return {
      total: system + user + assistant + metadata,
      system,
      user,
      assistant,
      metadata
    }
  }

  /**
   * Create a context budget for a model and conversation
   */
  async createBudget(
    conversationId: string,
    model: string,
    reservedTokens: number = 1024
  ): Promise<ContextBudget> {
    const modelLimits = this.getModelLimits(model)
    const currentUsage = await this.calculateTokenUsage(conversationId)
    
    const maxTokens = modelLimits.maxTokens
    const safetyMargin = modelLimits.recommendedMargin
    const availableTokens = maxTokens - safetyMargin - reservedTokens

    return {
      maxTokens,
      reservedTokens,
      availableTokens,
      currentUsage,
      safetyMargin
    }
  }

  /**
   * Build context window with intelligent compression
   */
  async buildContextWindow(
    conversationId: string,
    model: string,
    systemPrompt?: string,
    maxTokens?: number
  ): Promise<ContextWindow> {
    const budget = await this.createBudget(conversationId, model)
    const modelLimits = this.getModelLimits(model)
    
    // Get conversation messages
    const messages = await messageRepository.getByConversationId(conversationId, {
      limit: 100
    })

    // Convert to context format
    const contextMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content,
      tokenCount: countMessageTokens({
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata
      }),
      messageId: msg.id
    }))

    // Add system prompt if provided
    if (systemPrompt) {
      const systemMessage = {
        role: 'system' as const,
        content: systemPrompt,
        tokenCount: countMessageTokens({ role: 'system', content: systemPrompt }),
        messageId: 'system-prompt'
      }
      contextMessages.unshift(systemMessage)
    }

    // Calculate total tokens
    const totalTokenCount = contextMessages.reduce((sum, msg) => sum + msg.tokenCount, 0)
    
    // Determine if compression is needed
    const compressionThreshold = modelLimits.compressionThreshold
    const needsCompression = totalTokenCount > (budget.maxTokens * compressionThreshold)

    let contextWindow: ContextWindow = {
      messages: contextMessages,
      summary: undefined,
      summaryTokenCount: 0,
      totalTokenCount,
      needsCompression
    }

    // Apply compression if needed
    if (needsCompression) {
      contextWindow = await this.applyCompression(contextWindow, budget, model)
    }

    return contextWindow
  }

  /**
   * Apply compression strategy to context window
   */
  private async applyCompression(
    contextWindow: ContextWindow,
    budget: ContextBudget,
    model: string
  ): Promise<ContextWindow> {
    const { messages } = contextWindow
    
    // Strategy 1: Keep recent messages, summarize older ones
    if (messages.length > 10) {
      const recentMessages = messages.slice(-6) // Keep last 6 messages
      const olderMessages = messages.slice(0, -6)
      
      if (olderMessages.length > 0) {
        const summary = await this.summarizeMessages(olderMessages, model)
        const summaryTokenCount = estimateTokens(summary)
        
        return {
          messages: recentMessages,
          summary,
          summaryTokenCount,
          totalTokenCount: recentMessages.reduce((sum, msg) => sum + msg.tokenCount, 0) + summaryTokenCount,
          needsCompression: false,
          compressionStrategy: 'summarize'
        }
      }
    }

    // Strategy 2: Simple truncation for very long conversations
    const maxMessages = Math.floor(budget.availableTokens / 100) // Rough estimate
    if (messages.length > maxMessages) {
      const truncatedMessages = messages.slice(-maxMessages)
      const totalTokens = truncatedMessages.reduce((sum, msg) => sum + msg.tokenCount, 0)
      
      return {
        messages: truncatedMessages,
        summary: undefined,
        summaryTokenCount: 0,
        totalTokenCount,
        needsCompression: false,
        compressionStrategy: 'truncate'
      }
    }

    return contextWindow
  }

  /**
   * Summarize a list of messages using the runtime
   */
  private async summarizeMessages(messages: Array<{
    role: string
    content: string
  }>, model: string): Promise<string> {
    const messagesText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n')

    const prompt = COMPRESSION_PROMPTS.summarize.replace('{messages}', messagesText)

    try {
      const response = await this.runtime.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: 0.3,
          num_predict: 1024 // Limit summary length
        }
      })

      // Extract response text from stream
      let summary = ''
      for await (const event of response) {
        if (event.type === 'token') {
          summary += event.text
        } else if (event.type === 'done') {
          break
        } else if (event.type === 'error') {
          console.error('Summary generation error:', event.message)
          return `[Summary generation failed: ${event.message}]`
        }
      }

      return summary.trim()
    } catch (error) {
      console.error('Failed to summarize messages:', error)
      return `[Summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}]`
    }
  }

  /**
   * Create a comprehensive budget plan
   */
  async createBudgetPlan(
    conversationId: string,
    model: string,
    systemPrompt?: string
  ): Promise<BudgetPlan> {
    const budget = await this.createBudget(conversationId, model)
    const contextWindow = await this.buildContextWindow(conversationId, model, systemPrompt)
    
    const recommendations: string[] = []
    const warnings: string[] = []

    // Analyze usage and provide recommendations
    const usageRatio = contextWindow.totalTokenCount / budget.maxTokens
    
    if (usageRatio > 0.9) {
      warnings.push('Context window nearly full. Consider starting a new conversation.')
    } else if (usageRatio > 0.8) {
      warnings.push('Context window getting full. Older messages will be summarized.')
    } else if (usageRatio > 0.6) {
      recommendations.push('Consider summarizing older messages to maintain performance.')
    }

    if (contextWindow.needsCompression) {
      recommendations.push(`Using ${contextWindow.compressionStrategy} compression strategy.`)
    }

    if (contextWindow.summary) {
      recommendations.push(`Conversation summary uses ${contextWindow.summaryTokenCount} tokens.`)
    }

    return {
      contextWindow,
      budget,
      recommendations,
      warnings
    }
  }

  /**
   * Get model-specific recommendations
   */
  getModelRecommendations(model: string): {
    maxTokens: number
    recommendedMargin: number
    compressionThreshold: number
    notes: string[]
  } {
    const limits = this.getModelLimits(model)
    
    const notes: string[] = []
    
    if (limits.maxTokens >= 128000) {
      notes.push('Large context model - can handle long conversations')
    } else if (limits.maxTokens <= 8192) {
      notes.push('Small context window - frequent summarization recommended')
    }
    
    if (limits.compressionThreshold >= 0.8) {
      notes.push('Conservative compression - maintains more context')
    } else {
      notes.push('Aggressive compression - prioritizes token efficiency')
    }

    return {
      maxTokens: limits.maxTokens,
      recommendedMargin: limits.recommendedMargin,
      compressionThreshold: limits.compressionThreshold,
      notes
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export let contextBudgetService: ContextBudgetService

export function initializeContextBudgetService(runtime?: RuntimeAdapter): void {
  contextBudgetService = new ContextBudgetService(runtime)
}

// Export utility functions
export { estimateTokens, countMessageTokens }
