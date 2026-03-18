/**
 * Metrics SSE streaming endpoint
 * Implements CC-011-3: Create monitoring routes and SSE feeds
 */

import { NextRequest } from 'next/server'
import { metricsEmitter } from '@/lib/app/services/metrics-emitter'
import type { MetricsSnapshot, Alert } from '@/lib/app/monitoring/types'

export async function GET(request: NextRequest) {
  const { signal } = request

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Set SSE headers
      const encoder = new TextEncoder()
      
      // Helper function to send SSE data
      const sendSSEData = (event: string, data: any) => {
        const formattedData = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(formattedData))
      }

      // Send initial connection event
      sendSSEData('connected', {
        message: 'Connected to metrics stream',
        timestamp: Date.now()
      })

      // Subscribe to metrics updates
      const unsubscribeMetrics = metricsEmitter.subscribe((snapshot: MetricsSnapshot) => {
        sendSSEData('metrics', snapshot)
      })

      // Subscribe to alerts
      const unsubscribeAlerts = metricsEmitter.subscribeToAlerts((alert: Alert) => {
        sendSSEData('alert', alert)
      })

      // Send periodic health updates
      const healthInterval = setInterval(async () => {
        try {
          const health = await metricsEmitter.getHealthStatus()
          sendSSEData('health', health)
        } catch (error) {
          console.error('Error sending health update:', error)
        }
      }, 30000) // Every 30 seconds

      // Cleanup on connection close
      const cleanup = () => {
        unsubscribeMetrics()
        unsubscribeAlerts()
        clearInterval(healthInterval)
        controller.close()
      }

      // Handle abort signal
      if (signal) {
        signal.addEventListener('abort', cleanup)
      }

      // Handle controller close
      controller.close = () => {
        cleanup()
        return Promise.resolve()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Handle stream control actions
    switch (body.action) {
      case 'ping':
        // Keep-alive ping
        return new Response('pong', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        })
        
      case 'force':
        // Force immediate metrics send
        const snapshot = await metricsEmitter.forceCollection()
        
        return new Response(JSON.stringify({
          event: 'metrics',
          data: snapshot,
          timestamp: Date.now()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
        
      default:
        return new Response(JSON.stringify({
          error: 'Invalid action'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        })
    }
  } catch (error) {
    console.error('Error handling stream POST:', error)
    
    return new Response(JSON.stringify({
      error: 'Failed to process request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
