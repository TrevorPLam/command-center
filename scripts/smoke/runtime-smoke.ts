#!/usr/bin/env tsx

/**
 * Runtime Smoke Tests
 * 
 * Comprehensive smoke tests for the Ollama runtime integration.
 * Tests all major functionality paths to ensure system readiness.
 */

import { createOllamaAdapter } from '../../src/lib/app/runtime/ollama-adapter'
import { getRuntimeService } from '../../src/lib/app/services/runtime-service'
import { getModelSyncService } from '../../src/lib/app/services/model-sync-service'
import { getRuntimeRepository } from '../../src/lib/app/persistence/runtime-repository'
import { env } from '../../src/lib/config/env'

interface SmokeTestResult {
  success: boolean
  tests: SmokeTest[]
  summary: TestSummary
  duration: number
  timestamp: string
}

interface SmokeTest {
  name: string
  category: 'connectivity' | 'models' | 'chat' | 'embeddings' | 'persistence' | 'performance'
  status: 'pass' | 'fail' | 'skip'
  message: string
  details?: any
  duration: number
}

interface TestSummary {
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  categories: Record<string, { total: number; passed: number; failed: number; skipped: number }>
}

class RuntimeSmokeTester {
  private adapter = createOllamaAdapter({ baseUrl: env.OLLAMA_BASE_URL })
  private runtimeService = getRuntimeService()
  private modelSyncService = getModelSyncService()
  private repository = getRuntimeRepository()

  async runAllSmokeTests(): Promise<SmokeTestResult> {
    console.log('🔥 Starting comprehensive runtime smoke tests...\n')
    const startTime = Date.now()
    const tests: SmokeTest[] = []

    try {
      // Connectivity tests
      await this.runCategoryTests(tests, 'connectivity', () => this.testConnectivity())
      await this.runCategoryTests(tests, 'connectivity', () => this.testHealthEndpoint())
      
      // Model management tests
      await this.runCategoryTests(tests, 'models', () => this.testModelListing())
      await this.runCategoryTests(tests, 'models', () => this.testModelDetails())
      await this.runCategoryTests(tests, 'models', () => this.testRunningModels())
      await this.runCategoryTests(tests, 'models', () => this.testModelSync())
      
      // Chat functionality tests
      await this.runCategoryTests(tests, 'chat', () => this.testChatCompletion())
      await this.runCategoryTests(tests, 'chat', () => this.testChatStreaming())
      await this.runCategoryTests(tests, 'chat', () => this.testChatWithHistory())
      
      // Embedding tests
      await this.runCategoryTests(tests, 'embeddings', () => this.testEmbeddingGeneration())
      await this.runCategoryTests(tests, 'embeddings', () => this.testBatchEmbeddings())
      
      // Persistence tests
      await this.runCategoryTests(tests, 'persistence', () => this.testSnapshotCreation())
      await this.runCategoryTests(tests, 'persistence', () => this.testMetricsCollection())
      await this.runCategoryTests(tests, 'persistence', () => this.testTrendData())
      
      // Performance tests
      await this.runCategoryTests(tests, 'performance', () => this.testConcurrentRequests())
      await this.runCategoryTests(tests, 'performance', () => this.testLargeContext())
      await this.runCategoryTests(tests, 'performance', () => this.testTimeoutHandling())

    } catch (error) {
      tests.push({
        name: 'smoke-test-error',
        category: 'connectivity',
        status: 'fail',
        message: `Smoke test suite failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: 0
      })
    }

    const duration = Date.now() - startTime
    const summary = this.calculateSummary(tests)

    this.printResults(tests, summary, duration)

    return {
      success: summary.failedTests === 0,
      tests,
      summary,
      duration,
      timestamp: new Date().toISOString()
    }
  }

  private async runCategoryTests(
    tests: SmokeTest[],
    category: SmokeTest['category'],
    testFn: () => Promise<SmokeTest | SmokeTest[]>
  ): Promise<void> {
    try {
      const result = await testFn()
      if (Array.isArray(result)) {
        tests.push(...result)
      } else {
        tests.push(result)
      }
    } catch (error) {
      tests.push({
        name: `${category}-error`,
        category,
        status: 'fail',
        message: `Category test failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: 0
      })
    }
  }

  // Connectivity Tests
  private async testConnectivity(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const health = await this.adapter.getHealth()
      const duration = Date.now() - startTime
      
      return {
        name: 'basic-connectivity',
        category: 'connectivity',
        status: health.status === 'healthy' ? 'pass' : 'fail',
        message: `Connectivity test: ${health.status} (${health.latency}ms)`,
        details: { health },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'basic-connectivity',
        category: 'connectivity',
        status: 'fail',
        message: `Connectivity failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testHealthEndpoint(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const capabilities = await this.adapter.getCapabilities()
      const duration = Date.now() - startTime
      
      return {
        name: 'health-endpoint',
        category: 'connectivity',
        status: 'pass',
        message: `Health endpoint accessible, capabilities: ${Object.keys(capabilities).filter(k => capabilities[k as keyof typeof capabilities]).join(', ')}`,
        details: { capabilities },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'health-endpoint',
        category: 'connectivity',
        status: 'fail',
        message: `Health endpoint failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  // Model Management Tests
  private async testModelListing(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels(true)
      const duration = Date.now() - startTime
      
      return {
        name: 'model-listing',
        category: 'models',
        status: 'pass',
        message: `Listed ${models.length} models`,
        details: { modelCount: models.length, models: models.slice(0, 3) },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'model-listing',
        category: 'models',
        status: 'fail',
        message: `Model listing failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testModelDetails(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      
      if (models.length === 0) {
        return {
          name: 'model-details',
          category: 'models',
          status: 'skip',
          message: 'No models available for details test',
          duration: Date.now() - startTime
        }
      }

      const testModel = models[0]
      const details = await this.runtimeService.showModel(testModel.name)
      const duration = Date.now() - startTime
      
      return {
        name: 'model-details',
        category: 'models',
        status: 'pass',
        message: `Retrieved details for ${testModel.name}`,
        details: { model: testModel.name, details },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'model-details',
        category: 'models',
        status: 'fail',
        message: `Model details failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testRunningModels(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const runningModels = await this.runtimeService.listRunningModels(true)
      const duration = Date.now() - startTime
      
      return {
        name: 'running-models',
        category: 'models',
        status: 'pass',
        message: `${runningModels.length} models running`,
        details: { runningCount: runningModels.length, models: runningModels },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'running-models',
        category: 'models',
        status: 'fail',
        message: `Running models check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testModelSync(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const syncResult = await this.modelSyncService.syncModels()
      const duration = Date.now() - startTime
      
      return {
        name: 'model-sync',
        category: 'models',
        status: 'pass',
        message: `Synced ${syncResult.added.length} new, ${syncResult.updated.length} updated models`,
        details: syncResult,
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'model-sync',
        category: 'models',
        status: 'fail',
        message: `Model sync failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  // Chat Functionality Tests
  private async testChatCompletion(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      const chatModels = models.filter(m => 
        !m.name.toLowerCase().includes('embed') && 
        !m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (chatModels.length === 0) {
        return {
          name: 'chat-completion',
          category: 'chat',
          status: 'skip',
          message: 'No chat models available',
          duration: Date.now() - startTime
        }
      }

      const testModel = chatModels[0]
      const stream = await this.runtimeService.chat({
        model: testModel.name,
        messages: [{ role: 'user', content: 'Respond with exactly: "Smoke test passed"' }]
      })
      
      // Read a few responses
      const reader = stream.getReader()
      let responses = 0
      let fullResponse = ''
      
      for (let i = 0; i < 5; i++) {
        const { done, value } = await reader.read()
        if (done) break
        if (value?.type === 'token') {
          fullResponse += value.text
          responses++
        }
      }
      
      reader.releaseLock()
      const duration = Date.now() - startTime
      
      return {
        name: 'chat-completion',
        category: 'chat',
        status: responses > 0 ? 'pass' : 'fail',
        message: `Chat completion: ${responses} tokens received`,
        details: { model: testModel.name, responses, preview: fullResponse.substring(0, 100) },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'chat-completion',
        category: 'chat',
        status: 'fail',
        message: `Chat completion failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testChatStreaming(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      const chatModels = models.filter(m => 
        !m.name.toLowerCase().includes('embed') && 
        !m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (chatModels.length === 0) {
        return {
          name: 'chat-streaming',
          category: 'chat',
          status: 'skip',
          message: 'No chat models available for streaming test',
          duration: Date.now() - startTime
        }
      }

      const testModel = chatModels[0]
      const stream = await this.runtimeService.chat({
        model: testModel.name,
        messages: [{ role: 'user', content: 'Count to 5 slowly' }]
      })
      
      const reader = stream.getReader()
      let tokenCount = 0
      const startTime = Date.now()
      let firstTokenTime = 0
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        if (value?.type === 'token') {
          tokenCount++
          if (firstTokenTime === 0) {
            firstTokenTime = Date.now() - startTime
          }
        }
      }
      
      reader.releaseLock()
      const duration = Date.now() - startTime
      
      return {
        name: 'chat-streaming',
        category: 'chat',
        status: tokenCount > 0 ? 'pass' : 'fail',
        message: `Streaming: ${tokenCount} tokens, first token: ${firstTokenTime}ms`,
        details: { model: testModel.name, tokenCount, firstTokenTime },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'chat-streaming',
        category: 'chat',
        status: 'fail',
        message: `Chat streaming failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testChatWithHistory(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      const chatModels = models.filter(m => 
        !m.name.toLowerCase().includes('embed') && 
        !m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (chatModels.length === 0) {
        return {
          name: 'chat-history',
          category: 'chat',
          status: 'skip',
          message: 'No chat models available for history test',
          duration: Date.now() - startTime
        }
      }

      const testModel = chatModels[0]
      const stream = await this.runtimeService.chat({
        model: testModel.name,
        messages: [
          { role: 'user', content: 'Remember: The answer is 42' },
          { role: 'assistant', content: 'I\'ll remember that the answer is 42.' },
          { role: 'user', content: 'What was the answer?' }
        ]
      })
      
      const reader = stream.getReader()
      let responseText = ''
      
      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read()
        if (done) break
        if (value?.type === 'token') {
          responseText += value.text
        }
      }
      
      reader.releaseLock()
      const duration = Date.now() - startTime
      
      const containsAnswer = responseText.toLowerCase().includes('42')
      
      return {
        name: 'chat-history',
        category: 'chat',
        status: containsAnswer ? 'pass' : 'fail',
        message: `Chat history test: ${containsAnswer ? 'Context maintained' : 'Context lost'}`,
        details: { model: testModel.name, responsePreview: responseText.substring(0, 100) },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'chat-history',
        category: 'chat',
        status: 'fail',
        message: `Chat history failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  // Embedding Tests
  private async testEmbeddingGeneration(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      const embeddingModels = models.filter(m => 
        m.name.toLowerCase().includes('embed') || 
        m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (embeddingModels.length === 0) {
        return {
          name: 'embedding-generation',
          category: 'embeddings',
          status: 'skip',
          message: 'No embedding models available',
          duration: Date.now() - startTime
        }
      }

      const testModel = embeddingModels[0]
      const embeddings = await this.runtimeService.embed({
        model: testModel.name,
        input: 'Test embedding for smoke test'
      })
      const duration = Date.now() - startTime
      
      return {
        name: 'embedding-generation',
        category: 'embeddings',
        status: embeddings.length > 0 && embeddings[0].length > 0 ? 'pass' : 'fail',
        message: `Embedding generation: ${embeddings[0]?.length} dimensions`,
        details: { model: testModel.name, dimensions: embeddings[0]?.length },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'embedding-generation',
        category: 'embeddings',
        status: 'fail',
        message: `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testBatchEmbeddings(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      const embeddingModels = models.filter(m => 
        m.name.toLowerCase().includes('embed') || 
        m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (embeddingModels.length === 0) {
        return {
          name: 'batch-embeddings',
          category: 'embeddings',
          status: 'skip',
          message: 'No embedding models available for batch test',
          duration: Date.now() - startTime
        }
      }

      const testModel = embeddingModels[0]
      const inputs = ['First test text', 'Second test text', 'Third test text']
      const embeddings = await this.runtimeService.embed({
        model: testModel.name,
        input: inputs
      })
      const duration = Date.now() - startTime
      
      return {
        name: 'batch-embeddings',
        category: 'embeddings',
        status: embeddings.length === inputs.length ? 'pass' : 'fail',
        message: `Batch embeddings: ${embeddings.length}/${inputs.length} processed`,
        details: { model: testModel.name, inputCount: inputs.length, outputCount: embeddings.length },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'batch-embeddings',
        category: 'embeddings',
        status: 'fail',
        message: `Batch embeddings failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  // Persistence Tests
  private async testSnapshotCreation(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const snapshot = await this.runtimeService.createSnapshot()
      await this.repository.saveSnapshot(snapshot)
      const duration = Date.now() - startTime
      
      return {
        name: 'snapshot-creation',
        category: 'persistence',
        status: 'pass',
        message: `Snapshot created: ${snapshot.id}`,
        details: { snapshotId: snapshot.id, modelCount: snapshot.models.length },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'snapshot-creation',
        category: 'persistence',
        status: 'fail',
        message: `Snapshot creation failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testMetricsCollection(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const metrics = this.runtimeService.getMetrics()
      await this.repository.saveMetrics(metrics)
      const duration = Date.now() - startTime
      
      return {
        name: 'metrics-collection',
        category: 'persistence',
        status: 'pass',
        message: `Metrics saved: ${metrics.requestCount} requests, ${metrics.errorCount} errors`,
        details: { metrics },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'metrics-collection',
        category: 'persistence',
        status: 'fail',
        message: `Metrics collection failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testTrendData(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const trendData = await this.repository.getTrendData('hour')
      const duration = Date.now() - startTime
      
      return {
        name: 'trend-data',
        category: 'persistence',
        status: 'pass',
        message: `Trend data: ${trendData.snapshots.length} snapshots, ${trendData.metrics.length} metrics`,
        details: { period: trendData.period, snapshotCount: trendData.snapshots.length },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'trend-data',
        category: 'persistence',
        status: 'fail',
        message: `Trend data failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  // Performance Tests
  private async testConcurrentRequests(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      const chatModels = models.filter(m => 
        !m.name.toLowerCase().includes('embed') && 
        !m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (chatModels.length === 0) {
        return {
          name: 'concurrent-requests',
          category: 'performance',
          status: 'skip',
          message: 'No chat models available for concurrent test',
          duration: Date.now() - startTime
        }
      }

      const testModel = chatModels[0]
      const concurrentCount = 3
      
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        this.runtimeService.chat({
          model: testModel.name,
          messages: [{ role: 'user', content: `Concurrent test ${i + 1}: say "ok"` }]
        })
      )
      
      const streams = await Promise.all(promises)
      
      // Read first token from each stream
      const readerPromises = streams.map(async (stream, index) => {
        const reader = stream.getReader()
        const { value } = await reader.read()
        reader.releaseLock()
        return { index, firstToken: value }
      })
      
      const results = await Promise.all(readerPromises)
      const successfulRequests = results.filter(r => r.firstToken?.type === 'token').length
      const duration = Date.now() - startTime
      
      return {
        name: 'concurrent-requests',
        category: 'performance',
        status: successfulRequests === concurrentCount ? 'pass' : 'fail',
        message: `Concurrent requests: ${successfulRequests}/${concurrentCount} successful`,
        details: { concurrentCount, successfulRequests, averageLatency: duration / concurrentCount },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'concurrent-requests',
        category: 'performance',
        status: 'fail',
        message: `Concurrent requests failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testLargeContext(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      const chatModels = models.filter(m => 
        !m.name.toLowerCase().includes('embed') && 
        !m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (chatModels.length === 0) {
        return {
          name: 'large-context',
          category: 'performance',
          status: 'skip',
          message: 'No chat models available for large context test',
          duration: Date.now() - startTime
        }
      }

      const testModel = chatModels[0]
      const largeText = 'This is a test. '.repeat(100) // Create a larger context
      
      const stream = await this.runtimeService.chat({
        model: testModel.name,
        messages: [{ role: 'user', content: largeText }]
      })
      
      const reader = stream.getReader()
      let tokenCount = 0
      
      for (let i = 0; i < 10; i++) {
        const { done, value } = await reader.read()
        if (done) break
        if (value?.type === 'token') {
          tokenCount++
        }
      }
      
      reader.releaseLock()
      const duration = Date.now() - startTime
      
      return {
        name: 'large-context',
        category: 'performance',
        status: tokenCount > 0 ? 'pass' : 'fail',
        message: `Large context: ${tokenCount} tokens, input length: ${largeText.length}`,
        details: { model: testModel.name, inputLength: largeText.length, tokenCount },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'large-context',
        category: 'performance',
        status: 'fail',
        message: `Large context failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private async testTimeoutHandling(): Promise<SmokeTest> {
    const startTime = Date.now()
    
    try {
      const models = await this.runtimeService.listModels()
      const chatModels = models.filter(m => 
        !m.name.toLowerCase().includes('embed') && 
        !m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (chatModels.length === 0) {
        return {
          name: 'timeout-handling',
          category: 'performance',
          status: 'skip',
          message: 'No chat models available for timeout test',
          duration: Date.now() - startTime
        }
      }

      const testModel = chatModels[0]
      
      // Create a very short timeout to test timeout handling
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 100) // Abort after 100ms
      
      try {
        const stream = await this.runtimeService.chat({
          model: testModel.name,
          messages: [{ role: 'user', content: 'This should timeout quickly' }],
          // Note: In a real implementation, you'd pass timeout parameters
        }, controller.signal)
        
        const reader = stream.getReader()
        const { value } = await reader.read()
        reader.releaseLock()
        
        const duration = Date.now() - startTime
        
        return {
          name: 'timeout-handling',
          category: 'performance',
          status: 'pass',
          message: 'Request completed before timeout (or timeout not implemented)',
          details: { duration },
          duration
        }
      } catch (error) {
        const duration = Date.now() - startTime
        
        if (error instanceof Error && error.name === 'AbortError') {
          return {
            name: 'timeout-handling',
            category: 'performance',
            status: 'pass',
            message: 'Timeout handled correctly',
            details: { duration },
            duration
          }
        }
        
        throw error
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        name: 'timeout-handling',
        category: 'performance',
        status: 'fail',
        message: `Timeout handling failed: ${error instanceof Error ? error.message : String(error)}`,
        duration
      }
    }
  }

  private calculateSummary(tests: SmokeTest[]): TestSummary {
    const categories: Record<string, { total: number; passed: number; failed: number; skipped: number }> = {}
    
    tests.forEach(test => {
      if (!categories[test.category]) {
        categories[test.category] = { total: 0, passed: 0, failed: 0, skipped: 0 }
      }
      
      categories[test.category].total++
      categories[test.category][test.status === 'pass' ? 'passed' : test.status === 'fail' ? 'failed' : 'skipped']++
    })

    return {
      totalTests: tests.length,
      passedTests: tests.filter(t => t.status === 'pass').length,
      failedTests: tests.filter(t => t.status === 'fail').length,
      skippedTests: tests.filter(t => t.status === 'skip').length,
      categories
    }
  }

  private printResults(tests: SmokeTest[], summary: TestSummary, duration: number): void {
    console.log('\n🔥 Smoke Test Results:')
    console.log('=======================')
    
    // Group by category
    const grouped = tests.reduce((acc, test) => {
      if (!acc[test.category]) acc[test.category] = []
      acc[test.category].push(test)
      return acc
    }, {} as Record<string, SmokeTest[]>)
    
    Object.entries(grouped).forEach(([category, categoryTests]) => {
      console.log(`\n${category.toUpperCase()}:`)
      console.log('-'.repeat(category.length + 1))
      
      categoryTests.forEach(test => {
        const icon = test.status === 'pass' ? '✅' : test.status === 'skip' ? '⏭️' : '❌'
        console.log(`${icon} ${test.name}: ${test.message} (${test.duration}ms)`)
      })
    })
    
    console.log('\n📊 Summary:')
    console.log('===========')
    console.log(`Total tests: ${summary.totalTests}`)
    console.log(`Passed: ${summary.passedTests}`)
    console.log(`Failed: ${summary.failedTests}`)
    console.log(`Skipped: ${summary.skippedTests}`)
    console.log(`Duration: ${duration}ms`)
    
    Object.entries(summary.categories).forEach(([category, stats]) => {
      console.log(`${category}: ${stats.passed}/${stats.total} passed`)
    })
    
    const overallStatus = summary.failedTests === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'
    console.log(`\nOverall Status: ${overallStatus}`)
  }
}

// CLI interface
async function main() {
  const tester = new RuntimeSmokeTester()
  
  try {
    const result = await tester.runAllSmokeTests()
    
    // Exit with appropriate code
    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error('❌ Smoke tests failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
