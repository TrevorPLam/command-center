/**
 * Application-level metrics collection
 * Implements CC-011-2: Build application-level inference, retrieval, queue, and tool metrics emitters
 */

import type { ApplicationMetrics } from './types'

export class ApplicationMetricsCollector {
  private static instance: ApplicationMetricsCollector
  
  // In-memory counters for metrics
  private metrics = {
    inference: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      tokensGenerated: 0
    },
    retrieval: {
      totalQueries: 0,
      totalLatency: 0,
      documentsRetrieved: 0,
      chunksRetrieved: 0
    },
    queue: {
      pendingJobs: 0,
      runningJobs: 0,
      completedJobs: 0,
      failedJobs: 0
    },
    tools: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalExecutionTime: 0
    }
  }

  private constructor() {}

  static getInstance(): ApplicationMetricsCollector {
    if (!ApplicationMetricsCollector.instance) {
      ApplicationMetricsCollector.instance = new ApplicationMetricsCollector()
    }
    return ApplicationMetricsCollector.instance
  }

  /**
   * Collect current application metrics
   */
  async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    const timestamp = Date.now()

    // Get queue metrics from job repository if available
    const queueMetrics = await this.getQueueMetrics()

    return {
      timestamp,
      inference: {
        totalRequests: this.metrics.inference.totalRequests,
        successfulRequests: this.metrics.inference.successfulRequests,
        failedRequests: this.metrics.inference.failedRequests,
        averageLatency: this.metrics.inference.totalRequests > 0 
          ? this.metrics.inference.totalLatency / this.metrics.inference.totalRequests 
          : 0,
        tokensGenerated: this.metrics.inference.tokensGenerated
      },
      retrieval: {
        totalQueries: this.metrics.retrieval.totalQueries,
        averageLatency: this.metrics.retrieval.totalQueries > 0
          ? this.metrics.retrieval.totalLatency / this.metrics.retrieval.totalQueries
          : 0,
        documentsRetrieved: this.metrics.retrieval.documentsRetrieved,
        chunksRetrieved: this.metrics.retrieval.chunksRetrieved
      },
      queue: queueMetrics,
      tools: {
        totalExecutions: this.metrics.tools.totalExecutions,
        successfulExecutions: this.metrics.tools.successfulExecutions,
        failedExecutions: this.metrics.tools.failedExecutions,
        averageExecutionTime: this.metrics.tools.totalExecutions > 0
          ? this.metrics.tools.totalExecutionTime / this.metrics.tools.totalExecutions
          : 0
      }
    }
  }

  /**
   * Record inference request metrics
   */
  recordInferenceRequest(options: {
    success: boolean
    latency: number
    tokensGenerated?: number
  }): void {
    this.metrics.inference.totalRequests++
    this.metrics.inference.totalLatency += options.latency

    if (options.success) {
      this.metrics.inference.successfulRequests++
    } else {
      this.metrics.inference.failedRequests++
    }

    if (options.tokensGenerated) {
      this.metrics.inference.tokensGenerated += options.tokensGenerated
    }
  }

  /**
   * Record retrieval query metrics
   */
  recordRetrievalQuery(options: {
    latency: number
    documentsRetrieved: number
    chunksRetrieved: number
  }): void {
    this.metrics.retrieval.totalQueries++
    this.metrics.retrieval.totalLatency += options.latency
    this.metrics.retrieval.documentsRetrieved += options.documentsRetrieved
    this.metrics.retrieval.chunksRetrieved += options.chunksRetrieved
  }

  /**
   * Record tool execution metrics
   */
  recordToolExecution(options: {
    success: boolean
    executionTime: number
  }): void {
    this.metrics.tools.totalExecutions++
    this.metrics.tools.totalExecutionTime += options.executionTime

    if (options.success) {
      this.metrics.tools.successfulExecutions++
    } else {
      this.metrics.tools.failedExecutions++
    }
  }

  /**
   * Update queue job counts
   */
  updateQueueMetrics(options: {
    pending?: number
    running?: number
    completed?: number
    failed?: number
  }): void {
    if (options.pending !== undefined) {
      this.metrics.queue.pendingJobs = options.pending
    }
    if (options.running !== undefined) {
      this.metrics.queue.runningJobs = options.running
    }
    if (options.completed !== undefined) {
      this.metrics.queue.completedJobs = options.completed
    }
    if (options.failed !== undefined) {
      this.metrics.queue.failedJobs = options.failed
    }
  }

  /**
   * Get queue metrics from database
   */
  private async getQueueMetrics(): Promise<ApplicationMetrics['queue']> {
    try {
      // Try to import job repository dynamically to avoid circular dependencies
      const { jobRepository } = await import('@/lib/app/persistence/job-repository')
      
      const [pending, running, completed, failed] = await Promise.all([
        jobRepository.countByState('queued'),
        jobRepository.countByState('running'),
        jobRepository.countByState('succeeded'),
        jobRepository.countByState('failed')
      ])

      // Update internal metrics
      this.metrics.queue.pendingJobs = pending
      this.metrics.queue.runningJobs = running
      this.metrics.queue.completedJobs = completed
      this.metrics.queue.failedJobs = failed

      return {
        pendingJobs: pending,
        runningJobs: running,
        completedJobs: completed,
        failedJobs: failed
      }
    } catch (error) {
      // Fallback to in-memory metrics if repository unavailable
      return {
        pendingJobs: this.metrics.queue.pendingJobs,
        runningJobs: this.metrics.queue.runningJobs,
        completedJobs: this.metrics.queue.completedJobs,
        failedJobs: this.metrics.queue.failedJobs
      }
    }
  }

  /**
   * Reset all metrics (useful for testing or manual reset)
   */
  resetMetrics(): void {
    this.metrics = {
      inference: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalLatency: 0,
        tokensGenerated: 0
      },
      retrieval: {
        totalQueries: 0,
        totalLatency: 0,
        documentsRetrieved: 0,
        chunksRetrieved: 0
      },
      queue: {
        pendingJobs: 0,
        runningJobs: 0,
        completedJobs: 0,
        failedJobs: 0
      },
      tools: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0
      }
    }
  }

  /**
   * Get current metrics without async operations
   */
  getCurrentMetrics(): Omit<ApplicationMetrics, 'timestamp'> {
    return {
      inference: {
        totalRequests: this.metrics.inference.totalRequests,
        successfulRequests: this.metrics.inference.successfulRequests,
        failedRequests: this.metrics.inference.failedRequests,
        averageLatency: this.metrics.inference.totalRequests > 0 
          ? this.metrics.inference.totalLatency / this.metrics.inference.totalRequests 
          : 0,
        tokensGenerated: this.metrics.inference.tokensGenerated
      },
      retrieval: {
        totalQueries: this.metrics.retrieval.totalQueries,
        averageLatency: this.metrics.retrieval.totalQueries > 0
          ? this.metrics.retrieval.totalLatency / this.metrics.retrieval.totalQueries
          : 0,
        documentsRetrieved: this.metrics.retrieval.documentsRetrieved,
        chunksRetrieved: this.metrics.retrieval.chunksRetrieved
      },
      queue: {
        pendingJobs: this.metrics.queue.pendingJobs,
        runningJobs: this.metrics.queue.runningJobs,
        completedJobs: this.metrics.queue.completedJobs,
        failedJobs: this.metrics.queue.failedJobs
      },
      tools: {
        totalExecutions: this.metrics.tools.totalExecutions,
        successfulExecutions: this.metrics.tools.successfulExecutions,
        failedExecutions: this.metrics.tools.failedExecutions,
        averageExecutionTime: this.metrics.tools.totalExecutions > 0
          ? this.metrics.tools.totalExecutionTime / this.metrics.tools.totalExecutions
          : 0
      }
    }
  }
}

// Export singleton instance
export const applicationMetricsCollector = ApplicationMetricsCollector.getInstance()
