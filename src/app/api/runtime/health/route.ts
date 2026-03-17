/**
 * Runtime Health API Route
 * 
 * Provides health status information for the runtime service.
 * Used by the monitoring panel and health checks.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeService } from '@/lib/app/services/runtime-service'

export async function GET(request: NextRequest) {
  try {
    const runtimeService = getRuntimeService()
    const health = await runtimeService.getHealth()
    
    return NextResponse.json({
      status: 'success',
      data: health
    })
  } catch (error) {
    console.error('Runtime health check failed:', error)
    
    return NextResponse.json({
      status: 'error',
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const forceRefresh = body.forceRefresh === true
    
    const runtimeService = getRuntimeService()
    const health = await runtimeService.getHealth(forceRefresh)
    
    return NextResponse.json({
      status: 'success',
      data: health
    })
  } catch (error) {
    console.error('Forced runtime health check failed:', error)
    
    return NextResponse.json({
      status: 'error',
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
