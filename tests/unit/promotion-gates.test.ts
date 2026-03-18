/**
 * Unit Tests for Promotion Gates Service
 * 
 * Tests for automated promotion gates with blocker/guardrail/target categories.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promotionGatesService, type GateRule, type PromotionConfig } from '@/lib/app/services/promotion-gates'

// Mock the dependencies
vi.mock('@/lib/app/services/prompt-run-recorder')
vi.mock('@/lib/app/persistence/prompt-repository')
vi.mock('@/lib/app/persistence/experiment-repository')

describe('PromotionGatesService', () => {
  let testRules: GateRule[] = []

  beforeEach(() => {
    // Clear any existing rules and add test rules
    testRules = [
      {
        id: 'test-blocker',
        name: 'Test Blocker Rule',
        description: 'A blocker rule for testing',
        category: 'blocker',
        metric: 'test_metric',
        operator: 'gte',
        threshold: 80,
        required: true,
        enabled: true
      },
      {
        id: 'test-guardrail',
        name: 'Test Guardrail Rule',
        description: 'A guardrail rule for testing',
        category: 'guardrail',
        metric: 'test_metric_2',
        operator: 'lte',
        threshold: 20,
        required: false,
        gracePeriod: 7,
        enabled: true
      },
      {
        id: 'test-target',
        name: 'Test Target Rule',
        description: 'A target rule for testing',
        category: 'target',
        metric: 'test_metric_3',
        operator: 'gt',
        threshold: 50,
        required: false,
        enabled: true
      }
    ]

    // Add test rules
    testRules.forEach(rule => promotionGatesService.addRule(rule))
  })

  afterEach(() => {
    // Clean up test rules
    testRules.forEach(rule => promotionGatesService.removeRule(rule.id))
  })

  describe('Rule Management', () => {
    it('should add and retrieve rules', () => {
      const newRule: GateRule = {
        id: 'new-rule',
        name: 'New Rule',
        description: 'A new test rule',
        category: 'blocker',
        metric: 'new_metric',
        operator: 'eq',
        threshold: 100,
        required: true,
        enabled: true
      }

      promotionGatesService.addRule(newRule)
      
      const rules = promotionGatesService.getRules()
      expect(rules).toContainEqual(newRule)
      
      promotionGatesService.removeRule('new-rule')
    })

    it('should get rules by category', () => {
      const blockerRules = promotionGatesService.getRulesByCategory('blocker')
      const guardrailRules = promotionGatesService.getRulesByCategory('guardrail')
      const targetRules = promotionGatesService.getRulesByCategory('target')

      expect(blockerRules).toHaveLength(1)
      expect(blockerRules[0].category).toBe('blocker')
      
      expect(guardrailRules).toHaveLength(1)
      expect(guardrailRules[0].category).toBe('guardrail')
      
      expect(targetRules).toHaveLength(1)
      expect(targetRules[0].category).toBe('target')
    })

    it('should remove rules', () => {
      const initialCount = promotionGatesService.getRules().length
      
      promotionGatesService.removeRule('test-blocker')
      
      const finalCount = promotionGatesService.getRules().length
      expect(finalCount).toBe(initialCount - 1)
      
      const remainingRule = promotionGatesService.getRules().find(r => r.id === 'test-blocker')
      expect(remainingRule).toBeUndefined()
    })
  })

  describe('Rule Evaluation', () => {
    it('should evaluate gte operator correctly', async () => {
      const rule = testRules.find(r => r.id === 'test-blocker')!
      const metrics = { test_metric: 85 }
      
      // Mock the private method for testing
      const service = promotionGatesService as any
      const result = await service.evaluateRule(rule, metrics)
      
      expect(result.status).toBe('passed')
      expect(result.actualValue).toBe(85)
      expect(result.message).toContain('✓')
    })

    it('should evaluate lte operator correctly', async () => {
      const rule = testRules.find(r => r.id === 'test-guardrail')!
      const metrics = { test_metric_2: 15 }
      
      const service = promotionGatesService as any
      const result = await service.evaluateRule(rule, metrics)
      
      expect(result.status).toBe('passed')
      expect(result.actualValue).toBe(15)
    })

    it('should evaluate gt operator correctly', async () => {
      const rule = testRules.find(r => r.id === 'test-target')!
      const metrics = { test_metric_3: 75 }
      
      const service = promotionGatesService as any
      const result = await service.evaluateRule(rule, metrics)
      
      expect(result.status).toBe('passed')
      expect(result.actualValue).toBe(75)
    })

    it('should fail evaluation when threshold not met', async () => {
      const rule = testRules.find(r => r.id === 'test-blocker')!
      const metrics = { test_metric: 75 } // Below threshold of 80
      
      const service = promotionGatesService as any
      const result = await service.evaluateRule(rule, metrics)
      
      expect(result.status).toBe('failed')
      expect(result.actualValue).toBe(75)
      expect(result.message).toContain('✗')
    })

    it('should skip evaluation for missing metrics', async () => {
      const rule = testRules.find(r => r.id === 'test-blocker')!
      const metrics = {} // Missing test_metric
      
      const service = promotionGatesService as any
      const result = await service.evaluateRule(rule, metrics)
      
      expect(result.status).toBe('skipped')
      expect(result.message).toContain('not found')
    })

    it('should show warning for guardrail regressions', async () => {
      const rule = testRules.find(r => r.id === 'test-guardrail')!
      const metrics = { test_metric_2: 25 } // Above threshold of 20
      const baselineMetrics = { test_metric_2: 20 } // Same as threshold
      
      const service = promotionGatesService as any
      const result = await service.evaluateRule(rule, metrics, baselineMetrics)
      
      expect(result.status).toBe('warning')
      expect(result.message).toContain('⚠')
      expect(result.details?.regression).toBe(5)
    })

    it('should handle all operators correctly', async () => {
      const operators = [
        { op: 'eq' as const, value: 100, threshold: 100, expected: 'passed' },
        { op: 'ne' as const, value: 100, threshold: 90, expected: 'passed' },
        { op: 'lt' as const, value: 50, threshold: 100, expected: 'passed' },
        { op: 'lte' as const, value: 100, threshold: 100, expected: 'passed' },
        { op: 'gt' as const, value: 150, threshold: 100, expected: 'passed' },
        { op: 'gte' as const, value: 100, threshold: 100, expected: 'passed' }
      ]

      const service = promotionGatesService as any

      for (const { op, value, threshold, expected } of operators) {
        const rule: GateRule = {
          id: `test-${op}`,
          name: `Test ${op}`,
          description: `Test ${op} operator`,
          category: 'blocker',
          metric: `test_${op}`,
          operator: op,
          threshold,
          required: true,
          enabled: true
        }

        const metrics = { [`test_${op}`]: value }
        const result = await service.evaluateRule(rule, metrics)

        expect(result.status).toBe(expected)
      }
    })
  })

  describe('Gate Execution', () => {
    it('should run gates with all categories', async () => {
      // Mock the metrics collection
      const mockMetrics = {
        test_metric: 85,      // Passes blocker
        test_metric_2: 15,    // Passes guardrail
        test_metric_3: 75     // Passes target
      }

      const service = promotionGatesService as any
      vi.spyOn(service, 'collectMetrics').mockResolvedValue(mockMetrics)

      const config: PromotionConfig = {
        environment: 'production',
        requiredCategories: ['blocker', 'guardrail', 'target'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await service.runGates('test-template-id', config)

      expect(result.overallStatus).toBe('passed')
      expect(result.results).toHaveLength(3)
      expect(result.summary.blockers.failed).toBe(0)
      expect(result.summary.guardrails.failed).toBe(0)
      expect(result.recommendation).toBe('promote')
    })

    it('should fail when blocker rules fail', async () => {
      const mockMetrics = {
        test_metric: 75,      // Fails blocker (< 80)
        test_metric_2: 15,    // Passes guardrail
        test_metric_3: 75     // Passes target
      }

      const service = promotionGatesService as any
      vi.spyOn(service, 'collectMetrics').mockResolvedValue(mockMetrics)

      const config: PromotionConfig = {
        environment: 'production',
        requiredCategories: ['blocker'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await service.runGates('test-template-id', config)

      expect(result.overallStatus).toBe('failed')
      expect(result.summary.blockers.failed).toBe(1)
      expect(result.recommendation).toBe('hold')
    })

    it('should show warning for guardrail failures in production', async () => {
      const mockMetrics = {
        test_metric: 85,      // Passes blocker
        test_metric_2: 25,    // Fails guardrail (> 20)
        test_metric_3: 75     // Passes target
      }

      const service = promotionGatesService as any
      vi.spyOn(service, 'collectMetrics').mockResolvedValue(mockMetrics)

      const config: PromotionConfig = {
        environment: 'production',
        requiredCategories: ['blocker', 'guardrail'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await service.runGates('test-template-id', config)

      expect(result.overallStatus).toBe('failed') // Production requires guardrails to pass
      expect(result.summary.guardrails.failed).toBe(1)
      expect(result.recommendation).toBe('hold')
    })

    it('should allow guardrail warnings in staging', async () => {
      const mockMetrics = {
        test_metric: 85,      // Passes blocker
        test_metric_2: 25,    // Fails guardrail (> 20)
        test_metric_3: 75     // Passes target
      }

      const service = promotionGatesService as any
      vi.spyOn(service, 'collectMetrics').mockResolvedValue(mockMetrics)

      const config: PromotionConfig = {
        environment: 'staging',
        requiredCategories: ['blocker', 'guardrail'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await service.runGates('test-template-id', config)

      expect(result.overallStatus).toBe('passed') // Staging allows guardrail warnings
      expect(result.summary.guardrails.failed).toBe(1)
      expect(result.recommendation).toBe('promote')
    })

    it('should calculate confidence correctly', async () => {
      const mockMetrics = {
        test_metric: 85,
        test_metric_2: 15,
        test_metric_3: 75,
        total_runs: 150 // High data volume
      }

      const service = promotionGatesService as any
      vi.spyOn(service, 'collectMetrics').mockResolvedValue(mockMetrics)

      const config: PromotionConfig = {
        environment: 'dev',
        requiredCategories: ['blocker'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await service.runGates('test-template-id', config)

      expect(result.confidence).toBeGreaterThan(80) // High confidence due to data volume
      expect(result.confidence).toBeLessThanOrEqual(100)
    })

    it('should handle empty metrics gracefully', async () => {
      const service = promotionGatesService as any
      vi.spyOn(service, 'collectMetrics').mockResolvedValue({})

      const config: PromotionConfig = {
        environment: 'dev',
        requiredCategories: ['blocker'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await service.runGates('test-template-id', config)

      expect(result.confidence).toBe(0) // No confidence with no data
      expect(result.results.every(r => r.status === 'skipped')).toBe(true)
    })
  })

  describe('Gate History', () => {
    it('should store and retrieve gate history', async () => {
      const mockMetrics = {
        test_metric: 85,
        test_metric_2: 15,
        test_metric_3: 75
      }

      const service = promotionGatesService as any
      vi.spyOn(service, 'collectMetrics').mockResolvedValue(mockMetrics)

      const config: PromotionConfig = {
        environment: 'dev',
        requiredCategories: ['blocker'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      // Run gates multiple times
      await service.runGates('test-template-id', config)
      await service.runGates('test-template-id', config)

      const history = service.getGateHistory('test-template-id')

      expect(history).toHaveLength(2)
      expect(history[0].promptVersion).toBe('test-template-id')
      expect(history[1].promptVersion).toBe('test-template-id')
    })

    it('should clear gate history', async () => {
      const mockMetrics = { test_metric: 85 }

      const service = promotionGatesService as any
      vi.spyOn(service, 'collectMetrics').mockResolvedValue(mockMetrics)

      const config: PromotionConfig = {
        environment: 'dev',
        requiredCategories: ['blocker'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      // Add history
      await service.runGates('test-template-id', config)
      expect(service.getGateHistory('test-template-id')).toHaveLength(1)

      // Clear specific template history
      service.clearGateHistory('test-template-id')
      expect(service.getGateHistory('test-template-id')).toHaveLength(0)

      // Add history again and clear all
      await service.runGates('test-template-id', config)
      service.clearGateHistory()
      expect(service.getGateHistory('test-template-id')).toHaveLength(0)
    })
  })

  describe('Summary Calculation', () => {
    it('should calculate summary correctly', async () => {
      const service = promotionGatesService as any
      
      // Mock results with different statuses
      const mockResults = [
        { rule: { category: 'blocker' }, status: 'passed' },
        { rule: { category: 'blocker' }, status: 'passed' },
        { rule: { category: 'guardrail' }, status: 'passed' },
        { rule: { category: 'guardrail' }, status: 'warning' },
        { rule: { category: 'target' }, status: 'passed' },
        { rule: { category: 'target' }, status: 'failed' }
      ]

      const summary = service.calculateSummary(mockResults)

      expect(summary.blockers).toEqual({ passed: 2, failed: 0 })
      expect(summary.guardrails).toEqual({ passed: 1, failed: 0, warnings: 1 })
      expect(summary.targets).toEqual({ passed: 1, failed: 1, improved: 0 })
    })
  })

  describe('Recommendation Logic', () => {
    it('should recommend promote for all-passed gates', async () => {
      const service = promotionGatesService as any
      
      const summary = {
        blockers: { passed: 3, failed: 0 },
        guardrails: { passed: 2, failed: 0, warnings: 0 },
        targets: { passed: 2, failed: 0, improved: 1 }
      }

      const config: PromotionConfig = {
        environment: 'production',
        requiredCategories: ['blocker', 'guardrail', 'target'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const recommendation = service.determineRecommendation('passed', summary, config)
      expect(recommendation).toBe('promote')
    })

    it('should recommend hold for failed blockers', async () => {
      const service = promotionGatesService as any
      
      const summary = {
        blockers: { passed: 2, failed: 1 },
        guardrails: { passed: 2, failed: 0, warnings: 0 },
        targets: { passed: 2, failed: 0, improved: 1 }
      }

      const config: PromotionConfig = {
        environment: 'production',
        requiredCategories: ['blocker', 'guardrail', 'target'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const recommendation = service.determineRecommendation('failed', summary, config)
      expect(recommendation).toBe('hold')
    })

    it('should recommend investigate for warnings', async () => {
      const service = promotionGatesService as any
      
      const summary = {
        blockers: { passed: 3, failed: 0 },
        guardrails: { passed: 0, failed: 0, warnings: 4 }, // Many warnings
        targets: { passed: 2, failed: 0, improved: 1 }
      }

      const config: PromotionConfig = {
        environment: 'production',
        requiredCategories: ['blocker', 'guardrail', 'target'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const recommendation = service.determineRecommendation('warning', summary, config)
      expect(recommendation).toBe('investigate')
    })
  })
})
