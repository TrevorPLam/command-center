/**
 * Tool Audit Log API Routes
 * 
 * API endpoints for accessing tool execution audit logs with filtering
 * and export capabilities.
 */

import { NextRequest, NextResponse } from 'next/server'
import { toolRepository } from '@/lib/app/persistence/tool-repository'

/**
 * GET /api/tools/audit
 * 
 * Query parameters:
 * - toolName: Filter by specific tool name
 * - status: Filter by execution status ('pending', 'running', 'completed', 'failed')
 * - jobId: Filter by specific job ID
 * - limit: Maximum number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 * - orderBy: Sort field ('createdAt', 'updatedAt', 'durationMs')
 * - orderDirection: Sort direction ('asc', 'desc')
 * - search: Search by tool name or input content
 * - export: Set to 'true' to export as JSON file
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const toolName = searchParams.get('toolName') || undefined
    const status = searchParams.get('status') || undefined
    const jobId = searchParams.get('jobId') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const orderBy = searchParams.get('orderBy') as 'createdAt' | 'updatedAt' | 'durationMs' || 'createdAt'
    const orderDirection = searchParams.get('orderDirection') as 'asc' | 'desc' || 'desc'
    const search = searchParams.get('search') || undefined
    const exportMode = searchParams.get('export') === 'true'

    // Validate parameters
    if (limit > 100) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 100' },
        { status: 400 }
      )
    }

    if (offset < 0) {
      return NextResponse.json(
        { error: 'Offset cannot be negative' },
        { status: 400 }
      )
    }

    let toolRuns

    // Handle search vs filtered queries
    if (search) {
      toolRuns = await toolRepository.searchToolRuns(search, limit)
    } else {
      toolRuns = await toolRepository.listToolRuns({
        toolName,
        status,
        jobId,
        limit,
        offset,
        orderBy,
        orderDirection
      })
    }

    // Convert to audit log format
    const auditLogs = []
    for (const run of toolRuns) {
      const auditLog = await toolRepository.toolRunToAuditLog(run)
      auditLogs.push(auditLog)
    }

    // Handle export mode
    if (exportMode) {
      const exportData = {
        exportedAt: new Date().toISOString(),
        filters: { toolName, status, jobId, search },
        totalResults: auditLogs.length,
        logs: auditLogs
      }

      // Return as downloadable file
      const response = new NextResponse(JSON.stringify(exportData, null, 2))
      response.headers.set('Content-Type', 'application/json')
      response.headers.set(
        'Content-Disposition', 
        `attachment; filename="tool-audit-logs-${new Date().toISOString().split('T')[0]}.json"`
      )
      return response
    }

    // Get statistics for the filtered results
    const stats = await toolRepository.getToolStats(toolName)

    return NextResponse.json({
      success: true,
      logs: auditLogs,
      stats: {
        totalRuns: stats.totalRuns,
        successfulRuns: stats.successfulRuns,
        failedRuns: stats.failedRuns,
        averageDuration: stats.averageDuration,
        successRate: stats.totalRuns > 0 ? (stats.successfulRuns / stats.totalRuns) * 100 : 0,
        lastRun: stats.lastRun
      },
      pagination: {
        limit,
        offset,
        hasMore: toolRuns.length === limit
      }
    })

  } catch (error) {
    console.error('GET /api/tools/audit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/tools/audit/stats
 * 
 * Get comprehensive tool usage statistics
 */
export async function GET_STATS(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const toolName = searchParams.get('toolName') || undefined
    const period = searchParams.get('period') || '7d' // 7d, 30d, 90d

    // Get basic statistics
    const stats = await toolRepository.getToolStats(toolName)

    // Get recent activity
    const recentActivity = await toolRepository.getRecentActivity(20)

    // Get usage by time period if requested
    let usageByPeriod = []
    if (toolName && period) {
      const endDate = new Date()
      const startDate = new Date()
      
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(startDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(startDate.getDate() - 90)
          break
      }

      usageByPeriod = await toolRepository.getToolUsageByPeriod(
        toolName,
        startDate,
        endDate
      )
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalRuns: stats.totalRuns,
        successfulRuns: stats.successfulRuns,
        failedRuns: stats.failedRuns,
        averageDuration: stats.averageDuration,
        successRate: stats.totalRuns > 0 ? (stats.successfulRuns / stats.totalRuns) * 100 : 0,
        lastRun: stats.lastRun
      },
      recentActivity,
      usageByPeriod
    })

  } catch (error) {
    console.error('GET /api/tools/audit/stats error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tools/audit
 * 
 * Clean up old audit logs (admin only)
 * 
 * Query parameters:
 * - olderThanDays: Delete logs older than this many days (default: 30)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const olderThanDays = parseInt(searchParams.get('olderThanDays') || '30')

    if (olderThanDays < 1) {
      return NextResponse.json(
        { error: 'olderThanDays must be at least 1' },
        { status: 400 }
      )
    }

    const deletedCount = await toolRepository.deleteOldToolRuns(olderThanDays)

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} old tool runs`
    })

  } catch (error) {
    console.error('DELETE /api/tools/audit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
