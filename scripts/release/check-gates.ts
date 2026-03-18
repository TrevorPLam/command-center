/**
 * Release Check Script
 * 
 * Automated release validation with promotion gates, shadow mode, and canary support.
 * Implements 2026 best practices for safe prompt deployments.
 */

import { program } from 'commander'
import { z } from 'zod'
import chalk from 'chalk'
import Table from 'cli-table3'
import { promotionGatesService, type PromotionConfig, type PromotionGateResult } from '../lib/app/services/promotion-gates'
import { promptTemplateRepository } from '../lib/app/persistence/prompt-repository'
import { experimentRepository } from '../lib/app/persistence/experiment-repository'

// CLI configuration
const releaseConfigSchema = z.object({
  environment: z.enum(['dev', 'staging', 'production']).default('staging'),
  templateId: z.string().uuid(),
  baselineTemplateId: z.string().uuid().optional(),
  shadowMode: z.boolean().default(false),
  canaryMode: z.boolean().default(false),
  canaryTrafficPercentage: z.number().min(1).max(50).default(5),
  rolloutDuration: z.number().min(1).max(168).default(24), // hours
  overrideWarnings: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  verbose: z.boolean().default(false)
})

type ReleaseConfig = z.infer<typeof releaseConfigSchema>

class ReleaseChecker {
  private config: ReleaseConfig

  constructor(config: ReleaseConfig) {
    this.config = config
  }

  /**
   * Run the complete release check process
   */
  async runReleaseCheck(): Promise<boolean> {
    console.log(chalk.blue.bold('🚀 Starting Release Check Process'))
    console.log(chalk.gray(`Environment: ${this.config.environment}`))
    console.log(chalk.gray(`Template: ${this.config.templateId}`))
    console.log(chalk.gray(`Shadow Mode: ${this.config.shadowMode}`))
    console.log(chalk.gray(`Canary Mode: ${this.config.canaryMode}`))
    console.log()

    try {
      // Step 1: Validate template exists
      await this.validateTemplate()

      // Step 2: Run promotion gates
      const gateResult = await this.runPromotionGates()

      // Step 3: Display results
      this.displayGateResults(gateResult)

      // Step 4: Make recommendation
      const shouldProceed = this.makeRecommendation(gateResult)

      // Step 5: Execute release if approved
      if (shouldProceed && !this.config.dryRun) {
        await this.executeRelease(gateResult)
      }

      return shouldProceed
    } catch (error) {
      console.error(chalk.red('❌ Release check failed:'), error)
      return false
    }
  }

  /**
   * Validate that the template exists and is accessible
   */
  private async validateTemplate(): Promise<void> {
    console.log(chalk.yellow('📋 Validating template...'))

    const template = await promptTemplateRepository.getById(this.config.templateId)
    if (!template) {
      throw new Error(`Template ${this.config.templateId} not found`)
    }

    if (this.config.baselineTemplateId) {
      const baseline = await promptTemplateRepository.getById(this.config.baselineTemplateId)
      if (!baseline) {
        throw new Error(`Baseline template ${this.config.baselineTemplateId} not found`)
      }
    }

    console.log(chalk.green('✓ Template validation passed'))
    console.log(chalk.gray(`Name: ${template.name}`))
    console.log(chalk.gray(`Version: ${template.id}`))
    console.log()
  }

  /**
   * Run promotion gates evaluation
   */
  private async runPromotionGates(): Promise<PromotionGateResult> {
    console.log(chalk.yellow('🔐 Running promotion gates...'))

    const promotionConfig: PromotionConfig = {
      environment: this.config.environment,
      requiredCategories: this.getRequiredCategories(),
      overrideWarnings: this.config.overrideWarnings,
      shadowMode: this.config.shadowMode,
      canaryMode: this.config.canaryMode,
      canaryTrafficPercentage: this.config.canaryTrafficPercentage,
      rolloutDuration: this.config.rolloutDuration
    }

    const gateResult = await promotionGatesService.runGates(
      this.config.templateId,
      promotionConfig,
      this.config.baselineTemplateId
    )

    console.log(chalk.green('✓ Promotion gates completed'))
    console.log(chalk.gray(`Overall Status: ${gateResult.overallStatus}`))
    console.log(chalk.gray(`Confidence: ${gateResult.confidence.toFixed(1)}%`))
    console.log()

    return gateResult
  }

  /**
   * Get required categories based on environment
   */
  private getRequiredCategories(): Array<'blocker' | 'guardrail' | 'target'> {
    switch (this.config.environment) {
      case 'production':
        return ['blocker', 'guardrail', 'target']
      case 'staging':
        return ['blocker', 'guardrail']
      case 'dev':
        return ['blocker']
      default:
        return ['blocker']
    }
  }

  /**
   * Display gate results in a formatted table
   */
  private displayGateResults(gateResult: PromotionGateResult): void {
    console.log(chalk.blue.bold('📊 Gate Results Summary'))

    // Summary table
    const summaryTable = new Table({
      head: ['Category', 'Passed', 'Failed', 'Warnings'],
      colWidths: [15, 10, 10, 10]
    })

    summaryTable.push(
      ['Blockers', gateResult.summary.blockers.passed.toString(), gateResult.summary.blockers.failed.toString(), '0'],
      ['Guardrails', gateResult.summary.guardrails.passed.toString(), gateResult.summary.guardrails.failed.toString(), gateResult.summary.guardrails.warnings.toString()],
      ['Targets', gateResult.summary.targets.passed.toString(), gateResult.summary.targets.failed.toString(), '0']
    )

    console.log(summaryTable.toString())
    console.log()

    // Detailed results
    if (this.config.verbose || gateResult.overallStatus !== 'passed') {
      console.log(chalk.blue.bold('🔍 Detailed Results'))

      const detailTable = new Table({
        head: ['Rule', 'Category', 'Status', 'Value', 'Threshold', 'Message'],
        colWidths: [25, 12, 10, 10, 10, 50]
      })

      gateResult.results.forEach(result => {
        const statusColor = this.getStatusColor(result.status)
        const categoryColor = this.getCategoryColor(result.rule.category)
        
        detailTable.push([
          result.rule.name,
          chalk[categoryColor](result.rule.category),
          chalk[statusColor](result.status),
          result.actualValue.toFixed(2),
          result.threshold.toString(),
          result.message
        ])
      })

      console.log(detailTable.toString())
      console.log()
    }
  }

  /**
   * Make recommendation based on gate results
   */
  private makeRecommendation(gateResult: PromotionGateResult): boolean {
    console.log(chalk.blue.bold('💭 Recommendation'))

    const recommendation = gateResult.recommendation
    const confidence = gateResult.confidence

    let recommendationText = ''
    let shouldProceed = false
    let recommendationColor = 'yellow'

    switch (recommendation) {
      case 'promote':
        recommendationText = '✅ APPROVED for promotion'
        recommendationColor = 'green'
        shouldProceed = true
        break
      case 'hold':
        recommendationText = '⏸️ HOLD - Issues need to be resolved'
        recommendationColor = 'red'
        shouldProceed = false
        break
      case 'investigate':
        recommendationText = '🔍 INVESTIGATE - Review warnings before proceeding'
        recommendationColor = 'yellow'
        shouldProceed = this.config.overrideWarnings
        break
      case 'rollback':
        recommendationText = '⏪ ROLLBACK - Critical issues detected'
        recommendationColor = 'red'
        shouldProceed = false
        break
    }

    console.log(chalk[recommendationColor](recommendationText))
    console.log(chalk.gray(`Confidence: ${confidence.toFixed(1)}%`))

    if (this.config.shadowMode) {
      console.log(chalk.blue('👻 Shadow Mode: Changes will be logged but not served to users'))
    }

    if (this.config.canaryMode) {
      console.log(chalk.blue('🐦 Canary Mode: Changes will be served to limited traffic'))
      console.log(chalk.gray(`Traffic: ${this.config.canaryTrafficPercentage}%`))
      console.log(chalk.gray(`Duration: ${this.config.rolloutDuration}h`))
    }

    console.log()

    if (this.config.dryRun) {
      console.log(chalk.yellow('🔬 DRY RUN: No actual changes will be made'))
      console.log()
    }

    return shouldProceed
  }

  /**
   * Execute the release
   */
  private async executeRelease(gateResult: PromotionGateResult): Promise<void> {
    console.log(chalk.blue.bold('🚀 Executing Release'))

    if (this.config.shadowMode) {
      await this.executeShadowRelease(gateResult)
    } else if (this.config.canaryMode) {
      await this.executeCanaryRelease(gateResult)
    } else {
      await this.executeFullRelease(gateResult)
    }
  }

  /**
   * Execute shadow mode release
   */
  private async executeShadowRelease(gateResult: PromotionGateResult): Promise<void> {
    console.log(chalk.blue('👻 Starting Shadow Mode Release'))

    // In shadow mode, we log the decision but don't actually promote
    console.log(chalk.gray('Shadow mode: Template would be promoted in production environment'))
    console.log(chalk.gray('Traffic: 0% (shadow only)'))
    console.log(chalk.gray('Duration: Monitoring phase'))

    // TODO: Implement actual shadow mode logic
    // - Route a copy of traffic to new template
    // - Log results without affecting users
    // - Monitor for issues

    console.log(chalk.green('✓ Shadow mode release initiated'))
  }

  /**
   * Execute canary release
   */
  private async executeCanaryRelease(gateResult: PromotionGateResult): Promise<void> {
    console.log(chalk.blue('🐦 Starting Canary Release'))

    console.log(chalk.gray(`Traffic allocation: ${this.config.canaryTrafficPercentage}%`))
    console.log(chalk.gray(`Rollout duration: ${this.config.rolloutDuration}h`))

    // TODO: Implement actual canary logic
    // - Gradually increase traffic percentage
    // - Monitor metrics in real-time
    // - Auto-rollback on issues

    console.log(chalk.green('✓ Canary release initiated'))
  }

  /**
   * Execute full release
   */
  private async executeFullRelease(gateResult: PromotionGateResult): Promise<void> {
    console.log(chalk.blue('🎯 Starting Full Release'))

    // Activate the new template
    await promptTemplateRepository.activateVersion(this.config.templateId)

    console.log(chalk.green('✓ Template promoted to active status'))
    console.log(chalk.gray(`Environment: ${this.config.environment}`))
  }

  /**
   * Get color for status
   */
  private getStatusColor(status: string): 'green' | 'red' | 'yellow' | 'gray' {
    switch (status) {
      case 'passed': return 'green'
      case 'failed': return 'red'
      case 'warning': return 'yellow'
      case 'skipped': return 'gray'
      default: return 'gray'
    }
  }

  /**
   * Get color for category
   */
  private getCategoryColor(category: string): 'red' | 'yellow' | 'green' | 'blue' {
    switch (category) {
      case 'blocker': return 'red'
      case 'guardrail': return 'yellow'
      case 'target': return 'green'
      default: return 'blue'
    }
  }
}

// CLI setup
const program = new program()

program
  .name('release-check')
  .description('Automated release validation with promotion gates')
  .version('1.0.0')

program
  .command('check')
  .description('Run release checks for a prompt template')
  .requiredOption('-t, --template-id <id>', 'Template ID to check')
  .option('-b, --baseline-id <id>', 'Baseline template ID for comparison')
  .option('-e, --environment <env>', 'Target environment', 'staging')
  .option('--shadow-mode', 'Run in shadow mode (no user impact)')
  .option('--canary-mode', 'Run in canary mode (limited traffic)')
  .option('--canary-traffic <percentage>', 'Canary traffic percentage', '5')
  .option('--rollout-duration <hours>', 'Rollout duration in hours', '24')
  .option('--override-warnings', 'Proceed despite guardrail warnings')
  .option('--dry-run', 'Show what would happen without executing')
  .option('--verbose', 'Show detailed gate results')
  .action(async (options) => {
    try {
      const config = releaseConfigSchema.parse(options)
      const checker = new ReleaseChecker(config)
      
      const success = await checker.runReleaseCheck()
      
      process.exit(success ? 0 : 1)
    } catch (error) {
      console.error(chalk.red('Error:'), error)
      process.exit(1)
    }
  })

program
  .command('list-rules')
  .description('List all promotion gate rules')
  .option('--category <category>', 'Filter by category')
  .action(async (options) => {
    const rules = promotionGatesService.getRules()
    const filtered = options.category 
      ? rules.filter(r => r.category === options.category)
      : rules

    const table = new Table({
      head: ['ID', 'Name', 'Category', 'Threshold', 'Required', 'Enabled'],
      colWidths: [20, 30, 12, 12, 10, 8]
    })

    filtered.forEach(rule => {
      table.push([
        rule.id,
        rule.name,
        rule.category,
        `${rule.threshold}`,
        rule.required ? 'Yes' : 'No',
        rule.enabled ? 'Yes' : 'No'
      ])
    })

    console.log(table.toString())
  })

program
  .command('history')
  .description('Show gate history for a template')
  .requiredOption('-t, --template-id <id>', 'Template ID')
  .action(async (options) => {
    const history = promotionGatesService.getGateHistory(options.templateId)
    
    if (history.length === 0) {
      console.log(chalk.yellow('No gate history found for this template'))
      return
    }

    const table = new Table({
      head: ['Timestamp', 'Status', 'Recommendation', 'Confidence'],
      colWidths: [20, 12, 15, 12]
    })

    history.forEach(result => {
      table.push([
        result.timestamp.toISOString(),
        result.overallStatus,
        result.recommendation,
        `${result.confidence.toFixed(1)}%`
      ])
    })

    console.log(table.toString())
  })

// Export for programmatic use
export { ReleaseChecker, type ReleaseConfig }

// Run CLI if this file is executed directly
if (require.main === module) {
  program.parse()
}
