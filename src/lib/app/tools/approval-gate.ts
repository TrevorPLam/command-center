/**
 * Tool Approval Gate
 * 
 * Handles human-in-the-loop approval for tool execution requests
 * with risk assessment, session management, and audit logging.
 */

import { randomUUID } from 'crypto'
import { 
  ToolApprovalRequest,
  ToolApprovalResponse,
  ToolRiskLevel,
  ToolCapability
} from './types'

/**
 * Approval request status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired'

/**
 * Approval decision with reasoning
 */
export interface ApprovalDecision {
  approved: boolean
  reason?: string
  grantedCapabilities?: ToolCapability[]
  restrictions?: string[]
}

/**
 * Approval session for tracking user decisions
 */
export interface ApprovalSession {
  id: string
  userId?: string
  sessionId: string
  createdAt: Date
  lastActivity: Date
  decisions: ApprovalDecision[]
  preferences: {
    autoApproveLowRisk: boolean
    rememberApprovals: boolean
    approvalTimeoutMinutes: number
  }
}

/**
 * Approval statistics
 */
export interface ApprovalStats {
  totalRequests: number
  approvedRequests: number
  deniedRequests: number
  expiredRequests: number
  averageDecisionTime: number
  decisionsByRiskLevel: Record<ToolRiskLevel, number>
}

/**
 * Tool approval gate implementation
 */
export class ToolApprovalGate {
  private sessions = new Map<string, ApprovalSession>()
  private pendingRequests = new Map<string, ToolApprovalRequest>()
  private requestHistory = new Map<string, ToolApprovalResponse>()

  constructor(private options: {
    defaultTimeoutMinutes?: number
    maxSessionAge?: number
    enableDecisionMemory?: boolean
  } = {}) {
    this.options = {
      defaultTimeoutMinutes: 30,
      maxSessionAge: 24 * 60 * 60 * 1000, // 24 hours
      enableDecisionMemory: true,
      ...options
    }
  }

  /**
   * Create or get approval session
   */
  getOrCreateSession(sessionId: string, userId?: string): ApprovalSession {
    let session = this.sessions.get(sessionId)

    if (!session) {
      session = {
        id: randomUUID(),
        userId,
        sessionId,
        createdAt: new Date(),
        lastActivity: new Date(),
        decisions: [],
        preferences: {
          autoApproveLowRisk: false,
          rememberApprovals: true,
          approvalTimeoutMinutes: this.options.defaultTimeoutMinutes || 30
        }
      }
      this.sessions.set(sessionId, session)
    } else {
      session.lastActivity = new Date()
    }

    return session
  }

  /**
   * Submit approval request
   */
  async submitRequest(request: ToolApprovalRequest): Promise<void> {
    // Check for duplicate requests
    const existing = this.pendingRequests.get(request.id)
    if (existing) {
      throw new Error(`Approval request '${request.id}' already exists`)
    }

    // Store request
    this.pendingRequests.set(request.id, request)

    // Set expiration
    setTimeout(() => {
      this.expireRequest(request.id)
    }, request.expiresAt.getTime() - Date.now())

    // Check for auto-approval based on session preferences
    const session = this.getOrCreateSession(request.sessionId)
    if (this.shouldAutoApprove(request, session)) {
      await this.processDecision(request.id, {
        approved: true,
        reason: 'Auto-approved based on session preferences'
      })
    }
  }

  /**
   * Process approval decision
   */
  async processDecision(requestId: string, decision: ApprovalDecision): Promise<ToolApprovalResponse> {
    const request = this.pendingRequests.get(requestId)
    if (!request) {
      throw new Error(`Approval request '${requestId}' not found or expired`)
    }

    const session = this.getOrCreateSession(request.sessionId)
    
    // Record decision
    session.decisions.push({
      approved: decision.approved,
      reason: decision.reason,
      grantedCapabilities: decision.grantedCapabilities || request.tool.capabilities,
      restrictions: decision.restrictions
    })

    // Create response
    const response: ToolApprovalResponse = {
      requestId,
      approved: decision.approved,
      token: decision.approved ? randomUUID() : undefined,
      grantedCapabilities: decision.grantedCapabilities || request.tool.capabilities,
      respondedAt: new Date(),
      reason: decision.reason
    }

    // Store response
    this.requestHistory.set(requestId, response)

    // Remove from pending
    this.pendingRequests.delete(requestId)

    return response
  }

  /**
   * Get pending requests for a session
   */
  getPendingRequests(sessionId: string): ToolApprovalRequest[] {
    return Array.from(this.pendingRequests.values())
      .filter(request => request.sessionId === sessionId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime())
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): ToolApprovalRequest | null {
    return this.pendingRequests.get(requestId) || null
  }

  /**
   * Get response history for a session
   */
  getResponseHistory(sessionId: string, limit?: number): ToolApprovalResponse[] {
    const responses = Array.from(this.requestHistory.values())
      .filter(response => {
        const request = this.pendingRequests.get(response.requestId)
        return request?.sessionId === sessionId
      })
      .sort((a, b) => b.respondedAt.getTime() - a.respondedAt.getTime())

    return limit ? responses.slice(0, limit) : responses
  }

  /**
   * Get approval statistics
   */
  async getStats(sessionId?: string): Promise<ApprovalStats> {
    let allRequests: ToolApprovalRequest[] = []
    let allResponses: ToolApprovalResponse[] = []

    if (sessionId) {
      allRequests = Array.from(this.pendingRequests.values())
        .filter(request => request.sessionId === sessionId)
      allResponses = Array.from(this.requestHistory.values())
        .filter(response => {
          const request = this.pendingRequests.get(response.requestId)
          return request?.sessionId === sessionId
        })
    } else {
      allRequests = Array.from(this.pendingRequests.values())
      allResponses = Array.from(this.requestHistory.values())
    }

    const totalRequests = allRequests.length + allResponses.length
    const approvedRequests = allResponses.filter(r => r.approved).length
    const deniedRequests = allResponses.filter(r => !r.approved).length
    const expiredRequests = allRequests.filter(r => r.expiresAt < new Date()).length

    // Calculate average decision time
    const decisionTimes = allResponses.map(response => {
      const request = this.pendingRequests.get(response.requestId)
      return request ? response.respondedAt.getTime() - request.requestedAt.getTime() : 0
    }).filter(time => time > 0)

    const averageDecisionTime = decisionTimes.length > 0
      ? decisionTimes.reduce((sum, time) => sum + time, 0) / decisionTimes.length
      : 0

    // Group by risk level
    const decisionsByRiskLevel: Record<ToolRiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0
    }

    for (const request of allRequests) {
      decisionsByRiskLevel[request.riskAssessment.level]++
    }
    for (const response of allResponses) {
      const request = this.pendingRequests.get(response.requestId)
      if (request) {
        decisionsByRiskLevel[request.riskAssessment.level]++
      }
    }

    return {
      totalRequests,
      approvedRequests,
      deniedRequests,
      expiredRequests,
      averageDecisionTime,
      decisionsByRiskLevel
    }
  }

  /**
   * Update session preferences
   */
  updateSessionPreferences(sessionId: string, preferences: Partial<ApprovalSession['preferences']>): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.preferences = { ...session.preferences, ...preferences }
      session.lastActivity = new Date()
    }
  }

  /**
   * Clean up expired sessions and requests
   */
  cleanup(): void {
    const now = Date.now()
    const maxAge = this.options.maxSessionAge || 24 * 60 * 60 * 1000

    // Clean up expired sessions
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > maxAge) {
        this.sessions.delete(sessionId)
      }
    }

    // Clean up expired requests
    for (const [requestId, request] of this.pendingRequests) {
      if (request.expiresAt.getTime() < now) {
        this.expireRequest(requestId)
      }
    }
  }

  /**
   * Check if request should be auto-approved
   */
  private shouldAutoApprove(request: ToolApprovalRequest, session: ApprovalSession): boolean {
    if (!session.preferences.autoApproveLowRisk) {
      return false
    }

    // Auto-approve only low-risk tools
    if (request.riskAssessment.level !== 'low') {
      return false
    }

    // Check if similar request was approved before
    if (session.preferences.rememberApprovals) {
      const similarDecision = session.decisions.find(decision =>
        decision.approved &&
        decision.reason?.includes('Auto-approved')
      )
      return !!similarDecision
    }

    return false
  }

  /**
   * Expire a request
   */
  private expireRequest(requestId: string): void {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      // Create expired response
      const response: ToolApprovalResponse = {
        requestId,
        approved: false,
        grantedCapabilities: [],
        respondedAt: new Date(),
        reason: 'Request expired'
      }

      this.requestHistory.set(requestId, response)
      this.pendingRequests.delete(requestId)
    }
  }

  /**
   * Get risk assessment summary
   */
  getRiskAssessmentSummary(request: ToolApprovalRequest): {
    level: ToolRiskLevel
    score: number
    factors: string[]
    recommendations: string[]
  } {
    const factors = [...request.riskAssessment.reasons]
    const recommendations: string[] = []

    let score = 0
    switch (request.riskAssessment.level) {
      case 'low':
        score = 20
        recommendations.push('Consider auto-approval for trusted users')
        break
      case 'medium':
        score = 50
        recommendations.push('Review input parameters carefully')
        recommendations.push('Consider restricting capabilities')
        break
      case 'high':
        score = 80
        recommendations.push('Manual review required')
        recommendations.push('Consider sandboxing restrictions')
        recommendations.push('Limit execution scope')
        break
    }

    // Adjust score based on capabilities
    if (request.tool.capabilities.includes('network-egress')) {
      score += 10
      recommendations.push('Verify network destinations')
    }

    if (request.tool.capabilities.includes('filesystem-write')) {
      score += 15
      recommendations.push('Review file paths and permissions')
    }

    if (request.tool.capabilities.includes('process-exec')) {
      score += 20
      recommendations.push('Validate command arguments')
    }

    return {
      level: request.riskAssessment.level,
      score: Math.min(score, 100),
      factors,
      recommendations
    }
  }
}

/**
 * Global approval gate instance
 */
export const globalApprovalGate = new ToolApprovalGate()

/**
 * Factory function for creating approval gates
 */
export function createToolApprovalGate(options?: ConstructorParameters<typeof ToolApprovalGate>[0]): ToolApprovalGate {
  return new ToolApprovalGate(options)
}
