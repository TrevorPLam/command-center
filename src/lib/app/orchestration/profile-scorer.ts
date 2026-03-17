/**
 * Profile Scorer
 * 
 * Advanced scoring system for model profiles that considers multiple dimensions:
 * performance, reliability, cost, latency, and task-specific capabilities.
 */

import { ModelProfile, ModelRole } from '../db/schema'
import { RuntimeError } from '../runtime/errors'

export interface ScoringContext {
  taskType: string
  inputComplexity: 'low' | 'medium' | 'high'
  outputComplexity: 'low' | 'medium' | 'high'
  realTimeRequired: boolean
  costSensitive: boolean
  qualityCritical: boolean
  historicalPerformance?: Record<string, number>
}

export interface ProfileScore {
  profileId: string
  totalScore: number
  componentScores: {
    performance: number
    reliability: number
    cost: number
    latency: number
    capability: number
  }
  confidence: number
  reasoning: string[]
  recommendations: string[]
}

export interface ScoringWeights {
  performance: number
  reliability: number
  cost: number
  latency: number
  capability: number
}

/**
 * Profile Scorer Service
 */
export class ProfileScorer {
  private defaultWeights: ScoringWeights = {
    performance: 0.25,
    reliability: 0.25,
    cost: 0.15,
    latency: 0.15,
    capability: 0.20,
  }

  /**
   * Score a model profile based on the given context
   */
  async scoreProfile(
    profile: ModelProfile,
    context: ScoringContext,
    weights: Partial<ScoringWeights> = {}
  ): Promise<ProfileScore> {
    const finalWeights = { ...this.defaultWeights, ...weights }

    try {
      const componentScores = await this.calculateComponentScores(profile, context)
      const totalScore = this.calculateTotalScore(componentScores, finalWeights)
      const confidence = this.calculateConfidence(componentScores, context)
      const reasoning = this.generateReasoning(profile, context, componentScores)
      const recommendations = this.generateRecommendations(profile, context, componentScores)

      return {
        profileId: profile.id,
        totalScore,
        componentScores,
        confidence,
        reasoning,
        recommendations,
      }
    } catch (error) {
      throw new RuntimeError(
        'profile_scoring_failed',
        `Failed to score profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Score multiple profiles and return ranked results
   */
  async scoreProfiles(
    profiles: ModelProfile[],
    context: ScoringContext,
    weights: Partial<ScoringWeights> = {}
  ): Promise<ProfileScore[]> {
    const scores = await Promise.all(
      profiles.map(profile => this.scoreProfile(profile, context, weights))
    )

    // Sort by total score (descending)
    scores.sort((a, b) => b.totalScore - a.totalScore)

    return scores
  }

  /**
   * Calculate individual component scores
   */
  private async calculateComponentScores(
    profile: ModelProfile,
    context: ScoringContext
  ): Promise<ProfileScore['componentScores']> {
    const performance = this.calculatePerformanceScore(profile, context)
    const reliability = this.calculateReliabilityScore(profile, context)
    const cost = this.calculateCostScore(profile, context)
    const latency = this.calculateLatencyScore(profile, context)
    const capability = this.calculateCapabilityScore(profile, context)

    return {
      performance,
      reliability,
      cost,
      latency,
      capability,
    }
  }

  /**
   * Calculate performance score based on historical data and profile metrics
   */
  private calculatePerformanceScore(profile: ModelProfile, context: ScoringContext): number {
    let score = profile.performanceScore || 0.5

    // Adjust based on historical performance if available
    if (context.historicalPerformance?.[profile.id]) {
      const historicalScore = context.historicalPerformance[profile.id]
      score = (score * 0.7) + (historicalScore * 0.3) // Weight historical data
    }

    // Adjust based on task complexity
    const complexityMultiplier = context.inputComplexity === 'high' ? 0.9 : 
                                context.inputComplexity === 'medium' ? 0.95 : 1.0
    score *= complexityMultiplier

    // Quality critical tasks get higher standards
    if (context.qualityCritical) {
      score *= 1.1 // Boost models with higher performance scores
    }

    return Math.min(score, 1.0)
  }

  /**
   * Calculate reliability score based on profile reliability metrics
   */
  private calculateReliabilityScore(profile: ModelProfile, context: ScoringContext): number {
    let score = 0.5 // Base score

    // Tool calling reliability
    const toolReliability = profile.toolCallingReliability || 0.5
    score += toolReliability * 0.3

    // Structured output reliability
    const structuredReliability = profile.structuredOutputReliability || 0.5
    score += structuredReliability * 0.3

    // Role-based reliability
    const roleReliability = this.getRoleReliability(profile.role)
    score += roleReliability * 0.4

    // Adjust for quality critical tasks
    if (context.qualityCritical) {
      score *= 1.2
    }

    return Math.min(score, 1.0)
  }

  /**
   * Calculate cost score (higher is better, so we invert cost)
   */
  private calculateCostScore(profile: ModelProfile, context: ScoringContext): number {
    if (!profile.costPerToken) {
      return 0.7 // Neutral score if cost is unknown
    }

    const costPerToken = profile.costPerToken
    
    // Define cost tiers (lower cost = higher score)
    let costScore: number
    
    if (costPerToken <= 0.0001) { // Very cheap
      costScore = 1.0
    } else if (costPerToken <= 0.001) { // Cheap
      costScore = 0.8
    } else if (costPerToken <= 0.01) { // Moderate
      costScore = 0.6
    } else if (costPerToken <= 0.1) { // Expensive
      costScore = 0.4
    } else { // Very expensive
      costScore = 0.2
    }

    // Adjust for cost sensitivity
    if (context.costSensitive) {
      costScore *= 1.5 // Give more weight to cheaper models
    }

    return Math.min(costScore, 1.0)
  }

  /**
   * Calculate latency score based on model role and requirements
   */
  private calculateLatencyScore(profile: ModelProfile, context: ScoringContext): number {
    const roleLatencyMap: Record<ModelRole, number> = {
      general: 0.8,
      code: 0.7,
      reasoning: 0.5,
      vision: 0.4,
      embedding: 0.9,
      router: 0.7,
      judge: 0.6,
    }

    let score = roleLatencyMap[profile.role] || 0.5

    // Adjust for real-time requirements
    if (context.realTimeRequired) {
      // Prefer faster models for real-time tasks
      if (profile.role === 'general' || profile.role === 'embedding') {
        score *= 1.2
      } else if (profile.role === 'reasoning' || profile.role === 'vision') {
        score *= 0.7 // Penalize slower models
      }
    }

    return Math.min(score, 1.0)
  }

  /**
   * Calculate capability score based on model role and task requirements
   */
  private calculateCapabilityScore(profile: ModelProfile, context: ScoringContext): number {
    let score = 0.5 // Base score

    // Role-based capability scoring
    const roleCapabilityMap: Record<string, Record<ModelRole, number>> = {
      chat: {
        general: 0.9,
        reasoning: 0.8,
        router: 0.7,
        judge: 0.6,
        code: 0.5,
        vision: 0.3,
        embedding: 0.1,
      },
      code: {
        code: 0.9,
        general: 0.7,
        reasoning: 0.6,
        router: 0.5,
        judge: 0.4,
        vision: 0.2,
        embedding: 0.1,
      },
      extract: {
        general: 0.8,
        judge: 0.9,
        code: 0.7,
        reasoning: 0.6,
        router: 0.5,
        vision: 0.4,
        embedding: 0.1,
      },
      rag: {
        general: 0.8,
        router: 0.9,
        reasoning: 0.6,
        judge: 0.5,
        code: 0.4,
        vision: 0.3,
        embedding: 0.2,
      },
      tool_use: {
        code: 0.9,
        reasoning: 0.8,
        router: 0.7,
        general: 0.5,
        judge: 0.4,
        vision: 0.2,
        embedding: 0.1,
      },
      reasoning: {
        reasoning: 0.9,
        general: 0.7,
        router: 0.6,
        code: 0.5,
        judge: 0.4,
        vision: 0.3,
        embedding: 0.1,
      },
      vision: {
        vision: 0.9,
        general: 0.6,
        reasoning: 0.5,
        code: 0.4,
        router: 0.3,
        judge: 0.2,
        embedding: 0.1,
      },
      embedding: {
        embedding: 0.9,
        general: 0.3,
        router: 0.2,
        code: 0.1,
        reasoning: 0.1,
        judge: 0.1,
        vision: 0.1,
      },
    }

    const taskScores = roleCapabilityMap[context.taskType]
    if (taskScores) {
      score = taskScores[profile.role] || 0.1
    }

    // Adjust for output complexity
    if (context.outputComplexity === 'high') {
      // Prefer models with higher structured output reliability
      score *= (1 + (profile.structuredOutputReliability || 0.5) * 0.3)
    }

    return Math.min(score, 1.0)
  }

  /**
   * Get role-based reliability score
   */
  private getRoleReliability(role: ModelRole): number {
    const reliabilityMap: Record<ModelRole, number> = {
      general: 0.8,
      code: 0.7,
      reasoning: 0.6,
      vision: 0.6,
      embedding: 0.9,
      router: 0.7,
      judge: 0.8,
    }

    return reliabilityMap[role] || 0.5
  }

  /**
   * Calculate total weighted score
   */
  private calculateTotalScore(
    componentScores: ProfileScore['componentScores'],
    weights: ScoringWeights
  ): number {
    return (
      componentScores.performance * weights.performance +
      componentScores.reliability * weights.reliability +
      componentScores.cost * weights.cost +
      componentScores.latency * weights.latency +
      componentScores.capability * weights.capability
    )
  }

  /**
   * Calculate confidence in the score
   */
  private calculateConfidence(
    componentScores: ProfileScore['componentScores'],
    context: ScoringContext
  ): number {
    // Higher confidence when scores are consistent and we have good data
    const scores = Object.values(componentScores)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length
    const consistency = 1 - Math.min(variance, 1) // Lower variance = higher consistency

    // Adjust confidence based on data availability
    let dataConfidence = 0.7 // Base confidence
    if (context.historicalPerformance) {
      dataConfidence = 0.9 // Higher confidence with historical data
    }

    return Math.min(consistency * dataConfidence, 1.0)
  }

  /**
   * Generate reasoning for the score
   */
  private generateReasoning(
    profile: ModelProfile,
    context: ScoringContext,
    componentScores: ProfileScore['componentScores']
  ): string[] {
    const reasoning: string[] = []

    // Performance reasoning
    if (componentScores.performance > 0.8) {
      reasoning.push(`Strong performance score (${profile.performanceScore?.toFixed(2)})`)
    } else if (componentScores.performance < 0.5) {
      reasoning.push(`Limited performance data (${profile.performanceScore?.toFixed(2)})`)
    }

    // Reliability reasoning
    if (componentScores.reliability > 0.8) {
      reasoning.push('High reliability for task requirements')
    } else if (componentScores.reliability < 0.5) {
      reasoning.push('Reliability concerns for critical tasks')
    }

    // Cost reasoning
    if (componentScores.cost > 0.8) {
      reasoning.push('Cost-effective choice')
    } else if (componentScores.cost < 0.4) {
      reasoning.push('Higher cost may impact budget')
    }

    // Latency reasoning
    if (context.realTimeRequired && componentScores.latency > 0.7) {
      reasoning.push('Suitable for real-time requirements')
    } else if (context.realTimeRequired && componentScores.latency < 0.5) {
      reasoning.push('May be too slow for real-time use')
    }

    // Capability reasoning
    if (componentScores.capability > 0.8) {
      reasoning.push(`Excellent capability match for ${context.taskType}`)
    } else if (componentScores.capability < 0.4) {
      reasoning.push('Limited capability for task requirements')
    }

    return reasoning
  }

  /**
   * Generate recommendations for profile usage
   */
  private generateRecommendations(
    profile: ModelProfile,
    context: ScoringContext,
    componentScores: ProfileScore['componentScores']
  ): string[] {
    const recommendations: string[] = []

    // Performance recommendations
    if (componentScores.performance < 0.6 && context.qualityCritical) {
      recommendations.push('Consider a model with better performance metrics for quality-critical tasks')
    }

    // Cost recommendations
    if (componentScores.cost < 0.5 && context.costSensitive) {
      recommendations.push('Higher costs may impact budget - consider cheaper alternatives')
    }

    // Latency recommendations
    if (context.realTimeRequired && componentScores.latency < 0.6) {
      recommendations.push('May not meet real-time requirements - consider faster models')
    }

    // Capability recommendations
    if (componentScores.capability < 0.5) {
      recommendations.push('Limited capability for this task type - consider specialized models')
    }

    // General recommendations
    if (componentScores.reliability > 0.8 && componentScores.performance > 0.7) {
      recommendations.push('Good choice for production workloads')
    }

    return recommendations
  }

  /**
   * Get scoring weights for different scenarios
   */
  getScenarioWeights(scenario: 'speed' | 'quality' | 'cost' | 'balanced'): ScoringWeights {
    switch (scenario) {
      case 'speed':
        return {
          performance: 0.2,
          reliability: 0.2,
          cost: 0.1,
          latency: 0.4, // High priority on latency
          capability: 0.1,
        }
      case 'quality':
        return {
          performance: 0.35, // High priority on performance
          reliability: 0.3,
          cost: 0.05,
          latency: 0.1,
          capability: 0.2,
        }
      case 'cost':
        return {
          performance: 0.15,
          reliability: 0.15,
          cost: 0.4, // High priority on cost
          latency: 0.15,
          capability: 0.15,
        }
      case 'balanced':
      default:
        return this.defaultWeights
    }
  }
}

// Singleton instance
export const profileScorer = new ProfileScorer()
