/**
 * Promotion Gates Service
 * 
 * Implements automated promotion gates with blocker/guardrail/target categories
 * following 2026 best practices for prompt evaluation and release safety.
 */

import { z } from 'zod'
import { promptRunRecorder } from '@/lib/app/services/prompt-run-recorder'
import { promptTemplateRepository } from '@/lib/app/persistence/prompt-repository'
import { experimentRepository } from '@/lib/app/persistence/experiment-repository'
import type { PromptTemplate, PromptRun } from '@/lib/db/schema'

// Types for promotion gates
export type GateCategory = 'blocker' | 'guardrail' | 'target'
export type GateStatus = 'passed' | 'failed' | 'warning' | 'skipped'

export interface GateRule {
  id: string
  name: string
  description: string
  category: GateCategory
  metric: string
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne'
  threshold: number
  required: boolean // true for blockers, false for guardrails/targets
  gracePeriod?: number // days
  enabled: boolean
}

export interface GateResult {
  rule: GateRule
  status: GateStatus
  actualValue: number
  threshold: number
  message: string
  details?: Record<string, any>
}

export interface PromotionGateResult {
  gateId: string
  timestamp: Date
  promptVersion: string
  baselineVersion?: string
  overallStatus: 'passed' | 'failed' | 'warning'
  results: GateResult[]
  summary: {
    blockers: { passed: number; failed: number }
    guardrails: { passed: number; failed: number; warnings: number }
    targets: { passed: number; failed: number; improved: number }
  }
  recommendation: 'promote' | 'hold' | 'rollback' | 'investigate'
  confidence: number // 0-100
}

export interface PromotionConfig {
  environment: 'dev' | 'staging' | 'production'
  requiredCategories: GateCategory[]
  overrideWarnings: boolean
  shadowMode: boolean
  canaryMode: boolean
  canaryTrafficPercentage: number
  rolloutDuration: number // hours
}

// Default gate rules based on 2026 best practices
const DEFAULT_GATE_RULES: GateRule[] = [
  // Blockers - must never regress
  {
    id: 'schema-validation-pass-rate',
    name: 'Schema Validation Pass Rate',
    description: 'Percentage of responses that validate against expected schema',
    category: 'blocker',
    metric: 'schema_validation_pass_rate',
    operator: 'gte',
    threshold: 95,
    required: true,
    enabled: true
  },
  {
    id: 'safety-failure-rate',
    name: 'Safety Failure Rate',
    description: 'Percentage of responses flagged for safety violations',
    category: 'blocker',
    metric: 'safety_failure_rate',
    operator: 'lte',
    threshold: 1,
    required: true,
    enabled: true
  },
  {
    id: 'tool-call-validity',
    name: 'Tool Call Validity',
    description: 'Percentage of tool calls that are valid and executable',
    category: 'blocker',
    metric: 'tool_call_validity_rate',
    operator: 'gte',
    threshold: 98,
    required: true,
    enabled: true
  },
  {
    id: 'response-timeout-rate',
    name: 'Response Timeout Rate',
    description: 'Percentage of requests that timeout',
    category: 'blocker',
    metric: 'timeout_rate',
    operator: 'lte',
    threshold: 2,
    required: true,
    enabled: true
  },

  // Guardrails - small drift allowed
  {
    id: 'verbosity-score',
    name: 'Verbosity Score',
    description: 'Average response length relative to baseline',
    category: 'guardrail',
    metric: 'verbosity_ratio',
    operator: 'lte',
    threshold: 1.5,
    required: false,
    gracePeriod: 7,
    enabled: true
  },
  {
    id: 'formatting-consistency',
    name: 'Formatting Consistency',
    description: 'Consistency of formatting with expected structure',
    category: 'guardrail',
    metric: 'formatting_consistency_rate',
    operator: 'gte',
    threshold: 85,
    required: false,
    gracePeriod: 3,
    enabled: true
  },
  {
    id: 'tone-consistency',
    name: 'Tone Consistency',
    description: 'Consistency of tone with brand guidelines',
    category: 'guardrail',
    metric: 'tone_consistency_score',
    operator: 'gte',
    threshold: 80,
    required: false,
    gracePeriod: 5,
    enabled: true
  },

  // Targets - want to improve
  {
    id: 'task-success-rate',
    name: 'Task Success Rate',
    description: 'Percentage of tasks completed successfully',
    category: 'target',
    metric: 'task_success_rate',
    operator: 'gte',
    threshold: 85,
    required: false,
    enabled: true
  },
  {
    id: 'user-satisfaction',
    name: 'User Satisfaction',
    description: 'Average user satisfaction score',
    category: 'target',
    metric: 'user_satisfaction_score',
    operator: 'gte',
    threshold: 4.0,
    required: false,
    enabled: true
  },
  {
    id: 'cost-efficiency',
    name: 'Cost Efficiency',
    description: 'Cost per successful completion relative to baseline',
    category: 'target',
    metric: 'cost_efficiency_ratio',
    operator: 'lte',
    threshold: 1.1,
    required: false,
    enabled: true
  },
  {
    id: 'latency-target',
    name: 'Latency Target',
    description: 'Average response time in milliseconds',
    category: 'target',
    metric: 'avg_latency_ms',
    operator: 'lte',
    threshold: 2000,
    required: false,
    enabled: true
  }
]

export class PromotionGatesService {
  private rules: Map<string, GateRule> = new Map()
  private gateHistory: Map<string, PromotionGateResult[]> = new Map()

  constructor() {
    // Initialize default rules
    DEFAULT_GATE_RULES.forEach(rule => {
      this.rules.set(rule.id, rule)
    })
  }

  /**
   * Add or update a gate rule
   */
  addRule(rule: GateRule): void {
    this.rules.set(rule.id, rule)
  }

  /**
   * Remove a gate rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId)
  }

  /**
   * Get all rules
   */
  getRules(): GateRule[] {
    return Array.from(this.rules.values())
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: GateCategory): GateRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.category === category)
  }

  /**
   * Evaluate a single gate rule
   */
  private async evaluateRule(
    rule: GateRule,
    metrics: Record<string, number>,
    baselineMetrics?: Record<string, number>
  ): Promise<GateResult> {
    const actualValue = metrics[rule.metric]
    const baselineValue = baselineMetrics?.[rule.metric]

    if (actualValue === undefined) {
      return {
        rule,
        status: 'skipped',
        actualValue: 0,
        threshold: rule.threshold,
        message: `Metric ${rule.metric} not found in evaluation data`
      }
    }

    let passed = false
    switch (rule.operator) {
      case 'gt': passed = actualValue > rule.threshold; break
      case 'gte': passed = actualValue >= rule.threshold; break
      case 'lt': passed = actualValue < rule.threshold; break
      case 'lte': passed = actualValue <= rule.threshold; break
      case 'eq': passed = actualValue === rule.threshold; break
      case 'ne': passed = actualValue !== rule.threshold; break
    }

    let status: GateStatus = passed ? 'passed' : 'failed'
    let message = passed 
      ? `✓ ${rule.name}: ${actualValue.toFixed(2)} ${rule.operator} ${rule.threshold}`
      : `✗ ${rule.name}: ${actualValue.toFixed(2)} not ${rule.operator} ${rule.threshold}`

    // Check grace period for non-blockers
    if (!rule.required && baselineValue !== undefined && !passed) {
      const regression = actualValue - baselineValue
      const regressionPercent = (regression / baselineValue) * 100
      
      if (Math.abs(regressionPercent) < 10) { // Less than 10% regression
        status = 'warning'
        message = `⚠ ${rule.name}: ${actualValue.toFixed(2)} shows ${regressionPercent.toFixed(1)}% regression from baseline ${baselineValue.toFixed(2)}`
      }
    }

    return {
      rule,
      status,
      actualValue,
      threshold: rule.threshold,
      message,
      details: {
        baseline: baselineValue,
        regression: baselineValue ? actualValue - baselineValue : undefined
      }
    }
  }

  /**
   * Collect metrics from prompt runs
   */
  private async collectMetrics(
    templateId: string,
    days: number = 7
  ): Promise<Record<string, number>> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    const runs = await promptRunRepository.getByTemplateId(templateId, 1000)
    const recentRuns = runs.filter(run => new Date(run.createdAt) > cutoffDate)

    if (recentRuns.length === 0) {
      return {}
    }

    const completedRuns = recentRuns.filter(run => run.status === 'completed')
    
    // Calculate metrics from actual run data
    const metrics: Record<string, number> = {
      total_runs: recentRuns.length,
      completed_runs: completedRuns.length,
      success_rate: (completedRuns.length / recentRuns.length) * 100,
      avg_latency_ms: completedRuns.reduce((sum, run) => sum + (run.latencyMs || 0), 0) / completedRuns.length,
      avg_tokens: completedRuns.reduce((sum, run) => sum + (run.tokenCount || 0), 0) / completedRuns.length
    }

    // Parse metadata for additional metrics
    completedRuns.forEach(run => {
      try {
        const metadata = run.metadata ? JSON.parse(run.metadata) : {}
        
        // Extract common metrics from metadata
        if (metadata.schemaValidationPassRate !== undefined) {
          metrics.schema_validation_pass_rate = metadata.schemaValidationPassRate
        }
        if (metadata.safetyFailureRate !== undefined) {
          metrics.safety_failure_rate = metadata.safetyFailureRate
        }
        if (metadata.toolCallValidityRate !== undefined) {
          metrics.tool_call_validity_rate = metadata.toolCallValidityRate
        }
        if (metadata.timeoutRate !== undefined) {
          metrics.timeout_rate = metadata.timeoutRate
        }
        if (metadata.verbosityRatio !== undefined) {
          metrics.verbosity_ratio = metadata.verbosityRatio
        }
        if (metadata.formattingConsistencyRate !== undefined) {
          metrics.formatting_consistency_rate = metadata.formattingConsistencyRate
        }
        if (metadata.toneConsistencyScore !== undefined) {
          metrics.tone_consistency_score = metadata.toneConsistencyScore
        }
        if (metadata.taskSuccessRate !== undefined) {
          metrics.task_success_rate = metadata.taskSuccessRate
        }
        if (metadata.userSatisfactionScore !== undefined) {
          metrics.user_satisfaction_score = metadata.userSatisfactionScore
        }
        if (metadata.costEfficiencyRatio !== undefined) {
          metrics.cost_efficiency_ratio = metadata.costEfficiencyRatio
        }
      } catch (error) {
        console.warn('Failed to parse metadata for run:', run.id, error)
      }
    })

    return metrics
  }

  /**
   * Run promotion gates for a prompt template
   */
  async runGates(
    templateId: string,
    config: PromotionConfig,
    baselineTemplateId?: string
  ): Promise<PromotionGateResult> {
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled)
    
    // Skip categories not required for environment
    const relevantRules = enabledRules.filter(rule => 
      config.requiredCategories.includes(rule.category) || !rule.required
    )

    // Collect metrics for current and baseline
    const [metrics, baselineMetrics] = await Promise.all([
      this.collectMetrics(templateId),
      baselineTemplateId ? this.collectMetrics(baselineTemplateId) : Promise.resolve(undefined)
    ])

    // Evaluate all rules
    const results: GateResult[] = []
    for (const rule of relevantRules) {
      const result = await this.evaluateRule(rule, metrics, baselineMetrics)
      results.push(result)
    }

    // Calculate summary
    const summary = this.calculateSummary(results)

    // Determine overall status and recommendation
    const overallStatus = this.determineOverallStatus(summary, config)
    const recommendation = this.determineRecommendation(overallStatus, summary, config)
    const confidence = this.calculateConfidence(results, metrics)

    const gateResult: PromotionGateResult = {
      gateId: `gate_${Date.now()}`,
      timestamp: new Date(),
      promptVersion: templateId,
      baselineVersion: baselineTemplateId,
      overallStatus,
      results,
      summary,
      recommendation,
      confidence
    }

    // Store gate result
    const history = this.gateHistory.get(templateId) || []
    history.push(gateResult)
    this.gateHistory.set(templateId, history)

    return gateResult
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: GateResult[]) {
    const summary = {
      blockers: { passed: 0, failed: 0 },
      guardrails: { passed: 0, failed: 0, warnings: 0 },
      targets: { passed: 0, failed: 0, improved: 0 }
    }

    results.forEach(result => {
      switch (result.rule.category) {
        case 'blocker':
          if (result.status === 'passed') summary.blockers.passed++
          else summary.blockers.failed++
          break
        case 'guardrail':
          if (result.status === 'passed') summary.guardrails.passed++
          else if (result.status === 'failed') summary.guardrails.failed++
          else if (result.status === 'warning') summary.guardrails.warnings++
          break
        case 'target':
          if (result.status === 'passed') summary.targets.passed++
          else summary.targets.failed++
          
          // Check if it's an improvement over baseline
          if (result.details?.regression !== undefined && result.details.regression < 0) {
            summary.targets.improved++
          }
          break
      }
    })

    return summary
  }

  /**
   * Determine overall status
   */
  private determineOverallStatus(summary: any, config: PromotionConfig): 'passed' | 'failed' | 'warning' {
    // Blockers must always pass
    if (summary.blockers.failed > 0) {
      return 'failed'
    }

    // Check guardrails for production
    if (config.environment === 'production' && summary.guardrails.failed > 0) {
      return 'failed'
    }

    // Warnings for significant guardrail issues
    if (summary.guardrails.warnings > 3) {
      return 'warning'
    }

    return 'passed'
  }

  /**
   * Determine recommendation
   */
  private determineRecommendation(
    overallStatus: string,
    summary: any,
    config: PromotionConfig
  ): 'promote' | 'hold' | 'rollback' | 'investigate' {
    if (overallStatus === 'failed') {
      return 'hold'
    }

    if (overallStatus === 'warning') {
      return 'investigate'
    }

    // Check if targets are improving
    if (summary.targets.improved < summary.targets.passed / 2) {
      return 'hold' // Not enough improvement
    }

    if (config.shadowMode) {
      return 'promote' // Safe to promote in shadow mode
    }

    if (config.canaryMode) {
      return 'promote' // Safe to promote as canary
    }

    return 'promote'
  }

  /**
   * Calculate confidence in the results
   */
  private calculateConfidence(results: GateResult[], metrics: Record<string, number>): number {
    if (Object.keys(metrics).length === 0) {
      return 0
    }

    // Base confidence on data volume
    const dataVolume = metrics.total_runs || 0
    let confidence = Math.min((dataVolume / 100) * 100, 80) // Max 80% from volume

    // Adjust based on rule coverage
    const coveredMetrics = results.length
    const expectedMetrics = 10 // Expected number of metrics
    confidence += Math.min((coveredMetrics / expectedMetrics) * 20, 20) // Add up to 20%

    return Math.min(confidence, 100)
  }

  /**
   * Get gate history for a template
   */
  getGateHistory(templateId: string): PromotionGateResult[] {
    return this.gateHistory.get(templateId) || []
  }

  /**
   * Clear gate history
   */
  clearGateHistory(templateId?: string): void {
    if (templateId) {
      this.gateHistory.delete(templateId)
    } else {
      this.gateHistory.clear()
    }
  }
}

// Export singleton instance
export const promotionGatesService = new PromotionGatesService()
