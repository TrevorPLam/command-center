/**
 * Startup Security Validation
 * 
 * Provides security warnings and validation for unsafe network settings
 * during application startup.
 */

import { validateStartupNetworkConfig, SecurityValidationResult } from './network-security'

// ============================================================================
// STARTUP VALIDATION TYPES
// ============================================================================

/**
 * Startup validation options
 */
export interface StartupValidationOptions {
  /** Exit on critical security errors */
  exitOnCritical: boolean
  /** Show warnings in console */
  showWarnings: boolean
  /** Show recommendations in console */
  showRecommendations: boolean
  /** Log validation results to file */
  logToFile: boolean
}

/**
 * Security warning levels
 */
export type WarningLevel = 'info' | 'warn' | 'error' | 'critical'

/**
 * Formatted security warning
 */
export interface SecurityWarning {
  level: WarningLevel
  message: string
  recommendation?: string
}

// ============================================================================
// STARTUP VALIDATION DEFAULTS
// ============================================================================

const DEFAULT_OPTIONS: StartupValidationOptions = {
  exitOnCritical: true,
  showWarnings: true,
  showRecommendations: true,
  logToFile: false,
}

// ============================================================================
// STARTUP SECURITY VALIDATOR
// ============================================================================

export class StartupSecurityValidator {
  private options: StartupValidationOptions

  constructor(options: Partial<StartupValidationOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Run comprehensive startup security validation
   */
  async validateStartup(): Promise<SecurityValidationResult> {
    console.log('🔒 Running startup security validation...\n')

    // Validate network configuration
    const networkValidation = validateStartupNetworkConfig()
    
    // Display results
    this.displayValidationResults(networkValidation)
    
    // Handle critical errors
    if (networkValidation.riskLevel === 'critical' && this.options.exitOnCritical) {
      console.error('\n❌ Critical security issues detected. Exiting for safety.')
      console.error('   Fix the issues above or set EXIT_ON_CRITICAL=false to bypass.')
      process.exit(1)
    }

    // Log results if requested
    if (this.options.logToFile) {
      await this.logValidationResults(networkValidation)
    }

    return networkValidation
  }

  /**
   * Display validation results in console
   */
  private displayValidationResults(result: SecurityValidationResult): void {
    const warnings = this.formatWarnings(result)
    
    // Display security status
    if (result.valid) {
      console.log('✅ Security validation passed\n')
    } else {
      console.log('⚠️  Security validation found issues\n')
    }

    // Display risk level
    const riskEmoji = this.getRiskEmoji(result.riskLevel)
    console.log(`Risk Level: ${riskEmoji} ${result.riskLevel.toUpperCase()}\n`)

    // Display errors
    if (result.errors.length > 0) {
      console.log('🚨 SECURITY ERRORS:')
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`)
      })
      console.log('')
    }

    // Display warnings
    if (this.options.showWarnings && warnings.length > 0) {
      console.log('⚠️  SECURITY WARNINGS:')
      warnings.forEach(warning => {
        const emoji = this.getWarningEmoji(warning.level)
        console.log(`   ${emoji} ${warning.message}`)
        if (warning.recommendation && this.options.showRecommendations) {
          console.log(`      💡 ${warning.recommendation}`)
        }
      })
      console.log('')
    }

    // Display recommendations
    if (this.options.showRecommendations && result.recommendations.length > 0) {
      console.log('💡 SECURITY RECOMMENDATIONS:')
      result.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`)
      })
      console.log('')
    }
  }

  /**
   * Format validation results as warnings
   */
  private formatWarnings(result: SecurityValidationResult): SecurityWarning[] {
    const warnings: SecurityWarning[] = []

    // Convert errors to critical warnings
    result.errors.forEach(error => {
      warnings.push({
        level: 'critical',
        message: error,
      })
    })

    // Convert warnings to warn level
    result.warnings.forEach(warning => {
      warnings.push({
        level: 'warn',
        message: warning,
      })
    })

    return warnings
  }

  /**
   * Get emoji for risk level
   */
  private getRiskEmoji(riskLevel: string): string {
    switch (riskLevel) {
      case 'critical': return '🔴'
      case 'high': return '🟠'
      case 'medium': return '🟡'
      case 'low': return '🟢'
      default: return '⚪'
    }
  }

  /**
   * Get emoji for warning level
   */
  private getWarningEmoji(level: WarningLevel): string {
    switch (level) {
      case 'critical': return '🚨'
      case 'error': return '❌'
      case 'warn': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '•'
    }
  }

  /**
   * Log validation results to file
   */
  private async logValidationResults(result: SecurityValidationResult): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const logDir = process.env.LOG_DIR || './data/logs'
      const logFile = path.join(logDir, 'security-validation.log')
      
      // Ensure log directory exists
      await fs.mkdir(logDir, { recursive: true })
      
      // Create log entry
      const logEntry = {
        timestamp: new Date().toISOString(),
        valid: result.valid,
        riskLevel: result.riskLevel,
        errors: result.errors,
        warnings: result.warnings,
        recommendations: result.recommendations,
      }
      
      // Append to log file
      await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n')
      
      console.log(`📝 Security validation logged to: ${logFile}`)
    } catch (error) {
      console.warn('⚠️  Failed to log validation results:', error)
    }
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Run startup security validation with default options
 */
export async function runStartupSecurityValidation(): Promise<SecurityValidationResult> {
  const validator = new StartupSecurityValidator()
  return await validator.validateStartup()
}

/**
 * Quick security check without exiting
 */
export async function quickSecurityCheck(): Promise<SecurityValidationResult> {
  const validator = new StartupSecurityValidator({
    exitOnCritical: false,
    showWarnings: false,
    showRecommendations: false,
    logToFile: false,
  })
  return await validator.validateStartup()
}

/**
 * Get security summary for display
 */
export async function getSecuritySummary(): Promise<{
  status: 'secure' | 'warning' | 'critical'
  message: string
  details: string[]
}> {
  const result = await quickSecurityCheck()
  
  if (result.riskLevel === 'critical') {
    return {
      status: 'critical',
      message: 'Critical security issues detected',
      details: result.errors,
    }
  }
  
  if (result.riskLevel === 'high' || result.errors.length > 0) {
    return {
      status: 'warning',
      message: 'Security issues require attention',
      details: [...result.errors, ...result.warnings],
    }
  }
  
  if (result.warnings.length > 0) {
    return {
      status: 'warning',
      message: 'Security warnings present',
      details: result.warnings,
    }
  }
  
  return {
    status: 'secure',
    message: 'Security configuration is secure',
    details: result.recommendations.slice(0, 3), // Show top recommendations
  }
}
