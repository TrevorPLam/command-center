/**
 * Model Switch Compression Service
 * 
 * Handles intelligent model switching for context optimization. When conversations
 * become too large for the current model, this service can switch to a model with
 * larger context windows or compress the conversation appropriately.
 */

import { contextBudgetService, ContextWindow, BudgetPlan } from './context-budget-service'
import { conversationSummaryService, ConversationSummary } from './conversation-summary-service'
import { createOllamaAdapter } from '../runtime/ollama-adapter'
import type { RuntimeAdapter, RuntimeModel } from '../runtime/types'
import { env } from '../../lib/config/env'

// ============================================================================
// TYPES
// ============================================================================

export interface ModelProfile {
  name: string
  maxContextTokens: number
  recommendedMargin: number
  compressionThreshold: number
  capabilities: ModelCapabilities
  costPerToken: number
  speed: 'fast' | 'medium' | 'slow'
  reliability: number
}

export interface ModelCapabilities {
  reasoning: boolean
  code: boolean
  vision: boolean
  toolCalling: boolean
  structuredOutput: boolean
  longContext: boolean
}

export interface CompressionStrategy {
  type: 'summarize' | 'truncate' | 'model_switch' | 'hybrid'
  targetModel?: string
  compressionRatio: number
  estimatedQuality: number
  costSavings: number
  timeImpact: number
}

export type ModelSwitchStrategy = CompressionStrategy & {
  type: 'model_switch' | 'hybrid'
  targetModel: string
}

export interface ModelSwitchPlan {
  currentModel: string
  recommendedModel: string
  reason: string
  compressionStrategy: CompressionStrategy
  estimatedTokens: number
  costComparison: {
    current: number
    recommended: number
    savings: number
  }
  performanceImpact: {
    speed: 'faster' | 'same' | 'slower'
    quality: 'higher' | 'same' | 'lower'
    reliability: 'higher' | 'same' | 'lower'
  }
}

export interface ContextOptimizationResult {
  optimizedContext: ContextWindow
  appliedStrategy: CompressionStrategy
  modelUsed: string
  tokensOptimized: number
  processingTime: number
}

// ============================================================================
// MODEL PROFILES
// ============================================================================

const MODEL_PROFILES: Record<string, ModelProfile> = {
  // Large context models
  'llama3.1:8b': {
    name: 'llama3.1:8b',
    maxContextTokens: 128000,
    recommendedMargin: 8192,
    compressionThreshold: 0.8,
    capabilities: {
      reasoning: true,
      code: true,
      vision: false,
      toolCalling: true,
      structuredOutput: true,
      longContext: true
    },
    costPerToken: 0.0001,
    speed: 'medium',
    reliability: 0.9
  },
  'llama3.1:70b': {
    name: 'llama3.1:70b',
    maxContextTokens: 128000,
    recommendedMargin: 8192,
    compressionThreshold: 0.8,
    capabilities: {
      reasoning: true,
      code: true,
      vision: false,
      toolCalling: true,
      structuredOutput: true,
      longContext: true
    },
    costPerToken: 0.0003,
    speed: 'slow',
    reliability: 0.95
  },
  'qwen2.5:7b': {
    name: 'qwen2.5:7b',
    maxContextTokens: 128000,
    recommendedMargin: 8192,
    compressionThreshold: 0.8,
    capabilities: {
      reasoning: true,
      code: true,
      vision: false,
      toolCalling: true,
      structuredOutput: true,
      longContext: true
    },
    costPerToken: 0.00008,
    speed: 'fast',
    reliability: 0.85
  },
  'qwen2.5:14b': {
    name: 'qwen2.5:14b',
    maxContextTokens: 128000,
    recommendedMargin: 8192,
    compressionThreshold: 0.8,
    capabilities: {
      reasoning: true,
      code: true,
      vision: false,
      toolCalling: true,
      structuredOutput: true,
      longContext: true
    },
    costPerToken: 0.00012,
    speed: 'medium',
    reliability: 0.9
  },
  
  // Medium context models
  'mistral:7b': {
    name: 'mistral:7b',
    maxContextTokens: 32768,
    recommendedMargin: 4096,
    compressionThreshold: 0.75,
    capabilities: {
      reasoning: true,
      code: true,
      vision: false,
      toolCalling: true,
      structuredOutput: true,
      longContext: false
    },
    costPerToken: 0.00006,
    speed: 'fast',
    reliability: 0.9
  },
  'mixtral:8x7b': {
    name: 'mixtral:8x7b',
    maxContextTokens: 32768,
    recommendedMargin: 4096,
    compressionThreshold: 0.75,
    capabilities: {
      reasoning: true,
      code: true,
      vision: false,
      toolCalling: true,
      structuredOutput: true,
      longContext: false
    },
    costPerToken: 0.00015,
    speed: 'medium',
    reliability: 0.92
  },
  'codellama:7b': {
    name: 'codellama:7b',
    maxContextTokens: 16384,
    recommendedMargin: 2048,
    compressionThreshold: 0.7,
    capabilities: {
      reasoning: false,
      code: true,
      vision: false,
      toolCalling: false,
      structuredOutput: true,
      longContext: false
    },
    costPerToken: 0.00005,
    speed: 'fast',
    reliability: 0.85
  },
  'codellama:13b': {
    name: 'codellama:13b',
    maxContextTokens: 16384,
    recommendedMargin: 2048,
    compressionThreshold: 0.7,
    capabilities: {
      reasoning: false,
      code: true,
      vision: false,
      toolCalling: false,
      structuredOutput: true,
      longContext: false
    },
    costPerToken: 0.00008,
    speed: 'medium',
    reliability: 0.88
  },
  
  // Small context models
  'llama3:8b': {
    name: 'llama3:8b',
    maxContextTokens: 8192,
    recommendedMargin: 1024,
    compressionThreshold: 0.6,
    capabilities: {
      reasoning: true,
      code: true,
      vision: false,
      toolCalling: true,
      structuredOutput: true,
      longContext: false
    },
    costPerToken: 0.00004,
    speed: 'fast',
    reliability: 0.85
  },
  'llama3:70b': {
    name: 'llama3:70b',
    maxContextTokens: 8192,
    recommendedMargin: 1024,
    compressionThreshold: 0.6,
    capabilities: {
      reasoning: true,
      code: true,
      vision: false,
      toolCalling: true,
      structuredOutput: true,
      longContext: false
    },
    costPerToken: 0.0002,
    speed: 'slow',
    reliability: 0.9
  }
}

// ============================================================================
// MODEL SWITCH COMPRESSION SERVICE
// ============================================================================

export class ModelSwitchCompressionService {
  private runtime: RuntimeAdapter
  private availableModels: RuntimeModel[] = []
  private modelProfiles: Record<string, ModelProfile>

  constructor(runtime?: RuntimeAdapter) {
    this.runtime = runtime || createOllamaAdapter({ baseUrl: env.OLLAMA_BASE_URL })
    this.modelProfiles = { ...MODEL_PROFILES }
  }

  /**
   * Initialize available models from runtime
   */
  async initializeAvailableModels(): Promise<void> {
    try {
      this.availableModels = await this.runtime.listModels()
    } catch (error) {
      console.error('Failed to load available models:', error)
      this.availableModels = []
    }
  }

  /**
   * Get model profile by name
   */
  private getModelProfile(modelName: string): ModelProfile | null {
    return this.modelProfiles[modelName] || null
  }

  /**
   * Check if a model is available
   */
  private isModelAvailable(modelName: string): boolean {
    return this.availableModels.some(model => model.name === modelName)
  }

  /**
   * Get available models with profiles
   */
  getAvailableModelProfiles(): Array<{ model: RuntimeModel; profile: ModelProfile }> {
    return this.availableModels
      .map(model => ({
        model,
        profile: this.modelProfiles[model.name]
      }))
      .filter(item => item.profile) // Only include models with profiles
  }

  /**
   * Analyze context and recommend optimization strategy
   */
  async analyzeContext(
    conversationId: string,
    currentModel: string,
    systemPrompt?: string
  ): Promise<ModelSwitchPlan> {
    const currentProfile = this.getModelProfile(currentModel)
    if (!currentProfile) {
      throw new Error(`Unknown model: ${currentModel}`)
    }

    // Get current context analysis
    const budgetPlan = await contextBudgetService.createBudgetPlan(
      conversationId,
      currentModel,
      systemPrompt
    )

    const { contextWindow, budget } = budgetPlan
    const usageRatio = contextWindow.totalTokenCount / budget.maxTokens

    // Determine if optimization is needed
    if (usageRatio < currentProfile.compressionThreshold) {
      // No optimization needed
      return this.createNoOptimizationPlan(currentModel, budgetPlan)
    }

    // Find best optimization strategy
    const strategies = await this.generateOptimizationStrategies(
      conversationId,
      currentModel,
      contextWindow,
      budget
    )

    // Select best strategy
    const bestStrategy = this.selectBestStrategy(strategies)

    return this.createModelSwitchPlan(
      currentModel,
      bestStrategy,
      budgetPlan
    )
  }

  /**
   * Generate possible optimization strategies
   */
  private async generateOptimizationStrategies(
    conversationId: string,
    currentModel: string,
    contextWindow: ContextWindow,
    budget: ContextBudget
  ): Promise<CompressionStrategy[]> {
    const strategies: CompressionStrategy[] = []

    // Strategy 1: Summarize with current model
    strategies.push({
      type: 'summarize',
      compressionRatio: 0.3,
      estimatedQuality: 0.8,
      costSavings: 0.7,
      timeImpact: 0.2
    })

    // Strategy 2: Switch to larger context model
    const largerContextModels = this.findLargerContextModels(currentModel)
    for (const targetModel of largerContextModels) {
      const targetProfile = this.getModelProfile(targetModel)!
      strategies.push({
        type: 'model_switch',
        targetModel,
        compressionRatio: 0.1, // Minimal compression needed
        estimatedQuality: 0.95,
        costSavings: this.calculateCostSavings(currentModel, targetModel, contextWindow),
        timeImpact: this.calculateTimeImpact(currentModel, targetModel)
      })
    }

    // Strategy 3: Hybrid (summarize + model switch)
    if (largerContextModels.length > 0) {
      const targetModel = largerContextModels[0]
      strategies.push({
        type: 'hybrid',
        targetModel,
        compressionRatio: 0.2,
        estimatedQuality: 0.9,
        costSavings: 0.6,
        timeImpact: 0.3
      })
    }

    // Strategy 4: Truncate (last resort)
    strategies.push({
      type: 'truncate',
      compressionRatio: 0.5,
      estimatedQuality: 0.6,
      costSavings: 0.5,
      timeImpact: 0.1
    })

    return strategies
  }

  /**
   * Find models with larger context windows
   */
  private findLargerContextModels(currentModel: string): string[] {
    const currentProfile = this.getModelProfile(currentModel)!
    const currentContext = currentProfile.maxContextTokens

    return Object.entries(this.modelProfiles)
      .filter(([name, profile]) => 
        this.isModelAvailable(name) &&
        profile.maxContextTokens > currentContext &&
        this.hasCompatibleCapabilities(currentProfile.capabilities, profile.capabilities)
      )
      .map(([name]) => name)
      .sort((a, b) => {
        const profileA = this.getModelProfile(a)!
        const profileB = this.getModelProfile(b)!
        return profileB.maxContextTokens - profileA.maxContextTokens
      })
  }

  /**
   * Check if target model has compatible capabilities
   */
  private hasCompatibleCapabilities(
    current: ModelCapabilities,
    target: ModelCapabilities
  ): boolean {
    // All capabilities must be at least as good as current
    return Object.entries(current).every(([capability, required]) => {
      return target[capability as keyof ModelCapabilities] >= required
    })
  }

  /**
   * Calculate cost savings for model switch
   */
  private calculateCostSavings(
    currentModel: string,
    targetModel: string,
    contextWindow: ContextWindow
  ): number {
    const currentProfile = this.getModelProfile(currentModel)!
    const targetProfile = this.getModelProfile(targetModel)!
    
    const currentCost = contextWindow.totalTokenCount * currentProfile.costPerToken
    const targetCost = contextWindow.totalTokenCount * targetProfile.costPerToken
    
    return Math.max(0, (currentCost - targetCost) / currentCost)
  }

  /**
   * Calculate time impact for model switch
   */
  private calculateTimeImpact(currentModel: string, targetModel: string): number {
    const currentProfile = this.getModelProfile(currentModel)!
    const targetProfile = this.getModelProfile(targetModel)!
    
    const speedOrder = { fast: 1, medium: 2, slow: 3 }
    const currentSpeed = speedOrder[currentProfile.speed]
    const targetSpeed = speedOrder[targetProfile.speed]
    
    return (targetSpeed - currentSpeed) / 3 // Normalized to -1 to 1
  }

  /**
   * Select best strategy based on multiple factors
   */
  private selectBestStrategy(strategies: CompressionStrategy[]): CompressionStrategy {
    // Score each strategy
    const scoredStrategies = strategies.map(strategy => {
      let score = 0
      
      // Quality is most important (40%)
      score += strategy.estimatedQuality * 0.4
      
      // Cost savings (30%)
      score += strategy.costSavings * 0.3
      
      // Lower time impact is better (20%)
      score += (1 - Math.abs(strategy.timeImpact)) * 0.2
      
      // Lower compression ratio is better (10%)
      score += (1 - strategy.compressionRatio) * 0.1
      
      // Prefer model switch when available
      if (strategy.type === 'model_switch') score += 0.1
      if (strategy.type === 'hybrid') score += 0.05
      
      return { strategy, score }
    })

    // Return highest scoring strategy
    return scoredStrategies.reduce((best, current) => 
      current.score > best.score ? current : best
    ).strategy
  }

  /**
   * Apply optimization strategy
   */
  async applyOptimization(
    conversationId: string,
    strategy: CompressionStrategy,
    contextWindow: ContextWindow,
    currentModel: string
  ): Promise<ContextOptimizationResult> {
    const startTime = Date.now()
    let optimizedContext = contextWindow
    let modelUsed = currentModel

    switch (strategy.type) {
      case 'summarize':
        optimizedContext = await this.applySummarization(conversationId, contextWindow)
        break

      case 'model_switch':
        modelUsed = strategy.targetModel!
        optimizedContext = await this.applyModelSwitch(conversationId, contextWindow, modelUsed)
        break

      case 'hybrid':
        optimizedContext = await this.applyHybridStrategy(
          conversationId,
          contextWindow,
          strategy.targetModel!
        )
        modelUsed = strategy.targetModel!
        break

      case 'truncate':
        optimizedContext = await this.applyTruncation(contextWindow)
        break

      default:
        throw new Error(`Unknown strategy: ${strategy.type}`)
    }

    const processingTime = Date.now() - startTime
    const tokensOptimized = contextWindow.totalTokenCount - optimizedContext.totalTokenCount

    return {
      optimizedContext,
      appliedStrategy: strategy,
      modelUsed,
      tokensOptimized,
      processingTime
    }
  }

  /**
   * Apply summarization strategy
   */
  private async applySummarization(
    conversationId: string,
    contextWindow: ContextWindow
  ): Promise<ContextWindow> {
    const summary = await conversationSummaryService.generateInitialSummary(conversationId)
    
    return {
      ...contextWindow,
      messages: contextWindow.messages.slice(-6), // Keep last 6 messages
      summary: JSON.stringify(summary),
      summaryTokenCount: estimateTokens(JSON.stringify(summary)),
      totalTokenCount: this.calculateTotalTokens(contextWindow.messages.slice(-6), summary),
      needsCompression: false
    }
  }

  /**
   * Apply model switch strategy
   */
  private async applyModelSwitch(
    conversationId: string,
    contextWindow: ContextWindow,
    targetModel: string
  ): Promise<ContextWindow> {
    // For model switch, we might need minimal compression or none at all
    const targetProfile = this.getModelProfile(targetModel)!
    const usageRatio = contextWindow.totalTokenCount / targetProfile.maxContextTokens

    if (usageRatio < targetProfile.compressionThreshold) {
      // No compression needed
      return {
        ...contextWindow,
        needsCompression: false
      }
    }

    // Apply minimal summarization
    return await this.applySummarization(conversationId, contextWindow)
  }

  /**
   * Apply hybrid strategy
   */
  private async applyHybridStrategy(
    conversationId: string,
    contextWindow: ContextWindow,
    targetModel: string
  ): Promise<ContextWindow> {
    // Apply light summarization then model switch
    const summarized = await this.applySummarization(conversationId, contextWindow)
    return await this.applyModelSwitch(conversationId, summarized, targetModel)
  }

  /**
   * Apply truncation strategy
   */
  private async applyTruncation(contextWindow: ContextWindow): Promise<ContextWindow> {
    // Keep only the most recent messages that fit
    const maxTokens = contextWindow.totalTokenCount * 0.5
    let totalTokens = 0
    const recentMessages: typeof contextWindow.messages = []

    for (let i = contextWindow.messages.length - 1; i >= 0; i--) {
      const message = contextWindow.messages[i]
      if (message && totalTokens + message.tokenCount <= maxTokens) {
        recentMessages.unshift(message)
        totalTokens += message.tokenCount
      } else {
        break
      }
    }

    return {
      messages: recentMessages,
      summary: undefined,
      summaryTokenCount: 0,
      totalTokenCount: totalTokens,
      needsCompression: false,
      compressionStrategy: 'truncate'
    }
  }

  /**
   * Calculate total tokens including summary
   */
  private calculateTotalTokens(messages: Array<{tokenCount: number}>, summary: any): number {
    const messageTokens = messages.reduce((sum: number, msg) => sum + (msg?.tokenCount || 0), 0)
    const summaryTokens = estimateTokens(JSON.stringify(summary))
    return messageTokens + summaryTokens
  }

  /**
   * Create no optimization plan
   */
  private createNoOptimizationPlan(
    currentModel: string,
    budgetPlan: BudgetPlan
  ): ModelSwitchPlan {
    return {
      currentModel,
      recommendedModel: currentModel,
      reason: 'Context usage is within acceptable limits',
      compressionStrategy: {
        type: 'summarize',
        compressionRatio: 0,
        estimatedQuality: 1.0,
        costSavings: 0,
        timeImpact: 0
      },
      estimatedTokens: budgetPlan.contextWindow.totalTokenCount,
      costComparison: {
        current: 0,
        recommended: 0,
        savings: 0
      },
      performanceImpact: {
        speed: 'same',
        quality: 'same',
        reliability: 'same'
      }
    }
  }

  /**
   * Create model switch plan
   */
  private createModelSwitchPlan(
    currentModel: string,
    strategy: CompressionStrategy,
    budgetPlan: BudgetPlan
  ): ModelSwitchPlan {
    const recommendedModel = strategy.targetModel || currentModel
    const currentProfile = this.getModelProfile(currentModel)!
    const recommendedProfile = this.getModelProfile(recommendedModel)!

    return {
      currentModel,
      recommendedModel,
      reason: this.getStrategyReason(strategy, budgetPlan),
      compressionStrategy: strategy,
      estimatedTokens: Math.floor(
        budgetPlan.contextWindow.totalTokenCount * (1 - strategy.compressionRatio)
      ),
      costComparison: {
        current: budgetPlan.contextWindow.totalTokenCount * currentProfile.costPerToken,
        recommended: budgetPlan.contextWindow.totalTokenCount * recommendedProfile.costPerToken,
        savings: strategy.costSavings
      },
      performanceImpact: {
        speed: this.compareSpeed(currentProfile.speed, recommendedProfile.speed),
        quality: this.compareQuality(strategy.estimatedQuality),
        reliability: this.compareReliability(currentProfile.reliability, recommendedProfile.reliability)
      }
    }
  }

  /**
   * Get strategy reason
   */
  private getStrategyReason(strategy: CompressionStrategy, budgetPlan: BudgetPlan): string {
    switch (strategy.type) {
      case 'summarize':
        return 'Conversation is getting long - summarizing older messages to maintain context'
      case 'model_switch':
        return `Switching to ${strategy.targetModel} for larger context window`
      case 'hybrid':
        return `Applying light summarization and switching to ${strategy.targetModel}`
      case 'truncate':
        return 'Truncating older messages to fit within context limits (last resort)'
      default:
        return 'Optimizing context for better performance'
    }
  }

  /**
   * Compare speed between models
   */
  private compareSpeed(current: string, recommended: string): 'faster' | 'same' | 'slower' {
    if (current === recommended) return 'same'
    
    const speedOrder = { fast: 1, medium: 2, slow: 3 }
    const currentSpeed = speedOrder[current as keyof typeof speedOrder]
    const recommendedSpeed = speedOrder[recommended as keyof typeof speedOrder]
    
    if (recommendedSpeed < currentSpeed) return 'faster'
    if (recommendedSpeed > currentSpeed) return 'slower'
    return 'same'
  }

  /**
   * Compare quality
   */
  private compareQuality(estimatedQuality: number): 'higher' | 'same' | 'lower' {
    if (estimatedQuality > 0.9) return 'higher'
    if (estimatedQuality > 0.7) return 'same'
    return 'lower'
  }

  /**
   * Compare reliability
   */
  private compareReliability(current: number, recommended: number): 'higher' | 'same' | 'lower' {
    if (recommended > current + 0.05) return 'higher'
    if (recommended < current - 0.05) return 'lower'
    return 'same'
  }
}

// Helper function for token estimation
function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 3.5) + 2
}

// ============================================================================
// EXPORTS
// ============================================================================

export let modelSwitchCompressionService: ModelSwitchCompressionService

export function initializeModelSwitchCompressionService(runtime?: RuntimeAdapter): void {
  modelSwitchCompressionService = new ModelSwitchCompressionService(runtime)
}
