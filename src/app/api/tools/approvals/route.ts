/**
 * Tool Approval API Routes
 * 
 * REST API endpoints for tool approval management with real-time updates
 * and proper authentication/authorization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  getPendingApprovalRequests,
  submitApprovalDecision,
  getApprovalHistory,
  getApprovalStatistics,
  cleanupExpiredApprovals
} from '@/app/actions/tool-approvals'

/**
 * GET /api/tools/approvals
 * 
 * Query parameters:
 * - sessionId: Optional session ID filter
 * - type: 'pending' | 'history' | 'stats'
 * - limit: Maximum number of results (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId') || undefined
    const type = searchParams.get('type') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '20')

    switch (type) {
      case 'pending':
        const pendingResult = await getPendingApprovalRequests(sessionId)
        if (!pendingResult.success) {
          return NextResponse.json(
            { error: pendingResult.error },
            { status: 400 }
          )
        }
        return NextResponse.json(pendingResult)

      case 'history':
        const historyResult = await getApprovalHistory(sessionId, limit)
        if (!historyResult.success) {
          return NextResponse.json(
            { error: historyResult.error },
            { status: 400 }
          )
        }
        return NextResponse.json(historyResult)

      case 'stats':
        const statsResult = await getApprovalStatistics(sessionId)
        if (!statsResult.success) {
          return NextResponse.json(
            { error: statsResult.error },
            { status: 400 }
          )
        }
        return NextResponse.json(statsResult)

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter. Use: pending, history, or stats' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('GET /api/tools/approvals error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tools/approvals
 * 
 * Submit an approval decision for a tool execution request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.requestId || typeof body.approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: requestId, approved' },
        { status: 400 }
      )
    }

    // Convert to FormData for server action compatibility
    const formData = new FormData()
    formData.append('requestId', body.requestId)
    formData.append('approved', body.approved.toString())
    
    if (body.reason) {
      formData.append('reason', body.reason)
    }
    
    if (body.restrictions && Array.isArray(body.restrictions)) {
      body.restrictions.forEach((restriction: string) => {
        formData.append('restrictions', restriction)
      })
    }
    
    if (body.rememberDecision) {
      formData.append('rememberDecision', 'true')
    }

    const result = await submitApprovalDecision(formData)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: 400 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('POST /api/tools/approvals error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/tools/approvals
 * 
 * Clean up expired requests and sessions
 */
export async function DELETE(request: NextRequest) {
  try {
    const result = await cleanupExpiredApprovals()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('DELETE /api/tools/approvals error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
