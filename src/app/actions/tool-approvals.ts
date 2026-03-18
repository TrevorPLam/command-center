/**
 * Tool Approval Server Actions
 * 
 * Server-side actions for managing tool approval requests and responses
 * with proper validation and security checks.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { 
  ToolApprovalRequest,
  ToolApprovalResponse,
  ApprovalDecision
} from '@/lib/app/tools/types'
import { globalApprovalGate } from '@/lib/app/tools/approval-gate'
import { toolRepository } from '@/lib/app/persistence/tool-repository'

// Form validation schemas
const approveRequestSchema = z.object({
  requestId: z.string().uuid(),
  approved: z.boolean(),
  reason: z.string().optional(),
  restrictions: z.array(z.string()).optional(),
  rememberDecision: z.boolean().default(false)
})

const getPendingRequestsSchema = z.object({
  sessionId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20)
})

const getApprovalHistorySchema = z.object({
  sessionId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50)
})

/**
 * Submit an approval decision for a tool execution request
 */
export async function submitApprovalDecision(formData: FormData) {
  try {
    // Extract and validate form data
    const rawData = {
      requestId: formData.get('requestId') as string,
      approved: formData.get('approved') === 'true',
      reason: formData.get('reason') as string || undefined,
      restrictions: formData.getAll('restrictions') as string[] || undefined,
      rememberDecision: formData.get('rememberDecision') === 'true'
    }

    const validatedData = approveRequestSchema.parse(rawData)

    // Get the approval request
    const request = globalApprovalGate.getRequest(validatedData.requestId)
    if (!request) {
      return {
        success: false,
        error: 'Approval request not found or expired'
      }
    }

    // Process the decision
    const response = await globalApprovalGate.processDecision(
      validatedData.requestId,
      {
        approved: validatedData.approved,
        reason: validatedData.reason,
        restrictions: validatedData.restrictions
      }
    )

    // Update session preferences if requested
    if (validatedData.rememberDecision) {
      globalApprovalGate.updateSessionPreferences(request.sessionId, {
        autoApproveLowRisk: validatedData.approved && request.riskAssessment.level === 'low',
        rememberApprovals: true
      })
    }

    // If approved, create a tool run record
    if (validatedData.approved) {
      await toolRepository.createToolRun({
        toolName: request.tool.name,
        input: request.inputSanitized,
        jobId: request.context.jobId
      })
    }

    // Revalidate the agents page to show updated status
    revalidatePath('/(command-center)/@agents')

    return {
      success: true,
      response: {
        requestId: response.requestId,
        approved: response.approved,
        grantedCapabilities: response.grantedCapabilities,
        reason: response.reason
      }
    }

  } catch (error) {
    console.error('Failed to submit approval decision:', error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Invalid form data',
        details: error.errors.map(e => e.message).join(', ')
      }
    }

    return {
      success: false,
      error: 'Failed to process approval decision'
    }
  }
}

/**
 * Get pending approval requests for a session
 */
export async function getPendingApprovalRequests(sessionId?: string) {
  try {
    const validatedData = getPendingRequestsSchema.parse({ sessionId })

    const requests = globalApprovalGate.getPendingRequests(
      validatedData.sessionId || 'default'
    )

    return {
      success: true,
      requests: requests.map(request => ({
        id: request.id,
        toolName: request.tool.name,
        toolDescription: request.tool.description,
        riskLevel: request.riskAssessment.level,
        riskScore: request.riskAssessment.score,
        riskReasons: request.riskAssessment.reasons,
        capabilities: request.tool.capabilities,
        requiresApproval: request.tool.approvalRequired,
        requestedAt: request.requestedAt.toISOString(),
        expiresAt: request.expiresAt.toISOString(),
        sessionId: request.sessionId,
        executionId: request.context.executionId,
        inputPreview: JSON.stringify(request.inputSanitized).slice(0, 200) + '...'
      }))
    }

  } catch (error) {
    console.error('Failed to get pending requests:', error)
    return {
      success: false,
      error: 'Failed to retrieve pending requests',
      requests: []
    }
  }
}

/**
 * Get approval history for a session
 */
export async function getApprovalHistory(sessionId?: string, limit: number = 50) {
  try {
    const validatedData = getApprovalHistorySchema.parse({ sessionId, limit })

    const responses = globalApprovalGate.getResponseHistory(
      validatedData.sessionId || 'default',
      validatedData.limit
    )

    return {
      success: true,
      responses: responses.map(response => ({
        requestId: response.requestId,
        approved: response.approved,
        reason: response.reason,
        respondedAt: response.respondedAt.toISOString(),
        grantedCapabilities: response.grantedCapabilities
      }))
    }

  } catch (error) {
    console.error('Failed to get approval history:', error)
    return {
      success: false,
      error: 'Failed to retrieve approval history',
      responses: []
    }
  }
}

/**
 * Get approval statistics
 */
export async function getApprovalStatistics(sessionId?: string) {
  try {
    const stats = await globalApprovalGate.getStats(sessionId)

    return {
      success: true,
      stats: {
        totalRequests: stats.totalRequests,
        approvedRequests: stats.approvedRequests,
        deniedRequests: stats.deniedRequests,
        expiredRequests: stats.expiredRequests,
        averageDecisionTime: stats.averageDecisionTime,
        approvalRate: stats.totalRequests > 0 
          ? (stats.approvedRequests / stats.totalRequests) * 100 
          : 0,
        decisionsByRiskLevel: stats.decisionsByRiskLevel
      }
    }

  } catch (error) {
    console.error('Failed to get approval statistics:', error)
    return {
      success: false,
      error: 'Failed to retrieve statistics',
      stats: null
    }
  }
}

/**
 * Create a tool approval request (for testing and internal use)
 */
export async function createApprovalRequest(requestData: {
  toolName: string
  input: unknown
  sessionId?: string
  executionId?: string
  jobId?: string
}) {
  try {
    // This would typically be called by the tool execution provider
    // For now, we'll create a mock request for demonstration
    
    const requestId = crypto.randomUUID()
    const sessionId = requestData.sessionId || 'default'
    const executionId = requestData.executionId || crypto.randomUUID()

    // Create a mock approval request
    const mockRequest: ToolApprovalRequest = {
      id: requestId,
      tool: {
        name: requestData.toolName,
        description: `Tool: ${requestData.toolName}`,
        version: '1.0.0',
        capabilities: ['filesystem-read'], // Mock capability
        riskLevel: 'medium',
        approvalRequired: true,
        executionScope: {
          allowedPaths: ['/workspace/**'],
          deniedPaths: ['/workspace/.env', '/workspace/secrets/**'],
          networkRules: { defaultAllow: false },
          resourceLimits: { maxExecutionTimeSec: 300 },
          requiredPermissions: ['filesystem-read']
        },
        inputSchema: z.any(), // Mock schema
        tags: ['test'],
        metadata: {}
      },
      inputSanitized: requestData.input,
      riskAssessment: {
        level: 'medium',
        score: 50,
        reasons: ['Tool requires filesystem access', 'Input contains file paths']
      },
      sessionId,
      context: {
        executionId,
        workspaceDir: '/workspace',
        startTime: new Date(),
        conversationId: requestData.jobId
      },
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      userId: undefined
    }

    await globalApprovalGate.submitRequest(mockRequest)

    revalidatePath('/(command-center)/@agents')

    return {
      success: true,
      requestId: mockRequest.id
    }

  } catch (error) {
    console.error('Failed to create approval request:', error)
    return {
      success: false,
      error: 'Failed to create approval request'
    }
  }
}

/**
 * Clean up expired requests and sessions
 */
export async function cleanupExpiredApprovals() {
  try {
    globalApprovalGate.cleanup()
    
    return {
      success: true,
      message: 'Cleanup completed'
    }

  } catch (error) {
    console.error('Failed to cleanup expired approvals:', error)
    return {
      success: false,
      error: 'Failed to cleanup expired approvals'
    }
  }
}

/**
 * Update session preferences
 */
export async function updateSessionPreferences(
  sessionId: string,
  preferences: {
    autoApproveLowRisk?: boolean
    rememberApprovals?: boolean
    approvalTimeoutMinutes?: number
  }
) {
  try {
    globalApprovalGate.updateSessionPreferences(sessionId, preferences)

    return {
      success: true,
      message: 'Preferences updated'
    }

  } catch (error) {
    console.error('Failed to update session preferences:', error)
    return {
      success: false,
      error: 'Failed to update preferences'
    }
  }
}
