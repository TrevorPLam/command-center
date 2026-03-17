/**
 * Runtime Snapshots API Route
 * 
 * Provides access to runtime snapshots, comparisons, and trend data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeService } from '@/lib/app/services/runtime-service'
import { getRuntimeRepository } from '@/lib/app/persistence/runtime-repository'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const repository = getRuntimeRepository()
    
    switch (action) {
      case 'latest':
        const latestSnapshot = await repository.getLatestSnapshot()
        
        return NextResponse.json({
          status: 'success',
          data: latestSnapshot
        })
        
      case 'recent':
        const recentSnapshots = await repository.getRecentSnapshots(limit)
        
        return NextResponse.json({
          status: 'success',
          data: recentSnapshots
        })
        
      case 'trends':
        const period = (searchParams.get('period') as 'hour' | 'day' | 'week') || 'day'
        const trendData = await repository.getTrendData(period)
        
        return NextResponse.json({
          status: 'success',
          data: trendData
        })
        
      case 'compare':
        const snapshot1 = searchParams.get('snapshot1')
        const snapshot2 = searchParams.get('snapshot2')
        
        if (!snapshot1 || !snapshot2) {
          return NextResponse.json({
            status: 'error',
            error: {
              code: 'INVALID_REQUEST',
              message: 'Both snapshot1 and snapshot2 parameters are required for comparison'
            }
          }, { status: 400 })
        }
        
        const comparison = await repository.compareSnapshots(snapshot1, snapshot2)
        
        return NextResponse.json({
          status: 'success',
          data: comparison
        })
        
      case 'statistics':
        const statistics = await repository.getStatistics()
        
        return NextResponse.json({
          status: 'success',
          data: statistics
        })
        
      default:
        // Default to recent snapshots
        const snapshots = await repository.getRecentSnapshots(limit)
        
        return NextResponse.json({
          status: 'success',
          data: snapshots
        })
    }
  } catch (error) {
    console.error('Snapshots API failed:', error)
    
    return NextResponse.json({
      status: 'error',
      error: {
        code: 'SNAPSHOTS_API_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body
    
    const repository = getRuntimeRepository()
    const runtimeService = getRuntimeService()
    
    switch (action) {
      case 'create':
        // Create a new snapshot
        const snapshot = await runtimeService.createSnapshot()
        await repository.saveSnapshot(snapshot)
        
        return NextResponse.json({
          status: 'success',
          data: {
            snapshot,
            message: 'Snapshot created successfully'
          }
        })
        
      case 'cleanup':
        // Clean up old data
        const olderThanDays = body.olderThanDays || 30
        await repository.cleanup(olderThanDays)
        
        return NextResponse.json({
          status: 'success',
          data: {
            message: `Cleaned up data older than ${olderThanDays} days`
          }
        })
        
      default:
        return NextResponse.json({
          status: 'error',
          error: {
            code: 'INVALID_ACTION',
            message: `Unknown action: ${action}`
          }
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Snapshot operation failed:', error)
    
    return NextResponse.json({
      status: 'error',
      error: {
        code: 'SNAPSHOT_OPERATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }, { status: 500 })
  }
}
