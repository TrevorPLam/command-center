#!/usr/bin/env tsx

import { validateEnv } from '../src/lib/config/env'

interface RuntimeCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  details?: any
}

class RuntimeChecker {
  private checks: RuntimeCheck[] = []

  private addCheck(check: RuntimeCheck) {
    this.checks.push(check)
    console.log(`${this.getStatusIcon(check.status)} ${check.name}: ${check.message}`)
    if (check.details) {
      console.log(`   ${JSON.stringify(check.details, null, 2)}`)
    }
  }

  private getStatusIcon(status: RuntimeCheck['status']): string {
    switch (status) {
      case 'pass':
        return '✅'
      case 'fail':
        return '❌'
      case 'warn':
        return '⚠️'
    }
  }

  async checkOllamaRuntime(): Promise<void> {
    const env = validateEnv()

    try {
      // Check version
      const versionResponse = await fetch(`${env.OLLAMA_BASE_URL}/api/version`, {
        signal: AbortSignal.timeout(5000),
      })

      if (!versionResponse.ok) {
        throw new Error(`Version API failed: ${versionResponse.status}`)
      }

      const version = await versionResponse.json()

      // Check available models
      const modelsResponse = await fetch(`${env.OLLAMA_BASE_URL}/api/tags`, {
        signal: AbortSignal.timeout(10000),
      })

      if (!modelsResponse.ok) {
        throw new Error(`Models API failed: ${modelsResponse.status}`)
      }

      const models = await modelsResponse.json()

      // Check running models
      const runningResponse = await fetch(`${env.OLLAMA_BASE_URL}/api/ps`, {
        signal: AbortSignal.timeout(5000),
      })

      let runningModels = []
      if (runningResponse.ok) {
        const running = await runningResponse.json()
        runningModels = running.models || []
      }

      this.addCheck({
        name: 'Ollama Runtime',
        status: 'pass',
        message: `Ollama ${version.version} with ${models.models?.length || 0} models`,
        details: {
          version: version.version,
          availableModels:
            models.models?.map((m: any) => ({
              name: m.name,
              size: m.size,
              modified_at: m.modified_at,
            })) || [],
          runningModels:
            runningModels.map((m: any) => ({
              name: m.name,
              size: m.size,
              process_id: m.process_id,
            })) || [],
        },
      })
    } catch (error) {
      this.addCheck({
        name: 'Ollama Runtime',
        status: 'fail',
        message: 'Ollama runtime not accessible',
        details: {
          url: env.OLLAMA_BASE_URL,
          error: (error as Error).message,
          suggestion: 'Start Ollama with: ollama serve',
        },
      })
    }
  }

  async checkSystemResources(): Promise<void> {
    try {
      const os = await import('os')

      const totalMemory = os.totalmem()
      const freeMemory = os.freemem()
      const usedMemory = totalMemory - freeMemory
      const memoryUsagePercent = (usedMemory / totalMemory) * 100

      const cpus = os.cpus()
      const loadAverage = os.loadavg()

      const details = {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: {
          total: this.formatBytes(totalMemory),
          free: this.formatBytes(freeMemory),
          used: this.formatBytes(usedMemory),
          usagePercent: Math.round(memoryUsagePercent * 100) / 100,
        },
        cpu: {
          model: cpus[0]?.model,
          cores: cpus.length,
          loadAverage: loadAverage.map((load) => Math.round(load * 100) / 100),
        },
      }

      // Warnings for low resources
      if (memoryUsagePercent > 90) {
        this.addCheck({
          name: 'System Resources',
          status: 'warn',
          message: 'High memory usage detected',
          details,
        })
      } else if (loadAverage[0] && loadAverage[0] > cpus.length * 2) {
        this.addCheck({
          name: 'System Resources',
          status: 'warn',
          message: 'High CPU load detected',
          details,
        })
      } else {
        this.addCheck({
          name: 'System Resources',
          status: 'pass',
          message: 'System resources adequate',
          details,
        })
      }
    } catch (error) {
      this.addCheck({
        name: 'System Resources',
        status: 'fail',
        message: 'Failed to check system resources',
        details: { error: (error as Error).message },
      })
    }
  }

  async checkDatabaseAccess(): Promise<void> {
    const env = validateEnv()

    try {
      // Check if database directory is writable
      const fs = await import('fs/promises')
      const path = await import('path')

      const dbDir = path.dirname(env.DATABASE_URL)

      await fs.access(dbDir, fs.constants.W_OK)

      // Try to create a test file
      const testFile = path.join(dbDir, '.test-write')
      await fs.writeFile(testFile, 'test')
      await fs.unlink(testFile)

      this.addCheck({
        name: 'Database Access',
        status: 'pass',
        message: 'Database directory writable',
        details: { path: env.DATABASE_URL },
      })
    } catch (error) {
      this.addCheck({
        name: 'Database Access',
        status: 'fail',
        message: 'Cannot access database directory',
        details: {
          path: env.DATABASE_URL,
          error: (error as Error).message,
        },
      })
    }
  }

  async checkLanceDBAccess(): Promise<void> {
    const env = validateEnv()

    try {
      const fs = await import('fs/promises')

      await fs.access(env.LANCEDB_DIR, fs.constants.W_OK)

      this.addCheck({
        name: 'LanceDB Access',
        status: 'pass',
        message: 'LanceDB directory accessible',
        details: { path: env.LANCEDB_DIR },
      })
    } catch (error) {
      this.addCheck({
        name: 'LanceDB Access',
        status: 'fail',
        message: 'Cannot access LanceDB directory',
        details: {
          path: env.LANCEDB_DIR,
          error: (error as Error).message,
        },
      })
    }
  }

  async checkNetworkConnectivity(): Promise<void> {
    try {
      // Test basic internet connectivity
      const response = await fetch('https://httpbin.org/get', {
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        this.addCheck({
          name: 'Network Connectivity',
          status: 'pass',
          message: 'Internet connectivity available',
        })
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      this.addCheck({
        name: 'Network Connectivity',
        status: 'warn',
        message: 'Limited or no internet connectivity',
        details: {
          error: (error as Error).message,
          note: 'This is optional for local operation',
        },
      })
    }
  }

  async checkPortAvailability(): Promise<void> {
    const env = validateEnv()
    const port = env.PORT

    try {
      const net = await import('net')

      const server = net.createServer()

      return new Promise((resolve) => {
        server.listen(port, () => {
          server.close(() => {
            this.addCheck({
              name: 'Port Availability',
              status: 'pass',
              message: `Port ${port} is available`,
            })
            resolve(undefined)
          })
        })

        server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            this.addCheck({
              name: 'Port Availability',
              status: 'warn',
              message: `Port ${port} is already in use`,
              details: {
                port,
                suggestion: 'Choose a different port or stop the conflicting service',
              },
            })
          } else {
            this.addCheck({
              name: 'Port Availability',
              status: 'fail',
              message: `Cannot check port ${port}`,
              details: { error: error.message },
            })
          }
          resolve(undefined)
        })
      })
    } catch (error) {
      this.addCheck({
        name: 'Port Availability',
        status: 'fail',
        message: 'Failed to check port availability',
        details: { error: (error as Error).message },
      })
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  async runAllChecks(): Promise<void> {
    console.log('🔍 Command Center Runtime Check')
    console.log('================================\n')

    await this.checkSystemResources()
    await this.checkPortAvailability()
    await this.checkDatabaseAccess()
    await this.checkLanceDBAccess()
    await this.checkNetworkConnectivity()
    await this.checkOllamaRuntime()

    console.log('\n================================')

    const passCount = this.checks.filter((c) => c.status === 'pass').length
    const failCount = this.checks.filter((c) => c.status === 'fail').length
    const warnCount = this.checks.filter((c) => c.status === 'warn').length

    console.log(`Summary: ${passCount} passed, ${warnCount} warnings, ${failCount} failed`)

    if (failCount > 0) {
      console.log(
        '\n❌ Runtime check failed. Address critical issues before running the application.'
      )
      process.exit(1)
    } else if (warnCount > 0) {
      console.log(
        '\n⚠️  Runtime check completed with warnings. The application can run, but some features may be limited.'
      )
    } else {
      console.log('\n✅ Runtime check passed! Your environment is ready for Command Center.')
    }
  }
}

async function main() {
  const checker = new RuntimeChecker()
  await checker.runAllChecks()
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Runtime check failed:', error)
    process.exit(1)
  })
}
