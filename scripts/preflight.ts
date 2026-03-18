#!/usr/bin/env tsx

import { validateEnv } from '../src/lib/config/env'
import { bootstrapRuntime } from '../src/lib/config/runtime'
import { runStartupSecurityValidation } from '../src/lib/app/security/startup-validation'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

interface HealthCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  details?: any
}

class PreflightChecker {
  private checks: HealthCheck[] = []

  private addCheck(check: HealthCheck) {
    this.checks.push(check)
    console.log(`${this.getStatusIcon(check.status)} ${check.name}: ${check.message}`)
    if (check.details) {
      console.log(`   ${JSON.stringify(check.details, null, 2)}`)
    }
  }

  private getStatusIcon(status: HealthCheck['status']): string {
    switch (status) {
      case 'pass':
        return '✅'
      case 'fail':
        return '❌'
      case 'warn':
        return '⚠️'
    }
  }

  async checkNodeVersion(): Promise<void> {
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0')

    if (majorVersion < 20) {
      this.addCheck({
        name: 'Node.js Version',
        status: 'fail',
        message: `Node.js 20+ required, found ${nodeVersion}`,
        details: { required: '>=20.0.0', found: nodeVersion },
      })
      process.exit(1)
    } else {
      this.addCheck({
        name: 'Node.js Version',
        status: 'pass',
        message: `Node.js ${nodeVersion}`,
      })
    }
  }

  async checkPackageManager(): Promise<void> {
    try {
      const { execSync } = require('child_process')
      const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim()

      this.addCheck({
        name: 'Package Manager',
        status: 'pass',
        message: `pnpm ${pnpmVersion}`,
      })
    } catch (error) {
      this.addCheck({
        name: 'Package Manager',
        status: 'fail',
        message: 'pnpm not found or not working',
        details: { error: (error as Error).message },
      })
    }
  }

  async checkEnvironmentVariables(): Promise<void> {
    try {
      const env = validateEnv()
      this.addCheck({
        name: 'Environment Variables',
        status: 'pass',
        message: 'All environment variables valid',
        details: {
          NODE_ENV: env.NODE_ENV,
          OLLAMA_BASE_URL: env.OLLAMA_BASE_URL,
          DATABASE_URL: env.DATABASE_URL,
          LANCEDB_DIR: env.LANCEDB_DIR,
          LOG_DIR: env.LOG_DIR,
        },
      })
    } catch (error) {
      this.addCheck({
        name: 'Environment Variables',
        status: 'fail',
        message: 'Invalid environment variables',
        details: { error: (error as Error).message },
      })
    }
  }

  async checkDirectories(): Promise<void> {
    const env = validateEnv()
    const requiredDirs = [
      { name: 'Database directory', path: require('path').dirname(env.DATABASE_URL) },
      { name: 'LanceDB directory', path: env.LANCEDB_DIR },
      { name: 'Log directory', path: env.LOG_DIR },
    ]

    for (const dir of requiredDirs) {
      try {
        if (!existsSync(dir.path)) {
          mkdirSync(dir.path, { recursive: true })
          this.addCheck({
            name: dir.name,
            status: 'pass',
            message: `Created directory: ${dir.path}`,
          })
        } else {
          this.addCheck({
            name: dir.name,
            status: 'pass',
            message: `Directory exists: ${dir.path}`,
          })
        }
      } catch (error) {
        this.addCheck({
          name: dir.name,
          status: 'fail',
          message: `Cannot create directory: ${dir.path}`,
          details: { error: (error as Error).message },
        })
      }
    }
  }

  async checkOllamaConnectivity(): Promise<void> {
    const env = validateEnv()

    try {
      const response = await fetch(`${env.OLLAMA_BASE_URL}/api/version`, {
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const version = await response.json()
      this.addCheck({
        name: 'Ollama Connectivity',
        status: 'pass',
        message: `Ollama ${version.version}`,
        details: { url: env.OLLAMA_BASE_URL, version: version.version },
      })
    } catch (error) {
      this.addCheck({
        name: 'Ollama Connectivity',
        status: 'warn',
        message: 'Cannot connect to Ollama',
        details: {
          url: env.OLLAMA_BASE_URL,
          error: (error as Error).message,
          suggestion: 'Make sure Ollama is running on the configured URL',
        },
      })
    }
  }

  async checkDependencies(): Promise<void> {
    try {
      const { execSync } = require('child_process')
      const result = execSync('pnpm list --depth=0', { encoding: 'utf8' })

      this.addCheck({
        name: 'Dependencies',
        status: 'pass',
        message: 'Dependencies installed',
        details: { lines: result.split('\n').length },
      })
    } catch (error) {
      this.addCheck({
        name: 'Dependencies',
        status: 'fail',
        message: 'Dependency check failed',
        details: { error: (error as Error).message },
      })
    }
  }

  async checkTypeScript(): Promise<void> {
    try {
      const { execSync } = require('child_process')
      execSync('pnpm run type-check', { stdio: 'pipe' })

      this.addCheck({
        name: 'TypeScript',
        status: 'pass',
        message: 'TypeScript compilation successful',
      })
    } catch (error) {
      this.addCheck({
        name: 'TypeScript',
        status: 'fail',
        message: 'TypeScript compilation failed',
        details: { error: (error as Error).message },
      })
    }
  }

  async checkSecurity(): Promise<void> {
    try {
      const securityResult = await runStartupSecurityValidation()
      
      if (securityResult.valid) {
        this.addCheck({
          name: 'Security Configuration',
          status: 'pass',
          message: 'Security configuration is valid',
          details: { riskLevel: securityResult.riskLevel },
        })
      } else {
        this.addCheck({
          name: 'Security Configuration',
          status: 'warn',
          message: 'Security issues detected',
          details: { 
            riskLevel: securityResult.riskLevel,
            errors: securityResult.errors.length,
            warnings: securityResult.warnings.length,
          },
        })
      }
    } catch (error) {
      this.addCheck({
        name: 'Security Configuration',
        status: 'fail',
        message: 'Security validation failed',
        details: { error: (error as Error).message },
      })
    }
  }

  async runAllChecks(): Promise<void> {
    console.log('🚀 Command Center Preflight Check')
    console.log('==================================\n')

    await this.checkNodeVersion()
    await this.checkPackageManager()
    await this.checkEnvironmentVariables()
    await this.checkDirectories()
    await this.checkDependencies()
    await this.checkTypeScript()
    await this.checkSecurity()
    await this.checkOllamaConnectivity()

    console.log('\n==================================')

    const passCount = this.checks.filter((c) => c.status === 'pass').length
    const failCount = this.checks.filter((c) => c.status === 'fail').length
    const warnCount = this.checks.filter((c) => c.status === 'warn').length

    console.log(`Summary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`)

    if (failCount > 0) {
      console.log('\n❌ Preflight check failed. Fix the issues above before proceeding.')
      process.exit(1)
    } else if (warnCount > 0) {
      console.log(
        '\n⚠️  Preflight check passed with warnings. You can proceed, but consider addressing the warnings.'
      )
    } else {
      console.log("\n✅ Preflight check passed! You're ready to start development.")
    }
  }
}

async function main() {
  const checker = new PreflightChecker()
  await checker.runAllChecks()
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Preflight check failed:', error)
    process.exit(1)
  })
}
