/**
 * Integration Tests for Evaluation Workflows
 * 
 * Tests end-to-end evaluation workflows including prompt runs,
 * experiments, and promotion gates.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db/client'
import { promptTemplates, promptRuns, experiments } from '@/lib/db/schema'
import { promptTemplateRepository, promptRunRepository } from '@/lib/app/persistence/prompt-repository'
import { experimentRepository } from '@/lib/app/persistence/experiment-repository'
import { promptRunRecorder } from '@/lib/app/services/prompt-run-recorder'
import { promotionGatesService, type PromotionConfig } from '@/lib/app/services/promotion-gates'
import type { NewPromptTemplate, NewPromptRun, NewExperiment } from '@/lib/db/schema'

describe('Evaluation Workflow Integration', () => {
  let testTemplateIds: string[] = []
  let testRunIds: string[] = []
  let testExperimentIds: string[] = []

  beforeEach(async () => {
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  async function cleanupTestData() {
    // Clean up in order to avoid foreign key constraints
    for (const id of testRunIds) {
      try {
        await db.delete(promptRuns).where(eq(promptRuns.id, id))
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const id of testExperimentIds) {
      try {
        await db.delete(experiments).where(eq(experiments.id, id))
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    for (const id of testTemplateIds) {
      try {
        await db.delete(promptTemplates).where(eq(promptTemplates.id, id))
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    testTemplateIds = []
    testRunIds = []
    testExperimentIds = []
  }

  function createTestTemplate(overrides: Partial<NewPromptTemplate> = {}): NewPromptTemplate {
    return {
      name: `integration-test-${Date.now()}`,
      description: 'Integration test template',
      category: 'test',
      template: 'Test template with {{variable}}',
      variables: JSON.stringify({ variable: 'string' }),
      isActive: true,
      tags: JSON.stringify(['test', 'integration']),
      usageCount: 0,
      metadata: JSON.stringify({ version: '1.0.0' }),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  function createTestPromptRun(overrides: Partial<NewPromptRun> = {}): NewPromptRun {
    return {
      id: uuidv4(),
      templateId: '',
      variables: JSON.stringify({ variable: 'test-value' }),
      status: 'pending',
      modelProfileId: 'test-model',
      experimentId: undefined,
      output: undefined,
      latencyMs: undefined,
      tokenCount: undefined,
      error: undefined,
      metadata: JSON.stringify({ source: 'integration-test' }),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  function createTestExperiment(overrides: Partial<NewExperiment> = {}): NewExperiment {
    return {
      name: `integration-experiment-${Date.now()}`,
      description: 'Integration test experiment',
      status: 'draft',
      config: JSON.stringify({ iterations: 5 }),
      metadata: JSON.stringify({ type: 'integration-test' }),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  describe('Template to Run Workflow', () => {
    it('should create template and record runs end-to-end', async () => {
      // Step 1: Create a template
      const templateData = createTestTemplate()
      const template = await promptTemplateRepository.create(templateData)
      testTemplateIds.push(template.id)

      expect(template.id).toBeDefined()
      expect(template.isActive).toBe(true)

      // Step 2: Record a prompt run
      const runData = createTestPromptRun({
        templateId: template.id,
        status: 'completed',
        output: 'Test response',
        latencyMs: 1500,
        tokenCount: 250
      })

      const run = await promptRunRecorder.recordRun({
        templateId: template.id,
        variables: { variable: 'test-value' },
        context: {
          source: 'integration-test',
          modelProfileId: 'test-model'
        }
      })

      testRunIds.push(run.id)

      // Complete the run
      const completedRun = await promptRunRecorder.completeRun(run.id, {
        output: 'Test response',
        latencyMs: 1500,
        tokenCount: 250
      })

      expect(completedRun.status).toBe('completed')
      expect(completedRun.output).toBe('Test response')
      expect(completedRun.latencyMs).toBe(1500)

      // Step 3: Verify template usage was incremented
      const updatedTemplate = await promptTemplateRepository.getById(template.id)
      expect(updatedTemplate?.usageCount).toBe(1)

      // Step 4: Verify run can be retrieved
      const retrievedRun = await promptRunRepository.getById(run.id)
      expect(retrievedRun?.id).toBe(run.id)
      expect(retrievedRun?.templateId).toBe(template.id)
    })

    it('should handle multiple runs for the same template', async () => {
      const template = await promptTemplateRepository.create(createTestTemplate())
      testTemplateIds.push(template.id)

      const runs = []
      for (let i = 0; i < 5; i++) {
        const run = await promptRunRecorder.recordRun({
          templateId: template.id,
          variables: { variable: `test-${i}` },
          context: {
            source: 'integration-test',
            modelProfileId: 'test-model'
          }
        })

        await promptRunRecorder.completeRun(run.id, {
          output: `Response ${i}`,
          latencyMs: 1000 + i * 100,
          tokenCount: 200 + i * 10
        })

        runs.push(run)
        testRunIds.push(run.id)
      }

      // Verify all runs are associated with the template
      const templateRuns = await promptRunRepository.getByTemplateId(template.id, 10)
      expect(templateRuns).toHaveLength(5)

      // Verify template usage count
      const updatedTemplate = await promptTemplateRepository.getById(template.id)
      expect(updatedTemplate?.usageCount).toBe(5)

      // Verify run statistics
      const stats = await promptRunRepository.getStats()
      expect(stats.total).toBe(5)
      expect(stats.successCount).toBe(5)
      expect(stats.averageLatency).toBeGreaterThan(1000)
    })
  })

  describe('Experiment Workflow', () => {
    it('should create experiment and add runs', async () => {
      // Step 1: Create templates for the experiment
      const templateA = await promptTemplateRepository.create(createTestTemplate({
        name: 'experiment-template-a',
        template: 'Template A response'
      }))
      const templateB = await promptTemplateRepository.create(createTestTemplate({
        name: 'experiment-template-b', 
        template: 'Template B response'
      }))
      testTemplateIds.push(templateA.id, templateB.id)

      // Step 2: Create experiment
      const experimentData = createTestExperiment({
        name: 'A/B Test Experiment',
        config: JSON.stringify({
          templateA: templateA.id,
          templateB: templateB.id,
          trafficSplit: 50
        })
      })
      const experiment = await experimentRepository.create(experimentData)
      testExperimentIds.push(experiment.id)

      expect(experiment.id).toBeDefined()
      expect(experiment.status).toBe('draft')

      // Step 3: Add runs to the experiment
      const runA = await experimentRepository.addRun(experiment.id, {
        templateId: templateA.id,
        variables: { test: 'value' },
        modelProfileId: 'test-model'
      })
      const runB = await experimentRepository.addRun(experiment.id, {
        templateId: templateB.id,
        variables: { test: 'value' },
        modelProfileId: 'test-model'
      })

      testRunIds.push(runA.id, runB.id)

      // Step 4: Update run results
      await experimentRepository.updateRun(runA.id, {
        status: 'completed',
        output: 'Response from template A',
        latencyMs: 1200,
        tokenCount: 180
      })
      await experimentRepository.updateRun(runB.id, {
        status: 'completed',
        output: 'Response from template B',
        latencyMs: 1100,
        tokenCount: 160
      })

      // Step 5: Verify experiment runs
      const experimentRuns = await experimentRepository.getRuns(experiment.id)
      expect(experimentRuns).toHaveLength(2)

      const runAResult = experimentRuns.find(r => r.templateId === templateA.id)
      const runBResult = experimentRuns.find(r => r.templateId === templateB.id)

      expect(runAResult?.output).toBe('Response from template A')
      expect(runBResult?.output).toBe('Response from template B')
    })

    it('should generate experiment summaries correctly', async () => {
      // Create multiple experiments with different outcomes
      const template = await promptTemplateRepository.create(createTestTemplate())
      testTemplateIds.push(template.id)

      const experiments = []
      for (let i = 0; i < 3; i++) {
        const exp = await experimentRepository.create(createTestExperiment({
          name: `summary-test-${i}`,
          status: i === 0 ? 'completed' : i === 1 ? 'running' : 'draft'
        }))
        experiments.push(exp)
        testExperimentIds.push(exp.id)

        // Add some runs to completed experiment
        if (i === 0) {
          for (let j = 0; j < 5; j++) {
            const run = await experimentRepository.addRun(exp.id, {
              templateId: template.id,
              variables: { test: `value-${j}` },
              modelProfileId: 'test-model'
            })
            testRunIds.push(run.id)

            await experimentRepository.updateRun(run.id, {
              status: j < 4 ? 'completed' : 'failed',
              output: `Response ${j}`,
              latencyMs: 1000 + j * 50,
              tokenCount: 150 + j * 10
            })
          }
        }
      }

      // Get summaries
      const summaries = await experimentRepository.getSummaries()
      expect(summaries).toHaveLength(3)

      const completedSummary = summaries.find(s => s.experiment.status === 'completed')
      expect(completedSummary?.runCount).toBe(5)
      expect(completedSummary?.successCount).toBe(4)
      expect(completedSummary?.averageLatency).toBeGreaterThan(1000)
    })
  })

  describe('Promotion Gates Workflow', () => {
    it('should run promotion gates with real data', async () => {
      // Step 1: Create a template with good metrics
      const template = await promptTemplateRepository.create(createTestTemplate({
        name: 'promotion-test-template'
      }))
      testTemplateIds.push(template.id)

      // Step 2: Create runs with good performance
      const runs = []
      for (let i = 0; i < 20; i++) {
        const run = await promptRunRecorder.recordRun({
          templateId: template.id,
          variables: { test: `value-${i}` },
          context: {
            source: 'integration-test',
            modelProfileId: 'test-model'
          }
        })

        // Simulate good metrics
        await promptRunRecorder.completeRun(run.id, {
          output: `Response ${i}`,
          latencyMs: 800 + Math.random() * 400, // 800-1200ms
          tokenCount: 150 + Math.random() * 100, // 150-250 tokens
          metadata: {
            schemaValidationPassRate: 98,
            safetyFailureRate: 0.5,
            toolCallValidityRate: 99,
            timeoutRate: 0.2,
            taskSuccessRate: 92,
            userSatisfactionScore: 4.2
          }
        })

        runs.push(run)
        testRunIds.push(run.id)
      }

      // Step 3: Run promotion gates
      const config: PromotionConfig = {
        environment: 'staging',
        requiredCategories: ['blocker', 'guardrail'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await promotionGatesService.runGates(template.id, config)

      // Step 4: Verify results
      expect(result.overallStatus).toBe('passed')
      expect(result.recommendation).toBe('promote')
      expect(result.confidence).toBeGreaterThan(50) // Should have reasonable confidence
      expect(result.summary.blockers.failed).toBe(0)

      // Step 5: Verify gate history is stored
      const history = promotionGatesService.getGateHistory(template.id)
      expect(history).toHaveLength(1)
      expect(history[0].promptVersion).toBe(template.id)
    })

    it('should fail promotion gates with poor metrics', async () => {
      // Create template with poor performance
      const template = await promptTemplateRepository.create(createTestTemplate({
        name: 'poor-performance-template'
      }))
      testTemplateIds.push(template.id)

      // Create runs with poor metrics
      const runs = []
      for (let i = 0; i < 10; i++) {
        const run = await promptRunRecorder.recordRun({
          templateId: template.id,
          variables: { test: `value-${i}` },
          context: {
            source: 'integration-test',
            modelProfileId: 'test-model'
          }
        })

        // Simulate poor metrics
        await promptRunRecorder.completeRun(run.id, {
          output: `Response ${i}`,
          latencyMs: 3000 + Math.random() * 2000, // 3-5 seconds (slow)
          tokenCount: 400 + Math.random() * 200, // 400-600 tokens (expensive)
          metadata: {
            schemaValidationPassRate: 85, // Below threshold
            safetyFailureRate: 3, // Above threshold
            toolCallValidityRate: 90, // Below threshold
            timeoutRate: 5, // Above threshold
            taskSuccessRate: 70, // Below threshold
            userSatisfactionScore: 2.8 // Below threshold
          }
        })

        runs.push(run)
        testRunIds.push(run.id)
      }

      // Run promotion gates
      const config: PromotionConfig = {
        environment: 'production',
        requiredCategories: ['blocker', 'guardrail', 'target'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await promotionGatesService.runGates(template.id, config)

      // Should fail due to blocker violations
      expect(result.overallStatus).toBe('failed')
      expect(result.recommendation).toBe('hold')
      expect(result.summary.blockers.failed).toBeGreaterThan(0)
    })

    it('should handle baseline comparison', async () => {
      // Create baseline template
      const baselineTemplate = await promptTemplateRepository.create(createTestTemplate({
        name: 'baseline-template'
      }))
      testTemplateIds.push(baselineTemplate.id)

      // Add baseline runs with moderate performance
      for (let i = 0; i < 10; i++) {
        const run = await promptRunRecorder.recordRun({
          templateId: baselineTemplate.id,
          variables: { test: `baseline-${i}` },
          context: {
            source: 'integration-test',
            modelProfileId: 'test-model'
          }
        })

        await promptRunRecorder.completeRun(run.id, {
          output: `Baseline response ${i}`,
          latencyMs: 1500,
          tokenCount: 200,
          metadata: {
            taskSuccessRate: 80,
            userSatisfactionScore: 3.5
          }
        })

        testRunIds.push(run.id)
      }

      // Create new template with better performance
      const newTemplate = await promptTemplateRepository.create(createTestTemplate({
        name: 'improved-template'
      }))
      testTemplateIds.push(newTemplate.id)

      // Add improved runs
      for (let i = 0; i < 10; i++) {
        const run = await promptRunRecorder.recordRun({
          templateId: newTemplate.id,
          variables: { test: `improved-${i}` },
          context: {
            source: 'integration-test',
            modelProfileId: 'test-model'
          }
        })

        await promptRunRecorder.completeRun(run.id, {
          output: `Improved response ${i}`,
          latencyMs: 1200, // Faster
          tokenCount: 180,   // More efficient
          metadata: {
            taskSuccessRate: 90, // Better success rate
            userSatisfactionScore: 4.1 // Better satisfaction
          }
        })

        testRunIds.push(run.id)
      }

      // Run promotion gates with baseline comparison
      const config: PromotionConfig = {
        environment: 'staging',
        requiredCategories: ['target'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 5,
        rolloutDuration: 24
      }

      const result = await promotionGatesService.runGates(newTemplate.id, config, baselineTemplate.id)

      // Should pass and show improvements
      expect(result.overallStatus).toBe('passed')
      expect(result.recommendation).toBe('promote')
      expect(result.summary.targets.improved).toBeGreaterThan(0)
    })
  })

  describe('End-to-End Evaluation Pipeline', () => {
    it('should run complete evaluation pipeline', async () => {
      // Step 1: Create multiple template versions
      const v1 = await promptTemplateRepository.create(createTestTemplate({
        name: 'pipeline-template',
        template: 'Version 1: {{query}}',
        metadata: JSON.stringify({ version: '1.0.0' })
      }))
      const v2 = await promptTemplateRepository.createVersion(v1.id, {
        template: 'Version 2: {{query}} with improvements',
        description: 'Improved version with better performance'
      }, '2.0.0')
      testTemplateIds.push(v1.id, v2.id)

      // Step 2: Create experiment to compare versions
      const experiment = await experimentRepository.create(createTestExperiment({
        name: 'Version Comparison Experiment',
        config: JSON.stringify({
          versions: [v1.id, v2.id],
          testCases: [
            { query: 'test query 1', expected: 'response 1' },
            { query: 'test query 2', expected: 'response 2' },
            { query: 'test query 3', expected: 'response 3' }
          ]
        })
      }))
      testExperimentIds.push(experiment.id)

      // Step 3: Run test cases for both versions
      for (let version = 0; version < 2; version++) {
        const templateId = version === 0 ? v1.id : v2.id
        const baseLatency = version === 0 ? 2000 : 1500 // V2 is faster
        const baseSuccess = version === 0 ? 75 : 90 // V2 has better success rate

        for (let i = 0; i < 3; i++) {
          const run = await experimentRepository.addRun(experiment.id, {
            templateId,
            variables: { query: `test query ${i + 1}` },
            modelProfileId: 'test-model'
          })
          testRunIds.push(run.id)

          await experimentRepository.updateRun(run.id, {
            status: Math.random() > (1 - baseSuccess / 100) ? 'completed' : 'failed',
            output: `Response to query ${i + 1} from version ${version + 1}`,
            latencyMs: baseLatency + Math.random() * 500,
            tokenCount: 150 + Math.random() * 100,
            metadata: {
              testCase: i + 1,
              version: version + 1,
              taskSuccessRate: baseSuccess,
              userSatisfactionScore: version === 0 ? 3.2 : 4.0
            }
          })
        }
      }

      // Step 4: Analyze experiment results
      const summaries = await experimentRepository.getSummaries()
      const experimentSummary = summaries.find(s => s.experiment.id === experiment.id)
      
      expect(experimentSummary).toBeDefined()
      expect(experimentSummary?.runCount).toBe(6)

      // Step 5: Run promotion gates on the new version
      const config: PromotionConfig = {
        environment: 'staging',
        requiredCategories: ['blocker', 'target'],
        overrideWarnings: false,
        shadowMode: false,
        canaryMode: false,
        canaryTrafficPercentage: 10,
        rolloutDuration: 48
      }

      const gateResult = await promotionGatesService.runGates(v2.id, config, v1.id)

      // Step 6: Verify pipeline results
      expect(gateResult.overallStatus).toBe('passed')
      expect(gateResult.recommendation).toBe('promote')
      expect(gateResult.confidence).toBeGreaterThan(60)

      // Step 7: Verify version can be activated
      const activated = await promptTemplateRepository.activateVersion(v2.id)
      expect(activated.id).toBe(v2.id)
      expect(activated.isActive).toBe(true)

      // Verify v1 is deactivated
      const v1Updated = await promptTemplateRepository.getById(v1.id)
      expect(v1Updated?.isActive).toBe(false)
    })
  })
})
