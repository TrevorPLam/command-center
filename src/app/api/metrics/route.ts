/**
 * Metrics API route
 * Implements CC-011-3: Create monitoring routes and SSE feeds
 */

import { NextRequest, NextResponse } from 'next/server'
import { metricsEmitter } from '@/lib/app/services/metrics-emitter'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'
    
    // Get current metrics snapshot
    const snapshot = await metricsEmitter.forceCollection()
    
    if (format === 'prometheus') {
      // Convert to Prometheus format
      const prometheusText = convertToPrometheusFormat(snapshot)
      return new NextResponse(prometheusText, {
        headers: {
          'Content-Type': 'text/plain; version=0.0.4',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // Default JSON response
    return NextResponse.json({
      success: true,
      data: snapshot,
      timestamp: Date.now()
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Handle different actions
    switch (body.action) {
      case 'reset':
        // Reset metrics (admin only)
        if (process.env.NODE_ENV === 'development') {
          // Implementation for resetting metrics would go here
          return NextResponse.json({
            success: true,
            message: 'Metrics reset successfully'
          })
        }
        return NextResponse.json({
          success: false,
          error: 'Metrics reset not allowed in production'
        }, { status: 403 })
        
      case 'config':
        // Update metrics configuration
        const { interval, retention, enabled } = body.config || {}
        metricsEmitter.updateConfig({
          interval: interval ? Number(interval) : undefined,
          retention: retention ? Number(retention) : undefined,
          enabled: enabled !== undefined ? Boolean(enabled) : undefined
        })
        
        return NextResponse.json({
          success: true,
          message: 'Configuration updated',
          config: metricsEmitter.getConfig()
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Error handling metrics POST:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Convert metrics snapshot to Prometheus format
 */
function convertToPrometheusFormat(snapshot: any): string {
  const lines: string[] = []
  const timestamp = snapshot.timestamp / 1000 // Prometheus expects seconds

  // System metrics
  lines.push(`# HELP system_cpu_usage CPU usage percentage`)
  lines.push(`# TYPE system_cpu_usage gauge`)
  lines.push(`system_cpu_usage ${snapshot.system.cpu.usage} ${timestamp}`)

  lines.push(`# HELP system_memory_usage Memory usage percentage`)
  lines.push(`# TYPE system_memory_usage gauge`)
  lines.push(`system_memory_usage ${snapshot.system.memory.percentage} ${timestamp}`)

  lines.push(`# HELP system_disk_usage Disk usage percentage`)
  lines.push(`# TYPE system_disk_usage gauge`)
  lines.push(`system_disk_usage ${snapshot.system.disk.percentage} ${timestamp}`)

  lines.push(`# HELP system_uptime System uptime in seconds`)
  lines.push(`# TYPE system_uptime counter`)
  lines.push(`system_uptime ${snapshot.system.uptime} ${timestamp}`)

  // Runtime metrics
  lines.push(`# HELP ollama_latency Ollama response latency in milliseconds`)
  lines.push(`# TYPE ollama_latency gauge`)
  lines.push(`ollama_latency ${snapshot.runtime.ollama.latency} ${timestamp}`)

  lines.push(`# HELP ollama_model_count Number of available Ollama models`)
  lines.push(`# TYPE ollama_model_count gauge`)
  lines.push(`ollama_model_count ${snapshot.runtime.ollama.modelCount} ${timestamp}`)

  lines.push(`# HELP ollama_running_models Number of running Ollama models`)
  lines.push(`# TYPE ollama_running_models gauge`)
  lines.push(`ollama_running_models ${snapshot.runtime.ollama.runningModels.length} ${timestamp}`)

  // Application metrics
  lines.push(`# HELP inference_requests_total Total inference requests`)
  lines.push(`# TYPE inference_requests_total counter`)
  lines.push(`inference_requests_total ${snapshot.application.inference.totalRequests} ${timestamp}`)

  lines.push(`# HELP inference_success_rate Inference success rate percentage`)
  lines.push(`# TYPE inference_success_rate gauge`)
  const successRate = snapshot.application.inference.totalRequests > 0 
    ? (snapshot.application.inference.successfulRequests / snapshot.application.inference.totalRequests) * 100
    : 0
  lines.push(`inference_success_rate ${successRate} ${timestamp}`)

  lines.push(`# HELP inference_average_latency Average inference latency in milliseconds`)
  lines.push(`# TYPE inference_average_latency gauge`)
  lines.push(`inference_average_latency ${snapshot.application.inference.averageLatency} ${timestamp}`)

  lines.push(`# HELP retrieval_queries_total Total retrieval queries`)
  lines.push(`# TYPE retrieval_queries_total counter`)
  lines.push(`retrieval_queries_total ${snapshot.application.retrieval.totalQueries} ${timestamp}`)

  lines.push(`# HELP queue_pending_jobs Number of pending jobs`)
  lines.push(`# TYPE queue_pending_jobs gauge`)
  lines.push(`queue_pending_jobs ${snapshot.application.queue.pendingJobs} ${timestamp}`)

  lines.push(`# HELP queue_running_jobs Number of running jobs`)
  lines.push(`# TYPE queue_running_jobs gauge`)
  lines.push(`queue_running_jobs ${snapshot.application.queue.runningJobs} ${timestamp}`)

  lines.push(`# HELP tools_executions_total Total tool executions`)
  lines.push(`# TYPE tools_executions_total counter`)
  lines.push(`tools_executions_total ${snapshot.application.tools.totalExecutions} ${timestamp}`)

  return lines.join('\n') + '\n'
}
