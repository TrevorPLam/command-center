#!/usr/bin/env tsx

/**
 * Promptfoo Evaluation Script
 * 
 * Runs prompt evaluations using Promptfoo with local configuration.
 * Supports different evaluation modes and result processing.
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '../..')

interface EvalOptions {
  mode: 'quick' | 'full' | 'compare' | 'regression'
  providers?: string[]
  prompts?: string[]
  datasets?: string[]
  outputDir?: string
  repeat?: number
  verbose?: boolean
}

interface EvalResult {
  summary: {
    totalTests: number
    passRate: number
    averageScore: number
    duration: number
  }
  results: Array<{
    prompt: string
    provider: string
    dataset: string
    test: string
    score: number
    passed: boolean
    output: string
    latency: number
  }>
  metadata: {
    timestamp: string
    config: string
    mode: string
  }
}

class PromptfooRunner {
  private configPath: string
  private defaultOutputDir: string

  constructor() {
    this.configPath = join(projectRoot, 'promptfoo.config.ts')
    this.defaultOutputDir = join(projectRoot, 'eval-results')
  }

  /**
   * Run evaluation with specified options
   */
  async run(options: EvalOptions): Promise<EvalResult> {
    console.log(`🚀 Starting Promptfoo evaluation (${options.mode} mode)`)
    
    // Ensure output directory exists
    const outputDir = options.outputDir || this.defaultOutputDir
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true })
    }

    // Build command arguments
    const args = this.buildCommandArgs(options)
    const command = `npx promptfoo eval --config ${this.configPath} ${args.join(' ')}`
    
    console.log(`📝 Running: ${command}`)
    
    try {
      const startTime = Date.now()
      
      // Execute promptfoo
      if (options.verbose) {
        execSync(command, { 
          stdio: 'inherit',
          cwd: projectRoot
        })
      } else {
        execSync(command, { 
          stdio: 'pipe',
          cwd: projectRoot
        })
      }
      
      const duration = Date.now() - startTime
      
      // Process results
      const results = await this.processResults(outputDir, options)
      
      console.log(`✅ Evaluation completed in ${duration}ms`)
      console.log(`📊 Pass rate: ${(results.summary.passRate * 100).toFixed(1)}%`)
      console.log(`🎯 Average score: ${results.summary.averageScore.toFixed(2)}`)
      
      return results
    } catch (error) {
      console.error('❌ Evaluation failed:', error)
      throw error
    }
  }

  /**
   * Build command arguments based on options
   */
  private buildCommandArgs(options: EvalOptions): string[] {
    const args: string[] = []

    // Output configuration
    args.push('--output', options.outputDir || this.defaultOutputDir)
    args.push('--format', 'json')

    // Mode-specific settings
    switch (options.mode) {
      case 'quick':
        args.push('--max-concurrency', '1')
        args.push('--repeat', '1')
        break
      case 'full':
        args.push('--max-concurrency', '3')
        args.push('--repeat', options.repeat?.toString() || '3')
        break
      case 'compare':
        args.push('--max-concurrency', '2')
        args.push('--repeat', '1')
        break
      case 'regression':
        args.push('--max-concurrency', '2')
        args.push('--repeat', '1')
        args.push('--regression')
        break
    }

    // Provider filtering
    if (options.providers && options.providers.length > 0) {
      args.push('--providers', options.providers.join(','))
    }

    // Prompt filtering
    if (options.prompts && options.prompts.length > 0) {
      args.push('--prompts', options.prompts.join(','))
    }

    // Dataset filtering
    if (options.datasets && options.datasets.length > 0) {
      args.push('--datasets', options.datasets.join(','))
    }

    // Additional options
    if (options.repeat && options.mode !== 'quick') {
      args.push('--repeat', options.repeat.toString())
    }

    return args
  }

  /**
   * Process and load evaluation results
   */
  private async processResults(outputDir: string, options: EvalOptions): Promise<EvalResult> {
    const resultsFile = join(outputDir, 'results.json')
    
    if (!existsSync(resultsFile)) {
      throw new Error(`Results file not found: ${resultsFile}`)
    }

    const resultsData = JSON.parse(readFileSync(resultsFile, 'utf-8'))
    
    // Process raw results into our format
    const processedResults: EvalResult = {
      summary: {
        totalTests: resultsData.results?.length || 0,
        passRate: this.calculatePassRate(resultsData.results || []),
        averageScore: this.calculateAverageScore(resultsData.results || []),
        duration: resultsData.metadata?.duration || 0,
      },
      results: (resultsData.results || []).map((result: any) => ({
        prompt: result.prompt?.label || 'Unknown',
        provider: result.provider?.label || 'Unknown',
        dataset: result.dataset?.name || 'Unknown',
        test: result.test?.description || 'Unknown',
        score: result.score || 0,
        passed: result.pass || false,
        output: result.output || '',
        latency: result.latency || 0,
      })),
      metadata: {
        timestamp: new Date().toISOString(),
        config: this.configPath,
        mode: options.mode,
      },
    }

    // Save processed results
    const processedFile = join(outputDir, `processed-${Date.now()}.json`)
    writeFileSync(processedFile, JSON.stringify(processedResults, null, 2))
    
    console.log(`📁 Processed results saved to: ${processedFile}`)
    
    return processedResults
  }

  /**
   * Calculate pass rate from results
   */
  private calculatePassRate(results: any[]): number {
    if (results.length === 0) return 0
    const passed = results.filter(r => r.pass).length
    return passed / results.length
  }

  /**
   * Calculate average score from results
   */
  private calculateAverageScore(results: any[]): number {
    if (results.length === 0) return 0
    const totalScore = results.reduce((sum, r) => sum + (r.score || 0), 0)
    return totalScore / results.length
  }

  /**
   * Compare current results with previous baseline
   */
  async compareWithBaseline(baselineFile: string, currentResults: EvalResult): Promise<{
    regressions: string[]
    improvements: string[]
    summary: string
  }> {
    if (!existsSync(baselineFile)) {
      console.log(`⚠️  Baseline file not found: ${baselineFile}`)
      return { regressions: [], improvements: [], summary: 'No baseline for comparison' }
    }

    const baseline = JSON.parse(readFileSync(baselineFile, 'utf-8')) as EvalResult
    
    const regressions: string[] = []
    const improvements: string[] = []

    // Compare summary metrics
    if (currentResults.summary.passRate < baseline.summary.passRate - 0.05) {
      regressions.push(`Pass rate decreased: ${(baseline.summary.passRate * 100).toFixed(1)}% → ${(currentResults.summary.passRate * 100).toFixed(1)}%`)
    } else if (currentResults.summary.passRate > baseline.summary.passRate + 0.05) {
      improvements.push(`Pass rate improved: ${(baseline.summary.passRate * 100).toFixed(1)}% → ${(currentResults.summary.passRate * 100).toFixed(1)}%`)
    }

    if (currentResults.summary.averageScore < baseline.summary.averageScore - 0.1) {
      regressions.push(`Average score decreased: ${baseline.summary.averageScore.toFixed(2)} → ${currentResults.summary.averageScore.toFixed(2)}`)
    } else if (currentResults.summary.averageScore > baseline.summary.averageScore + 0.1) {
      improvements.push(`Average score improved: ${baseline.summary.averageScore.toFixed(2)} → ${currentResults.summary.averageScore.toFixed(2)}`)
    }

    const summary = `Found ${regressions.length} regressions and ${improvements.length} improvements`

    return { regressions, improvements, summary }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const options: EvalOptions = {
    mode: 'quick',
    verbose: false,
  }

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--mode':
        options.mode = args[++i] as any
        break
      case '--providers':
        options.providers = args[++i].split(',')
        break
      case '--prompts':
        options.prompts = args[++i].split(',')
        break
      case '--datasets':
        options.datasets = args[++i].split(',')
        break
      case '--output':
        options.outputDir = args[++i]
        break
      case '--repeat':
        options.repeat = parseInt(args[++i])
        break
      case '--verbose':
      case '-v':
        options.verbose = true
        break
      case '--help':
      case '-h':
        console.log(`
Usage: tsx run-promptfoo.ts [options]

Options:
  --mode <mode>        Evaluation mode: quick, full, compare, regression (default: quick)
  --providers <list>   Comma-separated list of providers to test
  --prompts <list>     Comma-separated list of prompts to test
  --datasets <list>    Comma-separated list of datasets to test
  --output <dir>       Output directory for results
  --repeat <number>    Number of times to repeat each test
  --verbose, -v        Enable verbose output
  --help, -h          Show this help message

Examples:
  tsx run-promptfoo.ts --mode quick
  tsx run-promptfoo.ts --mode full --repeat 3 --verbose
  tsx run-promptfoo.ts --providers ollama:llama3.1 --prompts "Default Assistant,Technical Expert"
        `)
        process.exit(0)
    }
  }

  // Validate mode
  const validModes = ['quick', 'full', 'compare', 'regression']
  if (!validModes.includes(options.mode)) {
    console.error(`❌ Invalid mode: ${options.mode}. Valid modes: ${validModes.join(', ')}`)
    process.exit(1)
  }

  try {
    const runner = new PromptfooRunner()
    const results = await runner.run(options)
    
    // If in regression mode, compare with baseline
    if (options.mode === 'regression') {
      const baselineFile = join(projectRoot, 'eval-results', 'baseline.json')
      const comparison = await runner.compareWithBaseline(baselineFile, results)
      
      console.log('\n📈 Regression Analysis:')
      console.log(comparison.summary)
      
      if (comparison.regressions.length > 0) {
        console.log('\n⚠️  Regressions:')
        comparison.regressions.forEach(regression => console.log(`  - ${regression}`))
      }
      
      if (comparison.improvements.length > 0) {
        console.log('\n✅ Improvements:')
        comparison.improvements.forEach(improvement => console.log(`  - ${improvement}`))
      }
    }
    
    process.exit(0)
  } catch (error) {
    console.error('❌ Evaluation failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { PromptfooRunner, type EvalOptions, type EvalResult }
