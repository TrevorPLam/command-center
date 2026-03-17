#!/usr/bin/env tsx

/**
 * Ollama Runtime Health Check Script
 * 
 * Comprehensive health check and diagnostics for Ollama runtime.
 * Verifies connectivity, model availability, and basic functionality.
 */

import { createOllamaAdapter } from '../src/lib/app/runtime/ollama-adapter'
import { RuntimeError, RuntimeErrorCode } from '../src/lib/app/runtime/errors'
import { env } from '../src/lib/config/env'

interface HealthCheckResult {
  success: boolean
  checks: HealthCheck[]
  summary: {
    totalChecks: number
    passedChecks: number
    failedChecks: number
    warnings: number
  }
  duration: number
  timestamp: string
}

interface HealthCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  details?: any
  duration: number
}

class OllamaHealthChecker {
  private adapter = createOllamaAdapter({
    baseUrl: env.OLLAMA_BASE_URL
  })

  async runFullHealthCheck(): Promise<HealthCheckResult> {
    console.log('🔍 Starting Ollama runtime health check...\n')
    const startTime = Date.now()
    const checks: HealthCheck[] = []

    try {
      // 1. Basic connectivity test
      await this.addCheck(checks, 'connectivity', () => this.testConnectivity())
      
      // 2. Model listing test
      await this.addCheck(checks, 'model-listing', () => this.testModelListing())
      
      // 3. Running models test
      await this.addCheck(checks, 'running-models', () => this.testRunningModels())
      
      // 4. Capabilities test
      await this.addCheck(checks, 'capabilities', () => this.testCapabilities())
      
      // 5. Model loading test (if models available)
      await this.addCheck(checks, 'model-loading', () => this.testModelLoading())
      
      // 6. Embedding test (if embedding model available)
      await this.addCheck(checks, 'embeddings', () => this.testEmbeddings())
      
      // 7. Chat test (if chat model available)
      await this.addCheck(checks, 'chat', () => this.testChat())
      
      // 8. Performance test
      await this.addCheck(checks, 'performance', () => this.testPerformance())

    } catch (error) {
      checks.push({
        name: 'health-check-error',
        status: 'fail',
        message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: 0
      })
    }

    const duration = Date.now() - startTime
    const summary = this.calculateSummary(checks)

    // Print results
    this.printResults(checks, summary, duration)

    return {
      success: summary.failedChecks === 0,
      checks,
      summary,
      duration,
      timestamp: new Date().toISOString()
    }
  }

  async runQuickCheck(): Promise<HealthCheckResult> {
    console.log('⚡ Running quick Ollama health check...\n')
    const startTime = Date.now()
    const checks: HealthCheck[] = []

    try {
      await this.addCheck(checks, 'connectivity', () => this.testConnectivity())
      await this.addCheck(checks, 'model-listing', () => this.testModelListing())
      await this.addCheck(checks, 'health', () => this.testHealth())
    } catch (error) {
      checks.push({
        name: 'quick-check-error',
        status: 'fail',
        message: `Quick check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: 0
      })
    }

    const duration = Date.now() - startTime
    const summary = this.calculateSummary(checks)

    this.printResults(checks, summary, duration)

    return {
      success: summary.failedChecks === 0,
      checks,
      summary,
      duration,
      timestamp: new Date().toISOString()
    }
  }

  private async addCheck(
    checks: HealthCheck[],
    name: string,
    testFn: () => Promise<HealthCheck>
  ): Promise<void> {
    try {
      const result = await testFn()
      checks.push(result)
    } catch (error) {
      checks.push({
        name,
        status: 'fail',
        message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
        duration: 0
      })
    }
  }

  private async testConnectivity(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const health = await this.adapter.getHealth()
      const duration = Date.now() - startTime
      
      if (health.status === 'healthy') {
        return {
          name: 'connectivity',
          status: 'pass',
          message: `Successfully connected to Ollama (${health.latency}ms latency)`,
          details: { health },
          duration
        }
      } else if (health.status === 'degraded') {
        return {
          name: 'connectivity',
          status: 'warn',
          message: `Connected to Ollama but status is degraded: ${health.errors.join(', ')}`,
          details: { health },
          duration
        }
      } else {
        return {
          name: 'connectivity',
          status: 'fail',
          message: `Ollama is unhealthy: ${health.errors.join(', ')}`,
          details: { health },
          duration
        }
      }
    } catch (error) {
      const duration = Date.now() - startTime
      
      if (RuntimeError.isRuntimeError(error)) {
        const strategy = getErrorRecoveryStrategy(error)
        return {
          name: 'connectivity',
          status: 'fail',
          message: `Connection failed: ${error.message}`,
          details: { 
            error: error.toJSON(),
            recovery: strategy
          },
          duration
        }
      }
      
      throw error
    }
  }

  private async testModelListing(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const models = await this.adapter.listModels()
      const duration = Date.now() - startTime
      
      return {
        name: 'model-listing',
        status: 'pass',
        message: `Found ${models.length} models`,
        details: { 
          modelCount: models.length,
          models: models.map(m => ({
            name: m.name,
            size: m.size,
            family: m.details?.family,
            modified: m.modified_at
          }))
        },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }

  private async testRunningModels(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const runningModels = await this.adapter.listRunningModels()
      const duration = Date.now() - startTime
      
      return {
        name: 'running-models',
        status: 'pass',
        message: `${runningModels.length} models currently running`,
        details: {
          runningCount: runningModels.length,
          models: runningModels.map(m => ({
            name: m.name,
            status: m.status,
            expiresAt: m.expires_at
          }))
        },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }

  private async testCapabilities(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const capabilities = await this.adapter.getCapabilities()
      const duration = Date.now() - startTime
      
      const supportedFeatures = Object.entries(capabilities)
        .filter(([_, supported]) => supported)
        .map(([feature]) => feature)
      
      return {
        name: 'capabilities',
        status: 'pass',
        message: `Runtime supports: ${supportedFeatures.join(', ')}`,
        details: { capabilities },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }

  private async testModelLoading(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const models = await this.adapter.listModels()
      
      if (models.length === 0) {
        return {
          name: 'model-loading',
          status: 'warn',
          message: 'No models available to test loading',
          duration: Date.now() - startTime
        }
      }

      // Test getting details for first model
      const testModel = models[0]
      const modelDetails = await this.adapter.showModel(testModel.name)
      const duration = Date.now() - startTime
      
      return {
        name: 'model-loading',
        status: 'pass',
        message: `Successfully loaded details for ${testModel.name}`,
        details: { model: modelDetails },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }

  private async testEmbeddings(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const models = await this.adapter.listModels()
      const embeddingModels = models.filter(m => 
        m.name.toLowerCase().includes('embed') || 
        m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (embeddingModels.length === 0) {
        return {
          name: 'embeddings',
          status: 'warn',
          message: 'No embedding models available',
          duration: Date.now() - startTime
        }
      }

      const testModel = embeddingModels[0]
      const embeddings = await this.adapter.embed({
        model: testModel.name,
        input: 'Test embedding generation'
      })
      const duration = Date.now() - startTime
      
      return {
        name: 'embeddings',
        status: 'pass',
        message: `Generated embeddings with ${testModel.name} (${embeddings[0]?.length} dimensions)`,
        details: { 
          model: testModel.name,
          dimensions: embeddings[0]?.length,
          embeddings: embeddings.length
        },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }

  private async testChat(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const models = await this.adapter.listModels()
      const chatModels = models.filter(m => 
        !m.name.toLowerCase().includes('embed') && 
        !m.details?.family?.toLowerCase().includes('embed')
      )
      
      if (chatModels.length === 0) {
        return {
          name: 'chat',
          status: 'warn',
          message: 'No chat models available',
          duration: Date.now() - startTime
        }
      }

      const testModel = chatModels[0]
      const chatStream = await this.adapter.chat({
        model: testModel.name,
        messages: [{ role: 'user', content: 'Say "Hello, world!"' }]
      })
      
      // Read first response
      const reader = chatStream.getReader()
      const { value: firstEvent } = await reader.read()
      reader.releaseLock()
      
      const duration = Date.now() - startTime
      
      return {
        name: 'chat',
        status: 'pass',
        message: `Chat successful with ${testModel.name}`,
        details: { 
          model: testModel.name,
          firstEvent
        },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }

  private async testPerformance(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const health = await this.adapter.getHealth()
      const duration = Date.now() - startTime
      
      let status: 'pass' | 'warn' | 'fail' = 'pass'
      let message = 'Performance is acceptable'
      
      if (health.latency > 1000) {
        status = 'warn'
        message = `High latency: ${health.latency}ms`
      } else if (health.latency > 5000) {
        status = 'fail'
        message = `Very high latency: ${health.latency}ms`
      }
      
      return {
        name: 'performance',
        status,
        message: `${message} (${health.latency}ms)`,
        details: { latency: health.latency },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }

  private async testHealth(): Promise<HealthCheck> {
    const startTime = Date.now()
    
    try {
      const health = await this.adapter.getHealth()
      const duration = Date.now() - startTime
      
      return {
        name: 'health',
        status: health.status === 'healthy' ? 'pass' : health.status === 'degraded' ? 'warn' : 'fail',
        message: `Health status: ${health.status}`,
        details: { health },
        duration
      }
    } catch (error) {
      const duration = Date.now() - startTime
      throw error
    }
  }

  private calculateSummary(checks: HealthCheck[]) {
    const summary = {
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.status === 'pass').length,
      failedChecks: checks.filter(c => c.status === 'fail').length,
      warnings: checks.filter(c => c.status === 'warn').length
    }
    return summary
  }

  private printResults(checks: HealthCheck[], summary: any, duration: number): void {
    console.log('\n📊 Health Check Results:')
    console.log('========================')
    
    checks.forEach(check => {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'
      console.log(`${icon} ${check.name}: ${check.message} (${check.duration}ms)`)
      
      if (check.details && process.env.VERBOSE === 'true') {
        console.log(`   Details: ${JSON.stringify(check.details, null, 2)}`)
      }
    })
    
    console.log('\n📈 Summary:')
    console.log('===========')
    console.log(`Total checks: ${summary.totalChecks}`)
    console.log(`Passed: ${summary.passedChecks}`)
    console.log(`Failed: ${summary.failedChecks}`)
    console.log(`Warnings: ${summary.warnings}`)
    console.log(`Duration: ${duration}ms`)
    
    const overallStatus = summary.failedChecks === 0 ? '✅ HEALTHY' : '❌ UNHEALTHY'
    console.log(`\nOverall Status: ${overallStatus}`)
  }
}

// Helper function for error recovery strategy
function getErrorRecoveryStrategy(error: RuntimeError): any {
  return {
    canRetry: error.retryable,
    userAction: error.userActionable ? 'Check Ollama configuration and network' : 'Contact support'
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const quick = args.includes('--quick') || args.includes('-q')
  
  const checker = new OllamaHealthChecker()
  
  try {
    const result = quick ? 
      await checker.runQuickCheck() : 
      await checker.runFullHealthCheck()
    
    // Exit with appropriate code
    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error('❌ Health check failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}
