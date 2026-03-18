#!/usr/bin/env tsx

/**
 * Worker Runner Script
 * 
 * Standalone script for running job workers with proper signal handling,
 * graceful shutdown, and monitoring.
 */

import { randomUUID } from 'crypto'
import { workerManager } from '../src/lib/app/services/job-worker'

interface WorkerConfig {
  maxConcurrentJobs: number
  pollIntervalMs: number
  heartbeatIntervalMs: number
  jobTimeoutMs: number
  enableMetrics: boolean
}

/**
 * Parse command line arguments
 */
function parseArgs(): WorkerConfig & { workerCount: number; verbose: boolean } {
  const args = process.argv.slice(2)
  const config: any = {
    workerCount: 1,
    maxConcurrentJobs: 3,
    pollIntervalMs: 5000,
    heartbeatIntervalMs: 30000,
    jobTimeoutMs: 300000,
    enableMetrics: true,
    verbose: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--workers':
      case '-w':
        config.workerCount = parseInt(args[++i]) || 1
        break
      case '--max-concurrent':
      case '-c':
        config.maxConcurrentJobs = parseInt(args[++i]) || 3
        break
      case '--poll-interval':
        config.pollIntervalMs = parseInt(args[++i]) || 5000
        break
      case '--timeout':
        config.jobTimeoutMs = parseInt(args[++i]) || 300000
        break
      case '--no-metrics':
        config.enableMetrics = false
        break
      case '--verbose':
      case '-v':
        config.verbose = true
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
        break
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`)
          printUsage()
          process.exit(1)
        }
    }
  }

  return config
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Usage: tsx run-worker.ts [options]

Options:
  -w, --workers <num>         Number of worker processes to start (default: 1)
  -c, --max-concurrent <num>   Maximum concurrent jobs per worker (default: 3)
  --poll-interval <ms>         Job polling interval in milliseconds (default: 5000)
  --timeout <ms>               Job timeout in milliseconds (default: 300000)
  --no-metrics                 Disable metrics collection
  -v, --verbose                Enable verbose logging
  -h, --help                   Show this help message

Examples:
  tsx run-worker.ts                           # Start 1 worker with defaults
  tsx run-worker.ts --workers 3               # Start 3 workers
  tsx run-worker.ts -w 2 -c 5 --verbose       # Start 2 workers, 5 concurrent jobs each
  tsx run-worker.ts --timeout 600000         # 10 minute job timeout
`)
}

/**
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers(workers: string[]): void {
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`)
    
    try {
      await workerManager.stopAll()
      console.log('All workers stopped successfully')
      process.exit(0)
    } catch (error) {
      console.error('Error during shutdown:', error)
      process.exit(1)
    }
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGUSR2', () => shutdown('SIGUSR2')) // For nodemon
}

/**
 * Setup event handlers for workers
 */
function setupEventHandlers(verbose: boolean): void {
  workerManager.getWorkers().forEach(worker => {
    worker.on('worker-started', ({ workerId }) => {
      console.log(`✓ Worker ${workerId} started`)
    })

    worker.on('worker-stopped', ({ workerId, metrics }) => {
      if (verbose) {
        console.log(`✓ Worker ${workerId} stopped. Metrics:`, {
          jobsProcessed: metrics.jobsProcessed,
          jobsSucceeded: metrics.jobsSucceeded,
          jobsFailed: metrics.jobsFailed,
          averageProcessingTimeMs: Math.round(metrics.averageProcessingTimeMs)
        })
      } else {
        console.log(`✓ Worker ${workerId} stopped`)
      }
    })

    worker.on('job-started', ({ job, workerId }) => {
      if (verbose) {
        console.log(`🔄 Worker ${workerId} started job ${job.id} (${job.type})`)
      }
    })

    worker.on('job-completed', ({ job, workerId, processingTime }) => {
      if (verbose) {
        console.log(`✅ Worker ${workerId} completed job ${job.id} in ${processingTime}ms`)
      }
    })

    worker.on('job-failed', ({ job, workerId, error }) => {
      console.error(`❌ Worker ${workerId} failed job ${job.id}:`, error)
    })

    worker.on('job-stopped', ({ jobId, workerId }) => {
      if (verbose) {
        console.log(`⏹️ Worker ${workerId} stopped job ${jobId}`)
      }
    })

    worker.on('poll-error', (error) => {
      console.error('Poll error:', error)
    })

    worker.on('heartbeat', ({ metrics }) => {
      if (verbose && metrics.jobsProcessed > 0 && metrics.jobsProcessed % 10 === 0) {
        console.log(`💓 Worker ${metrics.workerId} heartbeat:`, {
          currentConcurrency: metrics.currentConcurrency,
          jobsProcessed: metrics.jobsProcessed,
          successRate: `${Math.round((metrics.jobsSucceeded / metrics.jobsProcessed) * 100)}%`
        })
      }
    })

    worker.on('error', (error) => {
      console.error('Worker error:', error)
    })
  })
}

/**
 * Print status information
 */
function printStatus(): void {
  const workers = workerManager.getWorkers()
  const metrics = workerManager.getAggregateMetrics()
  
  if (workers.length === 0) {
    console.log('No workers running')
    return
  }

  const totalJobs = metrics.reduce((sum, m) => sum + m.jobsProcessed, 0)
  const totalSucceeded = metrics.reduce((sum, m) => sum + m.jobsSucceeded, 0)
  const totalFailed = metrics.reduce((sum, m) => sum + m.jobsFailed, 0)
  const avgProcessingTime = metrics.reduce((sum, m) => sum + m.averageProcessingTimeMs, 0) / metrics.length

  console.log(`
Worker Status:
=============
Workers: ${workers.length}
Total Jobs Processed: ${totalJobs}
Success Rate: ${totalJobs > 0 ? Math.round((totalSucceeded / totalJobs) * 100) : 0}%
Average Processing Time: ${Math.round(avgProcessingTime)}ms

Worker Details:
${metrics.map(m => `  ${m.workerId}: ${m.currentConcurrency}/${m.maxConcurrentJobs} jobs, ${m.jobsProcessed} processed`).join('\n')}
`)
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    const config = parseArgs()
    
    console.log('🚀 Starting Job Workers')
    console.log(`Configuration:`, {
      workerCount: config.workerCount,
      maxConcurrentJobs: config.maxConcurrentJobs,
      pollIntervalMs: config.pollIntervalMs,
      jobTimeoutMs: config.jobTimeoutMs,
      enableMetrics: config.enableMetrics,
      verbose: config.verbose
    })

    // Start workers
    const workerIds: string[] = []
    for (let i = 0; i < config.workerCount; i++) {
      try {
        const worker = await workerManager.createWorker()
        workerIds.push(worker.getMetrics().workerId)
      } catch (error) {
        console.error(`Failed to start worker ${i + 1}:`, error)
        process.exit(1)
      }
    }

    // Setup event handlers
    setupEventHandlers(config.verbose)
    setupShutdownHandlers(workerIds)

    console.log(`✅ Started ${workerIds.length} worker(s) successfully`)
    
    if (config.verbose) {
      console.log('Workers:', workerIds)
      
      // Print status every 30 seconds in verbose mode
      setInterval(printStatus, 30000)
    }

    // Print initial status
    if (config.workerCount > 1 || config.verbose) {
      setTimeout(printStatus, 2000)
    }

    console.log('Press Ctrl+C to stop workers gracefully')

  } catch (error) {
    console.error('Failed to start workers:', error)
    process.exit(1)
  }
}

// Run main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error)
    process.exit(1)
  })
}
