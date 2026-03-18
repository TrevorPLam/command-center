/**
 * Tool Service
 * 
 * High-level service wrapper for tool operations with proper validation,
 * security checks, and integration with the execution provider.
 */

import { randomUUID } from 'crypto'
import { 
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolApprovalRequest,
  ToolContext,
  ValidationResult,
  ToolCapability
} from '@/lib/app/tools/types'
import { globalToolRegistry } from '@/lib/app/tools/registry'
import { createToolExecutionProvider } from '@/lib/app/tools/execution-provider'
import { globalApprovalGate } from '@/lib/app/tools/approval-gate'
import { ToolSecurityValidator } from '@/lib/app/tools/validation'

// Global execution provider instance
let executionProvider: ReturnType<typeof createToolExecutionProvider> | null = null

/**
 * Get or create the execution provider instance
 */
function getExecutionProvider() {
  if (!executionProvider) {
    executionProvider = createToolExecutionProvider(globalToolRegistry, {
      maxConcurrentExecutions: 10,
      defaultTimeoutMs: 60000,
      enableAuditLogging: true
    })
  }
  return executionProvider
}

/**
 * Tool service interface for browser-facing operations
 */
export interface ToolService {
  // Tool discovery
  listTools(): Promise<any[]>
  getTool(name: string): Promise<any>
  
  // Tool execution
  executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult>
  validateExecution(request: ToolExecutionRequest): Promise<ValidationResult>
  
  // Approval management
  getPendingApprovals(sessionId: string): Promise<ToolApprovalRequest[]>
  submitApproval(requestId: string, decision: any): Promise<void>
  
  // Audit and history
  getExecutionHistory(toolName?: string, limit?: number): Promise<any[]>
  getToolStats(): Promise<any>
}

/**
 * Default tool service implementation
 */
export class DefaultToolService implements ToolService {
  private provider = getExecutionProvider()

  /**
   * List all available tools
   */
  async listTools(): Promise<any[]> {
    const tools = await globalToolRegistry.list()
    const stats = await globalToolRegistry.getStats()

    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      version: tool.version,
      author: tool.author,
      riskLevel: tool.riskLevel,
      approvalRequired: tool.approvalRequired,
      capabilities: tool.capabilities,
      tags: tool.tags,
      metadata: tool.metadata,
      // Add execution context info
      executionScope: tool.executionScope,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema
    }))
  }

  /**
   * Get a specific tool by name
   */
  async getTool(name: string): Promise<any> {
    const tool = await globalToolRegistry.get(name)
    if (!tool) {
      throw new Error(`Tool '${name}' not found`)
    }

    return {
      name: tool.name,
      description: tool.description,
      version: tool.version,
      author: tool.author,
      riskLevel: tool.riskLevel,
      approvalRequired: tool.approvalRequired,
      capabilities: tool.capabilities,
      tags: tool.tags,
      metadata: tool.metadata,
      executionScope: tool.executionScope,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema
    }
  }

  /**
   * Execute a tool with full validation and approval handling
   */
  async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    // Ensure request has execution context
    if (!request.context) {
      throw new Error('Execution context is required')
    }

    // Validate the request
    const validation = await this.validateExecution(request)
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors.join('; ')
        },
        metrics: {
          executionTimeMs: 0,
          capabilitiesUsed: []
        },
        approval: {
          required: false,
          granted: false
        }
      }
    }

    // Execute through the provider
    return await this.provider.execute(request)
  }

  /**
   * Validate a tool execution request
   */
  async validateExecution(request: ToolExecutionRequest): Promise<ValidationResult> {
    return await this.provider.validateRequest(request)
  }

  /**
   * Get pending approval requests for a session
   */
  async getPendingApprovals(sessionId: string): Promise<ToolApprovalRequest[]> {
    return globalApprovalGate.getPendingRequests(sessionId)
  }

  /**
   * Submit an approval decision
   */
  async submitApproval(requestId: string, decision: any): Promise<void> {
    const response = await globalApprovalGate.processDecision(requestId, decision)
    await this.provider.processApproval(response)
  }

  /**
   * Get execution history/audit logs
   */
  async getExecutionHistory(toolName?: string, limit?: number): Promise<any[]> {
    return await this.provider.getExecutionHistory(toolName, limit)
  }

  /**
   * Get tool registry statistics
   */
  async getToolStats(): Promise<any> {
    const stats = await globalToolRegistry.getStats()
    const approvalStats = await globalApprovalGate.getStats()

    return {
      registry: stats,
      approvals: approvalStats,
      security: {
        totalValidations: ToolSecurityValidator.getTotalValidations(),
        securityEvents: ToolSecurityValidator.getSecurityEvents()
      }
    }
  }

  /**
   * Create a tool execution context
   */
  createExecutionContext(params: {
    sessionId: string
    userId?: string
    workspaceDir: string
    conversationId?: string
    grantedCapabilities?: ToolCapability[]
  }): ToolContext {
    return {
      executionId: randomUUID(),
      sessionId: params.sessionId,
      userId: params.userId,
      workspaceDir: params.workspaceDir,
      grantedCapabilities: params.grantedCapabilities || [],
      startTime: new Date(),
      conversationId: params.conversationId
    }
  }

  /**
   * Create a tool execution request
   */
  createExecutionRequest(params: {
    toolName: string
    input: unknown
    context: ToolContext
    dryRun?: boolean
    approvalToken?: string
  }): ToolExecutionRequest {
    return {
      toolName: params.toolName,
      input: params.input,
      context: params.context,
      dryRun: params.dryRun || false,
      approvalToken: params.approvalToken
    }
  }

  /**
   * Assess tool execution risk
   */
  async assessRisk(toolName: string, input: unknown, context: ToolContext): Promise<{
    level: 'low' | 'medium' | 'high'
    score: number
    factors: string[]
    recommendations: string[]
  }> {
    const tool = await globalToolRegistry.get(toolName)
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`)
    }

    // Create a mock approval request to assess risk
    const mockRequest: ToolApprovalRequest = {
      id: randomUUID(),
      tool,
      context,
      inputSanitized: ToolSecurityValidator.sanitizeInput(input, toolName),
      riskAssessment: {
        level: tool.riskLevel,
        score: tool.riskLevel === 'low' ? 20 : tool.riskLevel === 'medium' ? 50 : 80,
        reasons: [`Tool risk level: ${tool.riskLevel}`],
        potentialImpact: []
      },
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      sessionId: context.sessionId,
      userId: context.userId
    }

    return globalApprovalGate.getRiskAssessmentSummary(mockRequest)
  }
}

/**
 * Global tool service instance
 */
export const toolService = new DefaultToolService()

/**
 * Factory function for creating tool services
 */
export function createToolService(): ToolService {
  return new DefaultToolService()
}

/**
 * Utility functions for common operations
 */
export const ToolServiceUtils = {
  /**
   * Execute a tool with minimal parameters
   */
  async executeToolSimple(params: {
    toolName: string
    input: unknown
    sessionId: string
    workspaceDir: string
    userId?: string
    conversationId?: string
  }): Promise<ToolExecutionResult> {
    const context = toolService.createExecutionContext({
      sessionId: params.sessionId,
      userId: params.userId,
      workspaceDir: params.workspaceDir,
      conversationId: params.conversationId
    })

    const request = toolService.createExecutionRequest({
      toolName: params.toolName,
      input: params.input,
      context
    })

    return await toolService.executeTool(request)
  },

  /**
   * Check if a tool requires approval
   */
  async requiresApproval(toolName: string, input: unknown, context: ToolContext): Promise<boolean> {
    const request = toolService.createExecutionRequest({
      toolName,
      input,
      context,
      dryRun: true
    })

    const validation = await toolService.validateExecution(request)
    return !validation.valid || validation.errors.some(error => 
      error.includes('approval') || error.includes('permission')
    )
  },

  /**
   * Get tools by risk level
   */
  async getToolsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): Promise<any[]> {
    const tools = await globalToolRegistry.listByRiskLevel(riskLevel)
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel,
      approvalRequired: tool.approvalRequired,
      capabilities: tool.capabilities
    }))
  },

  /**
   * Get tools by capability
   */
  async getToolsByCapability(capability: ToolCapability): Promise<any[]> {
    const tools = await globalToolRegistry.listByCapability(capability)
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      riskLevel: tool.riskLevel,
      approvalRequired: tool.approvalRequired,
      capabilities: tool.capabilities
    }))
  }
}

/**
 * Type guards and validation utilities
 */
export function isValidToolExecutionRequest(value: unknown): value is ToolExecutionRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toolName' in value &&
    'input' in value &&
    'context' in value &&
    typeof (value as any).toolName === 'string' &&
    typeof (value as any).context === 'object'
  )
}

export function isValidToolContext(value: unknown): value is ToolContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'executionId' in value &&
    'sessionId' in value &&
    'workspaceDir' in value &&
    'grantedCapabilities' in value &&
    'startTime' in value &&
    typeof (value as any).executionId === 'string' &&
    typeof (value as any).sessionId === 'string' &&
    typeof (value as any).workspaceDir === 'string' &&
    Array.isArray((value as any).grantedCapabilities)
  )
}
