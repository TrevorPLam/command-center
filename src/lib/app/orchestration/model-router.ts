/**
 * Model Router
 * 
 * Intelligent model routing service that selects the optimal model profile
 * based on task requirements, capabilities, latency budget, and reliability preferences.
 */

import { modelProfileRepository } from '../persistence/model-profile-repository'
import { ModelProfile, ModelRole } from '../db/schema'
import { RuntimeError, RuntimeErrorErrorCode } from '../runtime/errors'

export interface RoutingRequest {
  task: TaskType
  requiresThinking?: boolean
  requiresTools?: boolean
  requiresVision?: boolean
  requiresEmbeddings?: boolean
  outputShape: OutputShape
  latencyBudget: LatencyBudget
  reliabilityPreference: ReliabilityPreference
  maxTokens?: number
  costBudget?: number
  excludeModels?: string[]
  preferModels?: string[]
}

export interface RoutingResult {
  profile: ModelProfile
  confidence: number
  reasoning: string[]
  fallbackProfiles: ModelProfile[]
  routingTimeMs: number
}

export type TaskType = 
  | 'chat'
  | 'code'
  | 'extract'
  | 'rag'
  | 'tool_use'
  | 'reasoning'
  | 'vision'
  | 'embedding'

export type OutputShape = 
  | 'text'
  | 'json'
  | 'structured'
  | 'code'

export type LatencyBudget = 
  | 'fast'      // < 2 seconds
  | 'balanced'  // 2-10 seconds
  | 'deep'      // > 10 seconds

export type ReliabilityPreference = 
  | 'speed'     // Prefer fastest, accept lower reliability
  | 'balanced'  // Balance speed and reliability
  | 'quality'   // Prefer highest quality, accept higher latency

export interface RoutingMetrics {
  requestCount: number
  successCount: number
  averageLatency: number
  modelUsage: Record<string, number>
  taskSuccess: Record<string, number>
}

/**
 * Model Router Service
 */
export class ModelRouter {
  private metrics: RoutingMetrics = {
    requestCount: 0,
    successCount: 0,
    averageLatency: 0,
    modelUsage: {},
    taskSuccess: {},
  }

  /**
   * Select the best model profile for a given request
   */
  async selectProfile(request: RoutingRequest): Promise<RoutingResult> {
    const startTime = Date.now()
    
    try {
      // Get all active profiles
      const allProfiles = await modelProfileRepository.findActive()
      
      // Filter by basic requirements
      const candidates = this.filterCandidates(allProfiles, request)
      
      // Score remaining candidates
      const scoredCandidates = await this.scoreCandidates(candidates, request)
      
      // Sort by score (descending)
      scoredCandidates.sort((a, b) => b.score - a.score)
      
      if (scoredCandidates.length === 0) {
        throw new RuntimeError(
          'no_suitable_model',
          'No suitable model profile found for the given requirements'
        )
      }

      const selected = scoredCandidates[0]
      const fallbackProfiles = scoredCandidates
        .slice(1, 4) // Top 3 fallbacks
        .map(c => c.profile)

      const routingTimeMs = Date.now() - startTime

      // Update metrics
      this.updateMetrics(selected.profile.id, request.task, routingTimeMs)

      return {
        profile: selected.profile,
        confidence: selected.confidence,
        reasoning: selected.reasoning,
        fallbackProfiles,
        routingTimeMs,
      }
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      throw new RuntimeError(
        'model_routing_failed',
        `Model routing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Filter profiles based on basic requirements
   */
  private filterCandidates(profiles: ModelProfile[], request: RoutingRequest): ModelProfile[] {
    return profiles.filter(profile => {
      // Exclude explicitly excluded models
      if (request.excludeModels?.includes(profile.id)) {
        return false
      }

      // Check role compatibility
      if (!this.isRoleCompatible(profile.role, request.task)) {
        return false
      }

      // Check capability requirements
      if (request.requiresThinking && profile.role !== 'reasoning') {
        // Only reasoning models are guaranteed to have thinking traces
        // but other models might still work, so we'll score them lower
      }

      if (request.requiresTools && profile.toolCallingReliability < 0.5) {
        return false
      }

      if (request.requiresVision && profile.role !== 'vision') {
        return false
      }

      if (request.requiresEmbeddings && profile.role !== 'embedding') {
        return false
      }

      // Check output shape compatibility
      if (request.outputShape === 'json' && profile.structuredOutputReliability < 0.3) {
        return false
      }

      if (request.outputShape === 'structured' && profile.structuredOutputReliability < 0.7) {
        return false
      }

      // Check context length requirements
      if (request.maxTokens && profile.maxSafeContext < request.maxTokens) {
        return false
      }

      // Check cost budget
      if (request.costBudget && profile.costPerToken) {
        const estimatedCost = (request.maxTokens || 1000) * profile.costPerToken
        if (estimatedCost > request.costBudget) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Check if a model role is compatible with a task type
   */
  private isRoleCompatible(role: ModelRole, task: TaskType): boolean {
    const compatibility: Record<ModelRole, TaskType[]> = {
      general: ['chat', 'extract', 'rag'],
      code: ['code', 'tool_use', 'extract'],
      reasoning: ['reasoning', 'chat', 'tool_use'],
      vision: ['vision', 'chat', 'extract'],
      embedding: ['embedding'],
      router: ['chat', 'tool_use', 'rag'],
      judge: ['extract', 'chat'],
    }

    return compatibility[role]?.includes(task) ?? false
  }

  /**
   * Score candidates based on request requirements
   */
  private async scoreCandidates(
    profiles: ModelProfile[], 
    request: RoutingRequest
  ): Promise<Array<{ profile: ModelProfile; score: number; confidence: number; reasoning: string[] }>> {
    const scored = await Promise.all(
      profiles.map(async (profile) => {
        let score = 0
        const reasoning: string[] = []

        // Base score from performance metrics
        score += profile.performanceScore * 0.3
        if (profile.performanceScore > 0.7) {
          reasoning.push(`Strong performance score (${profile.performanceScore.toFixed(2)})`)
        }

        // Task-specific scoring
        const taskScore = this.getTaskScore(profile, request)
        score += taskScore * 0.25
        if (taskScore > 0.7) {
          reasoning.push(`Well-suited for ${request.task} tasks`)
        }

        // Latency budget scoring
        const latencyScore = this.getLatencyScore(profile, request)
        score += latencyScore * 0.2
        if (latencyScore > 0.7) {
          reasoning.push(`Fits ${request.latencyBudget} latency budget`)
        }

        // Reliability scoring
        const reliabilityScore = this.getReliabilityScore(profile, request)
        score += reliabilityScore * 0.15
        if (reliabilityScore > 0.7) {
          reasoning.push(`Meets reliability requirements`)
        }

        // Preference scoring
        const preferenceScore = this.getPreferenceScore(profile, request)
        score += preferenceScore * 0.1
        if (preferenceScore > 0) {
          reasoning.push('Preferred model')
        }

        // Calculate confidence based on score distribution
        const confidence = Math.min(score / 0.9, 1.0) // Normalize to 0-1 range

        return {
          profile,
          score,
          confidence,
          reasoning,
        }
      })
    )

    return scored
  }

  /**
   * Get task-specific score for a profile
   */
  private getTaskScore(profile: ModelProfile, request: RoutingRequest): number {
    const taskRoleMap: Record<TaskType, ModelRole[]> = {
      chat: ['general', 'reasoning', 'router'],
      code: ['code', 'general'],
      extract: ['general', 'judge', 'code'],
      rag: ['general', 'router'],
      tool_use: ['code', 'reasoning', 'router'],
      reasoning: ['reasoning', 'general'],
      vision: ['vision'],
      embedding: ['embedding'],
    }

    const preferredRoles = taskRoleMap[request.task] || []
    const roleScore = preferredRoles.includes(profile.role) ? 1.0 : 0.3

    // Bonus for specialized capabilities
    let capabilityBonus = 0

    if (request.requiresTools) {
      capabilityBonus += profile.toolCallingReliability * 0.3
    }

    if (request.outputShape === 'json' || request.outputShape === 'structured') {
      capabilityBonus += profile.structuredOutputReliability * 0.3
    }

    if (request.requiresThinking && profile.role === 'reasoning') {
      capabilityBonus += 0.4
    }

    return Math.min(roleScore + capabilityBonus, 1.0)
  }

  /**
   * Get latency score for a profile
   */
  private getLatencyScore(profile: ModelProfile, request: RoutingRequest): number {
    // This would typically be based on historical latency data
    // For now, we'll use role-based heuristics
    
    const roleLatencyMap: Record<ModelRole, Record<LatencyBudget, number>> = {
      general: { fast: 0.8, balanced: 0.9, deep: 0.7 },
      code: { fast: 0.6, balanced: 0.8, deep: 0.9 },
      reasoning: { fast: 0.4, balanced: 0.7, deep: 0.9 },
      vision: { fast: 0.3, balanced: 0.6, deep: 0.8 },
      embedding: { fast: 0.9, balanced: 0.8, deep: 0.6 },
      router: { fast: 0.7, balanced: 0.8, deep: 0.7 },
      judge: { fast: 0.6, balanced: 0.8, deep: 0.9 },
    }

    return roleLatencyMap[profile.role]?.[request.latencyBudget] ?? 0.5
  }

  /**
   * Get reliability score for a profile
   */
  private getReliabilityScore(profile: ModelProfile, request: RoutingRequest): number {
    const { reliabilityPreference } = request

    let score = profile.performanceScore

    // Adjust based on preference
    switch (reliabilityPreference) {
      case 'speed':
        // Prioritize speed over raw reliability
        score = score * 0.7 + 0.3 // Boost score for faster models
        break
      case 'quality':
        // Prioritize quality/reliability
        score = score * 1.1 // Boost reliable models
        break
      case 'balanced':
      default:
        // Use score as-is
        break
    }

    // Apply capability-specific reliability factors
    if (request.requiresTools) {
      score *= profile.toolCallingReliability
    }

    if (request.outputShape === 'json' || request.outputShape === 'structured') {
      score *= profile.structuredOutputReliability
    }

    return Math.min(score, 1.0)
  }

  /**
   * Get preference score for a profile
   */
  private getPreferenceScore(profile: ModelProfile, request: RoutingRequest): number {
    let score = 0

    // Preferred models get a bonus
    if (request.preferModels?.includes(profile.id)) {
      score += 0.5
    }

    return score
  }

  /**
   * Update routing metrics
   */
  private updateMetrics(profileId: string, task: TaskType, routingTimeMs: number): void {
    this.metrics.requestCount++

    // Update model usage
    this.metrics.modelUsage[profileId] = (this.metrics.modelUsage[profileId] || 0) + 1

    // Update task success (placeholder - would be updated with actual results)
    this.metrics.taskSuccess[task] = (this.metrics.taskSuccess[task] || 0) + 1

    // Update average latency
    const totalLatency = this.metrics.averageLatency * (this.metrics.requestCount - 1) + routingTimeMs
    this.metrics.averageLatency = totalLatency / this.metrics.requestCount
  }

  /**
   * Get current routing metrics
   */
  getMetrics(): RoutingMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      successCount: 0,
      averageLatency: 0,
      modelUsage: {},
      taskSuccess: {},
    }
  }

  /**
   * Record successful routing result
   */
  recordSuccess(profileId: string, task: TaskType): void {
    this.metrics.successCount++
    // Update task-specific success metrics
    const taskKey = `${task}_success`
    this.metrics.taskSuccess[taskKey] = (this.metrics.taskSuccess[taskKey] || 0) + 1
  }

  /**
   * Record failed routing attempt
   */
  recordFailure(profileId: string, task: TaskType, error: string): void {
    // Update failure metrics
    const taskKey = `${task}_failure`
    this.metrics.taskSuccess[taskKey] = (this.metrics.taskSuccess[taskKey] || 0) + 1
  }
}

// Singleton instance
export const modelRouter = new ModelRouter()
