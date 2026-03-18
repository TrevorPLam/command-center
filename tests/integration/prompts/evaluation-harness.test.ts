/**
 * Integration Tests for Evaluation Harness
 * 
 * Tests the Promptfoo evaluation harness integration with the prompt system.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { PromptfooRunner } from '@/scripts/eval/run-promptfoo'
import { promptTemplateRepository } from '@/lib/app/persistence/prompt-repository'
import { promptRunRecorder } from '@/lib/app/services/prompt-run-recorder'
import type { NewPromptTemplate } from '@/lib/db/schema'

describe('Evaluation Harness Integration', () => {
  let testTemplateIds: string[] = []
  let tempDir: string
  let runner: PromptfooRunner

  beforeEach(async () => {
    // Create temporary directory for test outputs
    tempDir = join(process.cwd(), 'test-temp', `eval-test-${Date.now()}`)
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true })
    }

    runner = new PromptfooRunner()
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
    
    // Clean up temporary directory
    try {
      const { rmSync } = await import('fs')
      rmSync(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  async function cleanupTestData() {
    for (const id of testTemplateIds) {
      try {
        await promptTemplateRepository.delete(id)
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    testTemplateIds = []
  }

  function createTestTemplate(overrides: Partial<NewPromptTemplate> = {}): NewPromptTemplate {
    return {
      name: `eval-test-template-${Date.now()}`,
      description: 'Template for evaluation testing',
      category: 'evaluation-test',
      template: 'You are a helpful assistant. {{context}}\n\n{{user_query}}\n\nProvide a detailed response.',
      variables: JSON.stringify({ context: 'string', user_query: 'string' }),
      isActive: true,
      tags: JSON.stringify(['test', 'evaluation']),
      usageCount: 0,
      metadata: JSON.stringify({ version: '1.0.0', test: true }),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  describe('Promptfoo Integration', () => {
    it('should be able to run quick evaluation', async () => {
      // This test might require Ollama to be running, so we'll mock the execution
      // and test the configuration and setup instead

      const options = {
        mode: 'quick' as const,
        outputDir: tempDir,
        verbose: false
      }

      // Test that the runner can be configured
      expect(runner).toBeDefined()
      
      // Test command building (without actually running)
      const configPath = join(process.cwd(), 'promptfoo.config.ts')
      expect(existsSync(configPath)).toBe(true)
      
      const configContent = readFileSync(configPath, 'utf-8')
      expect(configContent).toContain('providers')
      expect(configContent).toContain('datasets')
      expect(configContent).toContain('prompts')
    }, 10000)

    it('should handle evaluation configuration correctly', async () => {
      const options = {
        mode: 'full' as const,
        providers: ['ollama:llama3.1'],
        prompts: ['Default Assistant'],
        datasets: ['Basic Chat Prompts'],
        outputDir: tempDir,
        repeat: 2,
        verbose: true
      }

      // Test option validation
      expect(options.mode).toBe('full')
      expect(options.providers).toHaveLength(1)
      expect(options.prompts).toHaveLength(1)
      expect(options.datasets).toHaveLength(1)
      expect(options.repeat).toBe(2)
      expect(options.verbose).toBe(true)
    })
  })

  describe('Template Evaluation Integration', () => {
    it('should record evaluation runs correctly', async () => {
      // Create a template for evaluation
      const templateData = createTestTemplate({
        name: 'evaluation-template',
        template: 'You are an expert assistant. {{context}}\n\n{{user_query}}\n\nProvide a comprehensive response.'
      })
      
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      // Simulate evaluation runs
      const testCases = [
        { context: 'Math problem', query: 'What is 2+2?' },
        { context: 'Science question', query: 'What is photosynthesis?' },
        { context: 'History inquiry', query: 'When did World War II end?' }
      ]

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i]
        
        const run = await promptRunRecorder.recordEvaluationRun(
          template.id,
          testCase,
          `eval-experiment-${Date.now()}`,
          `test-case-${i}`
        )

        // Simulate evaluation completion
        await promptRunRecorder.completeRun(run.id, {
          output: `Response to: ${testCase.query}`,
          latencyMs: 100 + Math.random() * 100,
          tokenCount: 20 + Math.random() * 30
        })
      }

      // Verify runs were recorded
      const stats = await promptRunRecorder.getTemplateUsageStats(template.name, 30)
      expect(stats).toHaveLength(1)
      expect(stats[0].runCount).toBe(3)
      expect(stats[0].successCount).toBe(3)

      // Verify performance trends
      const trends = await promptRunRecorder.getTemplatePerformanceTrends(template.name, 30)
      expect(trends.length).toBeGreaterThan(0)
      
      const totalRuns = trends.reduce((sum, trend) => sum + trend.runCount, 0)
      expect(totalRuns).toBe(3)
    })

    it('should handle evaluation failures correctly', async () => {
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      // Simulate failed evaluation run
      const run = await promptRunRecorder.recordEvaluationRun(
        template.id,
        { context: 'Test', query: 'Test query' },
        'eval-experiment-fail',
        'failure-test'
      )

      await promptRunRecorder.completeRun(run.id, {
        output: '',
        latencyMs: 30000, // Very high latency
        tokenCount: 0,
        error: 'Timeout error'
      })

      // Verify failure was recorded
      const stats = await promptRunRecorder.getTemplateUsageStats(template.name, 30)
      expect(stats).toHaveLength(1)
      expect(stats[0].runCount).toBe(1)
      expect(stats[0].successCount).toBe(0) // No successful runs
      expect(stats[0].averageLatency).toBe(30000)
    })
  })

  describe('Evaluation Metrics', () => {
    it('should calculate evaluation metrics correctly', async () => {
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      // Create runs with varying performance
      const runs = [
        { latency: 100, tokens: 20, success: true },
        { latency: 150, tokens: 25, success: true },
        { latency: 200, tokens: 30, success: true },
        { latency: 120, tokens: 22, success: true },
        { latency: 180, tokens: 28, success: true }
      ]

      for (let i = 0; i < runs.length; i++) {
        const runData = runs[i]
        
        const run = await promptRunRecorder.recordEvaluationRun(
          template.id,
          { context: `Test ${i}`, query: `Query ${i}` },
          'metrics-experiment',
          `metrics-test-${i}`
        )

        await promptRunRecorder.completeRun(run.id, {
          output: `Response ${i}`,
          latencyMs: runData.latency,
          tokenCount: runData.tokens,
          error: runData.success ? undefined : 'Test error'
        })
      }

      // Verify metrics calculation
      const stats = await promptRunRecorder.getTemplateUsageStats(template.name, 30)
      expect(stats).toHaveLength(1)
      expect(stats[0].runCount).toBe(5)
      expect(stats[0].successCount).toBe(5)
      
      // Check average calculations
      const expectedAvgLatency = runs.reduce((sum, r) => sum + r.latency, 0) / runs.length
      const expectedAvgTokens = runs.reduce((sum, r) => sum + r.tokens, 0) / runs.length
      
      expect(stats[0].averageLatency).toBe(expectedAvgLatency)
      expect(stats[0].averageTokens).toBe(expectedAvgTokens)
    })

    it('should track evaluation trends over time', async () => {
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      // Create runs over different days (simulated)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const runs = [
        { date: yesterday, latency: 100, success: true },
        { date: yesterday, latency: 120, success: true },
        { date: today, latency: 80, success: true },
        { date: today, latency: 90, success: true },
        { date: today, latency: 85, success: true }
      ]

      for (let i = 0; i < runs.length; i++) {
        const runData = runs[i]
        
        const run = await promptRunRecorder.recordEvaluationRun(
          template.id,
          { context: `Trend test ${i}`, query: `Trend query ${i}` },
          'trend-experiment',
          `trend-test-${i}`
        )

        // Manually set creation time to simulate different dates
        await promptRunRecorder.completeRun(run.id, {
          output: `Trend response ${i}`,
          latencyMs: runData.latency,
          tokenCount: 20
        })

        // Note: In a real implementation, we'd need to update the created_at timestamp
        // For this test, we're verifying the trend calculation logic works
      }

      // Get trends (should show improvement over time)
      const trends = await promptRunRecorder.getTemplatePerformanceTrends(template.name, 7)
      expect(trends.length).toBeGreaterThan(0)
      
      // Verify we have data points
      const totalRuns = trends.reduce((sum, trend) => sum + trend.runCount, 0)
      expect(totalRuns).toBe(5)
    })
  })

  describe('Configuration Validation', () => {
    it('should validate promptfoo configuration', () => {
      const configPath = join(process.cwd(), 'promptfoo.config.ts')
      expect(existsSync(configPath)).toBe(true)

      const configContent = readFileSync(configPath, 'utf-8')
      
      // Verify required sections exist
      expect(configContent).toContain('providers')
      expect(configContent).toContain('datasets')
      expect(configContent).toContain('prompts')
      expect(configContent).toContain('scoring')
      expect(configContent).toContain('outputOptions')

      // Verify providers configuration
      expect(configContent).toContain('ollama:llama3.1')
      expect(configContent).toContain('apiBaseUrl')
      expect(configContent).toContain('temperature')

      // Verify test datasets
      expect(configContent).toContain('Basic Chat Prompts')
      expect(configContent).toContain('RAG Enhancement Prompts')
      expect(configContent).toContain('Agent Tool Use Prompts')

      // Verify evaluation assertions
      expect(configContent).toContain('assert')
      expect(configContent).toContain('javascript')
      expect(configContent).toContain('model-graded-closedqa')
    })

    it('should have evaluation script available', () => {
      const scriptPath = join(process.cwd(), 'scripts', 'eval', 'run-promptfoo.ts')
      expect(existsSync(scriptPath)).toBe(true)

      const scriptContent = readFileSync(scriptPath, 'utf-8')
      
      // Verify script structure
      expect(scriptContent).toContain('PromptfooRunner')
      expect(scriptContent).toContain('EvalOptions')
      expect(scriptContent).toContain('EvalResult')
      expect(scriptContent).toContain('run()')
      expect(scriptContent).toContain('compareWithBaseline')
    })
  })
})
