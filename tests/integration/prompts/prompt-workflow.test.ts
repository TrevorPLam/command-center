/**
 * Integration Tests for Prompt Workflow
 * 
 * Tests the complete prompt template lifecycle including creation,
 * versioning, evaluation, and promotion gates.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { promptTemplateRepository } from '@/lib/app/persistence/prompt-repository'
import { experimentRepository } from '@/lib/app/persistence/experiment-repository'
import { promptRunRecorder } from '@/lib/app/services/prompt-run-recorder'
import { promotionGatesService } from '@/lib/app/services/promotion-gates'
import { createPromptTemplate, createPromptVersion } from '@/app/actions/prompts'
import type { NewPromptTemplate } from '@/lib/db/schema'

describe('Prompt Workflow Integration', () => {
  let testTemplateIds: string[] = []
  let testExperimentIds: string[] = []

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  async function cleanupTestData() {
    // Clean up test templates
    for (const id of testTemplateIds) {
      try {
        await promptTemplateRepository.delete(id)
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    // Clean up test experiments
    for (const id of testExperimentIds) {
      try {
        await experimentRepository.delete(id)
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    testTemplateIds = []
    testExperimentIds = []
  }

  function createTestTemplate(overrides: Partial<NewPromptTemplate> = {}): NewPromptTemplate {
    return {
      name: `test-template-${Date.now()}`,
      description: 'Test template for integration testing',
      category: 'integration-test',
      template: 'You are a helpful assistant. {{context}}\n\n{{query}}\n\nProvide a detailed response.',
      variables: JSON.stringify({ context: 'string', query: 'string' }),
      isActive: true,
      tags: JSON.stringify(['test', 'integration']),
      usageCount: 0,
      metadata: JSON.stringify({ version: '1.0.0', test: true }),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  describe('Template Lifecycle', () => {
    it('should create, version, and manage templates', async () => {
      // Create initial template
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      expect(template).toBeDefined()
      expect(template.name).toBe(templateData.name)
      expect(template.isActive).toBe(true)

      // Create a new version
      const versionData = {
        description: 'Updated version with better context handling',
        template: 'You are an expert assistant. {{context}}\n\n{{query}}\n\nProvide a comprehensive response.',
        variables: JSON.stringify({ context: 'string', query: 'string', expertise: 'string' })
      }

      const newVersion = await promptTemplateRepository.createVersion(
        template.id,
        versionData,
        '2.0.0'
      )
      testTemplateIds.push(newVersion.id)

      expect(newVersion.name).toBe(template.name)
      expect(newVersion.description).toBe(versionData.description)

      // Get all versions
      const versions = await promptTemplateRepository.getVersions(template.name)
      expect(versions).toHaveLength(2)
      expect(versions[0].isActive).toBe(false) // Original should be deactivated
      expect(versions[1].isActive).toBe(true)  // New version should be active

      // Activate original version
      const activated = await promptTemplateRepository.activateVersion(template.id)
      expect(activated.isActive).toBe(true)

      const updatedVersions = await promptTemplateRepository.getVersions(template.name)
      const activeVersions = updatedVersions.filter(v => v.isActive)
      expect(activeVersions).toHaveLength(1)
      expect(activeVersions[0].template.id).toBe(template.id)
    })

    it('should track usage and performance metrics', async () => {
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      // Record some prompt runs
      const run1 = await promptRunRecorder.recordRun({
        templateId: template.id,
        variables: { context: 'Test context', query: 'Test query' },
        context: {
          source: 'evaluation',
          metadata: { testCase: 'basic' }
        }
      })

      await promptRunRecorder.completeRun(run1.id, {
        output: 'Test response',
        latencyMs: 150,
        tokenCount: 25
      })

      const run2 = await promptRunRecorder.recordRun({
        templateId: template.id,
        variables: { context: 'Another context', query: 'Another query' },
        context: {
          source: 'evaluation',
          metadata: { testCase: 'advanced' }
        }
      })

      await promptRunRecorder.completeRun(run2.id, {
        output: 'Another test response',
        latencyMs: 200,
        tokenCount: 30
      })

      // Get usage statistics
      const stats = await promptRunRecorder.getTemplateUsageStats(template.name, 30)
      expect(stats).toHaveLength(1)
      expect(stats[0].templateName).toBe(template.name)
      expect(stats[0].runCount).toBe(2)
      expect(stats[0].successCount).toBe(2)
      expect(stats[0].averageLatency).toBe(175) // (150 + 200) / 2

      // Get performance trends
      const trends = await promptRunRecorder.getTemplatePerformanceTrends(template.name, 30)
      expect(trends.length).toBeGreaterThan(0)
    })
  })

  describe('Experiment Management', () => {
    it('should create and run experiments', async () => {
      // Create test templates
      const template1Data = createTestTemplate({ name: 'template-a' })
      const template2Data = createTestTemplate({ name: 'template-b' })
      
      const template1 = await promptTemplateRepository.create(template1Data)
      const template2 = await promptTemplateRepository.create(template2Data)
      testTemplateIds.push(template1.id, template2.id)

      // Create experiment
      const experiment = await experimentRepository.create({
        name: `test-experiment-${Date.now()}`,
        description: 'A/B test between two templates',
        status: 'draft',
        config: JSON.stringify({
          type: 'ab_test',
          templates: [template1.id, template2.id],
          testCases: [
            { context: 'Simple test', query: 'What is 2+2?' },
            { context: 'Complex test', query: 'Explain quantum computing' }
          ]
        }),
        metadata: JSON.stringify({ purpose: 'integration_test' }),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      testExperimentIds.push(experiment.id)

      expect(experiment).toBeDefined()
      expect(experiment.status).toBe('draft')

      // Add runs to experiment
      const run1 = await experimentRepository.addRun(experiment.id, {
        templateId: template1.id,
        variables: { context: 'Simple test', query: 'What is 2+2?' },
        metadata: { testCase: 'simple' }
      })

      const run2 = await experimentRepository.addRun(experiment.id, {
        templateId: template2.id,
        variables: { context: 'Simple test', query: 'What is 2+2?' },
        metadata: { testCase: 'simple' }
      })

      // Update experiment status
      const updatedExperiment = await experimentRepository.update(experiment.id, {
        status: 'running'
      })
      expect(updatedExperiment.status).toBe('running')

      // Get experiment runs
      const runs = await experimentRepository.getRuns(experiment.id)
      expect(runs).toHaveLength(2)

      // Get experiment summaries
      const summaries = await experimentRepository.getSummaries()
      const ourSummary = summaries.find(s => s.experiment.id === experiment.id)
      expect(ourSummary).toBeDefined()
      expect(ourSummary?.runCount).toBe(2)
    })
  })

  describe('Promotion Gates', () => {
    it('should evaluate promotion gates for new template', async () => {
      // Create a template with good metrics
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      // Record successful runs
      for (let i = 0; i < 10; i++) {
        const run = await promptRunRecorder.recordRun({
          templateId: template.id,
          variables: { context: `Test context ${i}`, query: `Test query ${i}` },
          context: {
            source: 'evaluation',
            metadata: { testCase: `test-${i}` }
          }
        })

        await promptRunRecorder.completeRun(run.id, {
          output: `Test response ${i}`,
          latencyMs: 100 + Math.random() * 50, // 100-150ms
          tokenCount: 20 + Math.random() * 10 // 20-30 tokens
        })
      }

      // Run promotion gates
      const gateResult = await promotionGatesService.runGates(
        template.id,
        {
          environment: 'staging',
          requiredCategories: ['blocker', 'guardrail'],
          overrideWarnings: false,
          shadowMode: false,
          canaryMode: false,
          canaryTrafficPercentage: 5,
          rolloutDuration: 24
        }
      )

      expect(gateResult).toBeDefined()
      expect(gateResult.results.length).toBeGreaterThan(0)
      expect(['passed', 'failed', 'warning']).toContain(gateResult.overallStatus)

      // Check that blocker rules passed (since we have good metrics)
      const blockerResults = gateResult.results.filter(r => r.rule.category === 'blocker')
      const failedBlockers = blockerResults.filter(r => r.status === 'failed')
      expect(failedBlockers.length).toBe(0)
    })

    it('should fail promotion gates for poor performing template', async () => {
      // Create a template with poor metrics
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      // Record runs with high latency and failure
      for (let i = 0; i < 5; i++) {
        const run = await promptRunRecorder.recordRun({
          templateId: template.id,
          variables: { context: `Test context ${i}`, query: `Test query ${i}` },
          context: {
            source: 'evaluation',
            metadata: { testCase: `test-${i}` }
          }
        })

        // Simulate high latency failures
        await promptRunRecorder.completeRun(run.id, {
          output: '',
          latencyMs: 5000 + Math.random() * 2000, // 5-7 seconds (very high)
          tokenCount: 100 + Math.random() * 50, // High token usage
          error: 'Timeout error'
        })
      }

      // Run promotion gates
      const gateResult = await promotionGatesService.runGates(
        template.id,
        {
          environment: 'production',
          requiredCategories: ['blocker', 'guardrail', 'target'],
          overrideWarnings: false,
          shadowMode: false,
          canaryMode: false,
          canaryTrafficPercentage: 5,
          rolloutDuration: 24
        }
      )

      expect(gateResult).toBeDefined()
      
      // Should have some failed blocker rules due to poor performance
      const blockerResults = gateResult.results.filter(r => r.rule.category === 'blocker')
      const failedBlockers = blockerResults.filter(r => r.status === 'failed')
      expect(failedBlockers.length).toBeGreaterThan(0)
      
      // Overall status should be failed
      expect(gateResult.overallStatus).toBe('failed')
    })
  })

  describe('Server Actions Integration', () => {
    it('should work with server actions for template management', async () => {
      // Test createPromptTemplate action
      const createResult = await createPromptTemplate({
        name: `action-test-${Date.now()}`,
        description: 'Template created via server action',
        category: 'action-test',
        template: 'Action template: {{variable}}',
        variables: '{"variable": "string"}',
        isActive: true,
        tags: '["action", "test"]',
        metadata: '{"test": true}',
        version: '1.0.0'
      })

      expect(createResult.success).toBe(true)
      expect(createResult.data).toBeDefined()
      
      const template = createResult.data!
      testTemplateIds.push(template.id)

      // Test createPromptVersion action
      const versionResult = await createPromptVersion({
        templateId: template.id,
        description: 'New version via action',
        template: 'Updated action template: {{variable}}',
        variables: '{"variable": "string"}',
        isActive: true,
        tags: '["action", "test", "v2"]',
        metadata: '{"version": "2.0.0"}',
        version: '2.0.0'
      })

      expect(versionResult.success).toBe(true)
      expect(versionResult.data).toBeDefined()
      
      const newVersion = versionResult.data!
      testTemplateIds.push(newVersion.id)

      // Verify both versions exist
      const versions = await promptTemplateRepository.getVersions(template.name)
      expect(versions).toHaveLength(2)
    })
  })

  describe('Cross-Component Integration', () => {
    it('should integrate prompt runs with experiments and templates', async () => {
      // Create templates
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      // Create experiment
      const experiment = await experimentRepository.create({
        name: `integration-experiment-${Date.now()}`,
        description: 'Cross-component integration test',
        status: 'running',
        config: JSON.stringify({
          type: 'performance_test',
          templates: [template.id]
        }),
        metadata: JSON.stringify({ integration: true }),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      testExperimentIds.push(experiment.id)

      // Record prompt runs as part of experiment
      const run = await promptRunRecorder.recordEvaluationRun(
        template.id,
        { context: 'Integration test', query: 'Test integration' },
        experiment.id,
        'integration-test-1'
      )

      await promptRunRecorder.completeRun(run.id, {
        output: 'Integration test response',
        latencyMs: 120,
        tokenCount: 25
      })

      // Verify data is connected correctly
      const experimentRuns = await experimentRepository.getRuns(experiment.id)
      expect(experimentRuns).toHaveLength(1)
      expect(experimentRuns[0].templateId).toBe(template.id)

      const templateRuns = await promptRunRecorder.getExperimentRuns(experiment.id)
      expect(templateRuns).toHaveLength(1)
      expect(templateRuns[0].id).toBe(run.id)

      // Get usage stats that should include this run
      const stats = await promptRunRecorder.getTemplateUsageStats(template.name, 30)
      expect(stats).toHaveLength(1)
      expect(stats[0].runCount).toBe(1)
    })
  })
})
