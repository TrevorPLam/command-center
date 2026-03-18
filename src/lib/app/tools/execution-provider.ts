/**
 * Tool Execution Provider
 * 
 * Implements secure tool execution with approval gates, sandboxing,
 * and comprehensive audit logging following 2026 security best practices.
 */

import { randomUUID } from 'crypto'
import { 
  ToolExecutionProvider,
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolApprovalRequest,
  ToolApprovalResponse,
  ToolContext,
  ValidationResult,
  ToolCapability,
  SecurityEvent,
  BuiltinTool
} from './types'
import { ToolRegistry } from './types'
import { ToolSecurityValidator, ToolInputSanitizer } from './validation'
import { toolRepository } from '../persistence/tool-repository'

/**
 * In-memory approval store for pending requests
 * 
 * In production, this should be backed by persistent storage with
 * proper expiration and cleanup mechanisms.
 */
class ApprovalStore {
  private pending = new Map<string, ToolApprovalRequest>()
  private granted = new Map<string, ToolApprovalResponse>()

  /**
   * Store a pending approval request
   */
  setPending(request: ToolApprovalRequest): void {
    this.pending.set(request.id, request)
    
    // Auto-expire after 30 minutes
    setTimeout(() => {
      this.pending.delete(request.id)
    }, 30 * 60 * 1000)
  }

  /**
   * Get pending approval request
   */
  getPending(id: string): ToolApprovalRequest | null {
    return this.pending.get(id) || null
  }

  /**
   * Store granted approval
   */
  setGranted(response: ToolApprovalResponse): void {
    this.granted.set(response.requestId, response)
    
    // Auto-expire after 5 minutes
    setTimeout(() => {
      this.granted.delete(response.requestId)
    }, 5 * 60 * 1000)
  }

  /**
   * Get granted approval
   */
  getGranted(requestId: string): ToolApprovalResponse | null {
    return this.granted.get(requestId) || null
  }

  /**
   * Delete pending request
   */
  deletePending(id: string): void {
    this.pending.delete(id)
  }

  /**
   * List pending requests for a session
   */
  listPendingForSession(sessionId: string): ToolApprovalRequest[] {
    return Array.from(this.pending.values()).filter(
      request => request.sessionId === sessionId
    )
  }
}

/**
 * Tool execution provider implementation
 */
export class DefaultToolExecutionProvider implements ToolExecutionProvider {
  private tools = new Map<string, BuiltinTool>()
  private approvalStore = new ApprovalStore()
  private runningExecutions = new Map<string, AbortController>()

  constructor(
    private registry: ToolRegistry,
    private options: {
      maxConcurrentExecutions?: number
      defaultTimeoutMs?: number
      enableAuditLogging?: boolean
    } = {}
  ) {
    this.options = {
      maxConcurrentExecutions: 10,
      defaultTimeoutMs: 60000, // 1 minute
      enableAuditLogging: true,
      ...options
    }
  }

  /**
   * Register a built-in tool
   */
  registerTool(tool: BuiltinTool): void {
    this.tools.set(tool.descriptor.name, tool)
  }

  /**
   * Execute a tool with approval handling
   */
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now()
    const executionId = request.context.executionId

    try {
      // Validate request
      const validation = await this.validateRequest(request)
      if (!validation.valid) {
        return this.createErrorResult('VALIDATION_ERROR', validation.errors.join('; '))
      }

      // Get tool descriptor
      const toolDescriptor = await this.registry.get(request.toolName)
      if (!toolDescriptor) {
        return this.createErrorResult('TOOL_NOT_FOUND', `Tool '${request.toolName}' not found`)
      }

      // Get tool implementation
      const tool = this.tools.get(request.toolName)
      if (!tool) {
        return this.createErrorResult('TOOL_NOT_IMPLEMENTED', `Tool '${request.toolName}' not implemented`)
      }

      // Check if approval is required
      const requiresApproval = await this.requiresApproval(request)
      let approvalGranted = false
      let approvalToken: string | undefined

      if (requiresApproval) {
        // Check for existing approval
        if (request.approvalToken) {
          const approval = this.approvalStore.getGranted(request.approvalToken)
          if (approval && approval.approved) {
            approvalGranted = true
            approvalToken = approval.token
          }
        }

        // If no approval and not dry run, create approval request
        if (!approvalGranted && !request.dryRun) {
          const approvalRequest = await this.createApprovalRequest(request)
          return this.createApprovalRequiredResult(approvalRequest)
        }
      } else {
        approvalGranted = true // Auto-approved for low-risk tools
      }

      // Create database record
      const toolRunId = await toolRepository.createToolRun({
        toolName: request.toolName,
        input: ToolInputSanitizer.sanitize(request.input, request.toolName),
        jobId: request.context.conversationId
      })

      // Update status to running
      await toolRepository.updateToolRun(toolRunId, { status: 'running' })

      // Create abort controller for timeout/cancellation
      const abortController = new AbortController()
      this.runningExecutions.set(executionId, abortController)

      // Set timeout
      const timeoutMs = toolDescriptor.executionScope.resourceLimits.maxExecutionTimeSec 
        ? toolDescriptor.executionScope.resourceLimits.maxExecutionTimeSec * 1000
        : this.options.defaultTimeoutMs

      const timeout = setTimeout(() => {
        abortController.abort('Execution timeout')
      }, timeoutMs)

      try {
        // Validate input with tool schema
        if (tool.descriptor.inputSchema) {
          tool.descriptor.inputSchema.parse(request.input)
        }

        // Execute tool with timeout
        const output = await this.executeWithTimeout(
          () => tool.execute(request.input, request.context),
          timeoutMs,
          abortController.signal
        )

        // Validate output if schema is defined
        if (tool.descriptor.outputSchema) {
          tool.descriptor.outputSchema.parse(output)
        }

        const duration = Date.now() - startTime

        // Update database record
        await toolRepository.updateToolRun(toolRunId, {
          status: 'completed',
          output,
          durationMs: duration
        })

        // Create success result
        const result: ToolExecutionResult = {
          success: true,
          output,
          metrics: {
            executionTimeMs: duration,
            capabilitiesUsed: toolDescriptor.capabilities
          },
          approval: {
            required: requiresApproval,
            granted: approvalGranted,
            token: approvalToken
          }
        }

        // Log audit event
        if (this.options.enableAuditLogging) {
          await this.logAuditEvent(request, result, [])
        }

        return result

      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Update database record
        await toolRepository.updateToolRun(toolRunId, {
          status: 'failed',
          error: errorMessage,
          durationMs: duration
        })

        // Create error result
        const result: ToolExecutionResult = {
          success: false,
          error: {
            code: this.getErrorCode(error),
            message: errorMessage,
            details: error
          },
          metrics: {
            executionTimeMs: duration,
            capabilitiesUsed: []
          },
          approval: {
            required: requiresApproval,
            granted: approvalGranted,
            token: approvalToken
          }
        }

        // Log audit event
        if (this.options.enableAuditLogging) {
          await this.logAuditEvent(request, result, [{
            type: 'suspicious_activity',
            severity: 'medium',
            description: `Tool execution failed: ${errorMessage}`,
            timestamp: new Date(),
            details: { error: errorMessage, toolName: request.toolName }
          }])
        }

        return result

      } finally {
        clearTimeout(timeout)
        this.runningExecutions.delete(executionId)
      }

    } catch (error) {
      return this.createErrorResult('EXECUTION_ERROR', 
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Validate execution request
   */
  async validateRequest(request: ToolExecutionRequest): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic validation
    const basicValidation = ToolSecurityValidator.validateExecutionRequest(request)
    errors.push(...basicValidation.errors)
    warnings.push(...basicValidation.warnings)

    // Check tool exists
    const toolDescriptor = await this.registry.get(request.toolName)
    if (!toolDescriptor) {
      errors.push(`Tool '${request.toolName}' not found in registry`)
    } else {
      // Validate security constraints
      const securityEvents = ToolSecurityValidator.validateExecutionScope(
        toolDescriptor.capabilities,
        request.context.grantedCapabilities,
        toolDescriptor.executionScope,
        request.context
      )

      for (const event of securityEvents) {
        if (event.severity === 'critical' || event.severity === 'high') {
          errors.push(event.description)
        } else {
          warnings.push(event.description)
        }
      }

      // Validate input schema
      try {
        toolDescriptor.inputSchema.parse(request.input)
      } catch (error) {
        errors.push(`Input validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Check concurrent execution limit
    if (this.runningExecutions.size >= (this.options.maxConcurrentExecutions || 10)) {
      errors.push('Maximum concurrent executions reached')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Check if execution requires approval
   */
  async requiresApproval(request: ToolExecutionRequest): Promise<boolean> {
    const toolDescriptor = await this.registry.get(request.toolName)
    if (!toolDescriptor) {
      return true // Conservative: require approval for unknown tools
    }

    // Check tool's approval requirement
    if (toolDescriptor.approvalRequired) {
      return true
    }

    // Check risk level
    if (toolDescriptor.riskLevel === 'high') {
      return true
    }

    // Check for dangerous capabilities
    const dangerousCapabilities: ToolCapability[] = [
      'filesystem-write',
      'network-egress',
      'process-exec'
    ]

    return toolDescriptor.capabilities.some(cap => dangerousCapabilities.includes(cap))
  }

  /**
   * Create approval request
   */
  async createApprovalRequest(request: ToolExecutionRequest): Promise<ToolApprovalRequest> {
    const toolDescriptor = await this.registry.get(request.toolName)
    if (!toolDescriptor) {
      throw new Error(`Tool '${request.toolName}' not found`)
    }

    // Assess risk
    const riskAssessment = this.assessRisk(toolDescriptor, request)

    // Create approval request
    const approvalRequest: ToolApprovalRequest = {
      id: randomUUID(),
      tool: toolDescriptor,
      context: request.context,
      input: ToolInputSanitizer.sanitize(request.input, request.toolName),
      riskAssessment,
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      sessionId: request.context.sessionId
    }

    // Store pending request
    this.approvalStore.setPending(approvalRequest)

    return approvalRequest
  }

  /**
   * Process approval response
   */
  async processApproval(response: ToolApprovalResponse): Promise<void> {
    const request = this.approvalStore.getPending(response.requestId)
    if (!request) {
      throw new Error(`Approval request '${response.requestId}' not found or expired`)
    }

    // Store granted approval
    this.approvalStore.setGranted(response)

    // Remove from pending
    this.approvalStore.deletePending(response.requestId)
  }

  /**
   * Get execution history
   */
  async getExecutionHistory(toolName?: string, limit?: number): Promise<any[]> {
    return await toolRepository.getAuditLogs(toolName || '', limit || 100)
  }

  /**
   * Cancel running execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const controller = this.runningExecutions.get(executionId)
    if (controller) {
      controller.abort('Execution cancelled')
      this.runningExecutions.delete(executionId)
      return true
    }
    return false
  }

  /**
   * Get pending approval requests for a session
   */
  getPendingApprovals(sessionId: string): ToolApprovalRequest[] {
    return this.approvalStore.listPendingForSession(sessionId)
  }

  /**
   * Execute with timeout and abort support
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    signal: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Execution timeout'))
      }, timeoutMs)

      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new Error('Execution aborted'))
      })

      fn()
        .then(result => {
          clearTimeout(timeout)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeout)
          reject(error)
        })
    })
  }

  /**
   * Assess tool execution risk
   */
  private assessRisk(toolDescriptor: any, request: ToolExecutionRequest): {
    level: 'low' | 'medium' | 'high'
    reasons: string[]
    potentialImpact: string[]
  } {
    const reasons: string[] = []
    const potentialImpact: string[] = []

    // Risk level based on tool
    const level = toolDescriptor.riskLevel

    // Risk factors
    if (toolDescriptor.capabilities.includes('filesystem-write')) {
      reasons.push('Tool can write to filesystem')
      potentialImpact.push('Data modification or deletion')
    }

    if (toolDescriptor.capabilities.includes('network-egress')) {
      reasons.push('Tool can access network')
      potentialImpact.push('Data exfiltration or external service calls')
    }

    if (toolDescriptor.capabilities.includes('process-exec')) {
      reasons.push('Tool can execute processes')
      potentialImpact.push('System command execution')
    }

    if (request.context.conversationId) {
      reasons.push('Execution in conversation context')
      potentialImpact.push('Conversation data access')
    }

    return { level, reasons, potentialImpact }
  }

  /**
   * Create error result
   */
  private createErrorResult(code: string, message: string): ToolExecutionResult {
    return {
      success: false,
      error: { code, message },
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

  /**
   * Create approval required result
   */
  private createApprovalRequiredResult(approvalRequest: ToolApprovalRequest): ToolExecutionResult {
    return {
      success: false,
      error: {
        code: 'APPROVAL_REQUIRED',
        message: 'Tool execution requires user approval',
        details: {
          approvalRequestId: approvalRequest.id,
          riskLevel: approvalRequest.riskAssessment.level,
          reasons: approvalRequest.riskAssessment.reasons
        }
      },
      metrics: {
        executionTimeMs: 0,
        capabilitiesUsed: []
      },
      approval: {
        required: true,
        granted: false
      }
    }
  }

  /**
   * Get error code from exception
   */
  private getErrorCode(error: any): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') return 'EXECUTION_ABORTED'
      if (error.name === 'TimeoutError') return 'EXECUTION_TIMEOUT'
      if (error.message.includes('validation')) return 'VALIDATION_ERROR'
      if (error.message.includes('permission')) return 'PERMISSION_DENIED'
      if (error.message.includes('network')) return 'NETWORK_ERROR'
    }
    return 'EXECUTION_ERROR'
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    request: ToolExecutionRequest,
    result: ToolExecutionResult,
    securityEvents: SecurityEvent[]
  ): Promise<void> {
    // In production, this would log to a dedicated audit system
    console.log('Tool execution audit:', {
      toolName: request.toolName,
      executionId: request.context.executionId,
      success: result.success,
      duration: result.metrics.executionTimeMs,
      securityEvents: securityEvents.length
    })
  }
}

/**
 * Factory function for creating execution providers
 */
export function createToolExecutionProvider(
  registry: ToolRegistry,
  options?: ConstructorParameters<typeof DefaultToolExecutionProvider>[1]
): ToolExecutionProvider {
  return new DefaultToolExecutionProvider(registry, options)
}
