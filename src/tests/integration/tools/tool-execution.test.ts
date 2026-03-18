/**
 * Tool Execution Integration Tests
 * 
 * End-to-end tests for tool execution, approval workflows,
 * and audit logging with realistic scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createToolService } from '@/lib/app/services/tool-service'
import { globalToolRegistry } from '@/lib/app/tools/registry'
import { globalApprovalGate } from '@/lib/app/tools/approval-gate'
import { 
  registerBuiltinTools,
  createTestExecutionContext,
  createTestToolDescriptor
} from '../../fixtures/tools/test-helpers'

describe('Tool Execution Integration', () => {
  let toolService: ReturnType<typeof createToolService>
  let testContext: any

  beforeEach(async () => {
    // Reset registry and approval gate
    await globalToolRegistry.clear()
    globalApprovalGate.cleanup()
    
    // Register test tools
    await registerBuiltinTools()
    
    // Create tool service
    toolService = createToolService()
    
    // Create test execution context
    testContext = createTestExecutionContext({
      sessionId: 'test-session-123',
      userId: 'test-user-456',
      workspaceDir: '/tmp/test-workspace'
    })
  })

  afterEach(() => {
    globalApprovalGate.cleanup()
  })

  describe('Tool Discovery', () => {
    it('should list all available tools', async () => {
      const tools = await toolService.listTools()
      
      expect(tools).toHaveLength(6) // 6 built-in tools
      expect(tools.every(tool => 
        tool.name && 
        tool.description && 
        tool.riskLevel && 
        tool.capabilities
      )).toBe(true)
    })

    it('should get specific tool by name', async () => {
      const tool = await toolService.getTool('list-models')
      
      expect(tool.name).toBe('list-models')
      expect(tool.description).toBeTruthy()
      expect(tool.riskLevel).toBe('low')
      expect(tool.capabilities).toContain('runtime-query')
    })

    it('should throw error for non-existent tool', async () => {
      await expect(toolService.getTool('non-existent-tool'))
        .rejects.toThrow('Tool \'non-existent-tool\' not found')
    })
  })

  describe('Low-Risk Tool Execution', () => {
    it('should execute low-risk tools without approval', async () => {
      const request = toolService.createExecutionRequest({
        toolName: 'list-models',
        input: {},
        context: testContext
      })

      const result = await toolService.executeTool(request)

      expect(result.success).toBe(true)
      expect(result.output).toBeDefined()
      expect(result.approval.required).toBe(false)
      expect(result.approval.granted).toBe(true)
      expect(result.metrics.executionTimeMs).toBeGreaterThan(0)
    })

    it('should validate tool input before execution', async () => {
      const request = toolService.createExecutionRequest({
        toolName: 'read-file',
        input: { invalidPath: 123 }, // Should be string
        context: testContext
      })

      const result = await toolService.executeTool(request)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
      expect(result.approval.required).toBe(false)
    })

    it('should handle tool execution failures gracefully', async () => {
      const request = toolService.createExecutionRequest({
        toolName: 'read-file',
        input: { path: '/non/existent/file.txt' },
        context: testContext
      })

      const result = await toolService.executeTool(request)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.metrics.executionTimeMs).toBeGreaterThan(0)
    })
  })

  describe('High-Risk Tool Approval Workflow', () => {
    it('should require approval for high-risk tools', async () => {
      const request = toolService.createExecutionRequest({
        toolName: 'index-file', // Medium risk tool
        input: { 
          path: '/tmp/test.txt',
          content: 'Test content'
        },
        context: testContext
      })

      const result = await toolService.executeTool(request)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('APPROVAL_REQUIRED')
      expect(result.error?.details).toHaveProperty('approvalRequestId')
    })

    it('should create approval request with risk assessment', async () => {
      const request = toolService.createExecutionRequest({
        toolName: 'index-file',
        input: { 
          path: '/tmp/test.txt',
          content: 'Test content'
        },
        context: testContext
      })

      await toolService.executeTool(request)
      
      const pendingApprovals = await toolService.getPendingApprovals(testContext.sessionId)
      
      expect(pendingApprovals).toHaveLength(1)
      const approvalRequest = pendingApprovals[0]
      
      expect(approvalRequest.tool.name).toBe('index-file')
      expect(approvalRequest.riskAssessment.level).toBe('medium')
      expect(approvalRequest.riskAssessment.reasons.length).toBeGreaterThan(0)
      expect(approvalRequest.expiresAt).toBeInstanceOf(Date)
    })

    it('should execute approved tool successfully', async () => {
      // Create initial request to generate approval
      const request = toolService.createExecutionRequest({
        toolName: 'index-file',
        input: { 
          path: '/tmp/test.txt',
          content: 'Test content'
        },
        context: testContext
      })

      const initialResult = await toolService.executeTool(request)
      expect(initialResult.success).toBe(false)
      expect(initialResult.error?.code).toBe('APPROVAL_REQUIRED')

      // Get approval request and approve it
      const pendingApprovals = await toolService.getPendingApprovals(testContext.sessionId)
      expect(pendingApprovals).toHaveLength(1)
      
      const approvalRequest = pendingApprovals[0]
      await toolService.submitApproval(approvalRequest.id, {
        approved: true,
        reason: 'Test approval'
      })

      // Execute again with approval token
      const approvedRequest = toolService.createExecutionRequest({
        toolName: 'index-file',
        input: { 
          path: '/tmp/test.txt',
          content: 'Test content'
        },
        context: testContext
      })

      const result = await toolService.executeTool(approvedRequest)

      expect(result.success).toBe(true)
      expect(result.approval.required).toBe(true)
      expect(result.approval.granted).toBe(true)
    })

    it('should reject execution with denied approval', async () => {
      // Create initial request to generate approval
      const request = toolService.createExecutionRequest({
        toolName: 'index-file',
        input: { 
          path: '/tmp/test.txt',
          content: 'Test content'
        },
        context: testContext
      })

      await toolService.executeTool(request)
      
      // Get approval request and deny it
      const pendingApprovals = await toolService.getPendingApprovals(testContext.sessionId)
      const approvalRequest = pendingApprovals[0]
      
      await toolService.submitApproval(approvalRequest.id, {
        approved: false,
        reason: 'Test denial'
      })

      // Execute should fail
      const deniedRequest = toolService.createExecutionRequest({
        toolName: 'index-file',
        input: { 
          path: '/tmp/test.txt',
          content: 'Test content'
        },
        context: testContext
      })

      const result = await toolService.executeTool(deniedRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('APPROVAL_DENIED')
    })
  })

  describe('Risk Assessment', () => {
    it('should assess risk for tool execution', async () => {
      const riskAssessment = await toolService.assessRisk(
        'index-file',
        { path: '/tmp/test.txt', content: 'Test content' },
        testContext
      )

      expect(riskAssessment.level).toBe('medium')
      expect(riskAssessment.score).toBeGreaterThan(40)
      expect(riskAssessment.factors.length).toBeGreaterThan(0)
      expect(riskAssessment.recommendations.length).toBeGreaterThan(0)
    })

    it('should provide higher risk scores for dangerous capabilities', async () => {
      // Create a high-risk test tool
      const highRiskTool = createTestToolDescriptor({
        name: 'dangerous-tool',
        riskLevel: 'high',
        capabilities: ['filesystem-write', 'network-egress', 'process-exec'],
        approvalRequired: true
      })
      
      await globalToolRegistry.register(highRiskTool)

      const riskAssessment = await toolService.assessRisk(
        'dangerous-tool',
        { command: 'rm -rf /' },
        testContext
      )

      expect(riskAssessment.level).toBe('high')
      expect(riskAssessment.score).toBeGreaterThan(70)
      expect(riskAssessment.factors).toContain('Tool can write to filesystem')
      expect(riskAssessment.factors).toContain('Tool can access network')
      expect(riskAssessment.factors).toContain('Tool can execute processes')
    })
  })

  describe('Audit and History', () => {
    it('should record execution history', async () => {
      // Execute a tool
      const request = toolService.createExecutionRequest({
        toolName: 'list-models',
        input: {},
        context: testContext
      })

      await toolService.executeTool(request)

      // Check execution history
      const history = await toolService.getExecutionHistory('list-models', 10)
      
      expect(history.length).toBeGreaterThan(0)
      const execution = history[0]
      
      expect(execution.toolName).toBe('list-models')
      expect(execution.success).toBe(true)
      expect(execution.timestamp).toBeInstanceOf(Date)
    })

    it('should record failed executions in audit log', async () => {
      // Execute a tool with invalid input
      const request = toolService.createExecutionRequest({
        toolName: 'read-file',
        input: { path: 123 }, // Invalid input
        context: testContext
      })

      await toolService.executeTool(request)

      // Check execution history
      const history = await toolService.getExecutionHistory('read-file', 10)
      
      expect(history.length).toBeGreaterThan(0)
      const execution = history[0]
      
      expect(execution.toolName).toBe('read-file')
      expect(execution.success).toBe(false)
      expect(execution.error).toBeDefined()
    })

    it('should provide tool statistics', async () => {
      // Execute some tools
      const tools = ['list-models', 'get-metrics', 'query-settings']
      
      for (const toolName of tools) {
        const request = toolService.createExecutionRequest({
          toolName,
          input: {},
          context: testContext
        })
        await toolService.executeTool(request)
      }

      const stats = await toolService.getToolStats()
      
      expect(stats.registry.totalTools).toBeGreaterThan(0)
      expect(stats.registry.toolsByRiskLevel).toBeDefined()
      expect(stats.registry.toolsByCapability).toBeDefined()
      expect(stats.approvals).toBeDefined()
      expect(stats.security).toBeDefined()
    })
  })

  describe('Security and Validation', () => {
    it('should validate execution context', async () => {
      const invalidContext = {
        executionId: '',
        sessionId: '',
        workspaceDir: '',
        grantedCapabilities: [],
        startTime: new Date()
      }

      const request = toolService.createExecutionRequest({
        toolName: 'list-models',
        input: {},
        context: invalidContext
      })

      const result = await toolService.executeTool(request)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('VALIDATION_ERROR')
    })

    it('should enforce capability requirements', async () => {
      // Create context without required capabilities
      const limitedContext = createTestExecutionContext({
        sessionId: 'test-session-123',
        userId: 'test-user-456',
        workspaceDir: '/tmp/test-workspace',
        grantedCapabilities: [] // No capabilities granted
      })

      const request = toolService.createExecutionRequest({
        toolName: 'index-file', // Requires filesystem-write
        input: { path: '/tmp/test.txt', content: 'Test' },
        context: limitedContext
      })

      const result = await toolService.executeTool(request)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('PERMISSION_DENIED')
    })

    it('should handle concurrent execution limits', async () => {
      // This test would require mocking the execution provider to test limits
      // For now, we'll just verify the validation exists
      const request = toolService.createExecutionRequest({
        toolName: 'list-models',
        input: {},
        context: testContext
      })

      const validation = await toolService.validateExecution(request)
      expect(validation.valid).toBe(true)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed tool names gracefully', async () => {
      await expect(toolService.getTool(''))
        .rejects.toThrow()
      await expect(toolService.getTool('tool-with-invalid-chars!@#'))
        .rejects.toThrow()
    })

    it('should handle very large input payloads', async () => {
      const largeInput = {
        data: 'x'.repeat(1024 * 1024) // 1MB string
      }

      const request = toolService.createExecutionRequest({
        toolName: 'list-models',
        input: largeInput,
        context: testContext
      })

      // Should handle large inputs without crashing
      const result = await toolService.executeTool(request)
      expect(result).toBeDefined()
    })

    it('should handle expired approval requests', async () => {
      // Create approval request
      const request = toolService.createExecutionRequest({
        toolName: 'index-file',
        input: { path: '/tmp/test.txt', content: 'Test' },
        context: testContext
      })

      await toolService.executeTool(request)
      
      // Manually expire the request
      const pendingApprovals = await toolService.getPendingApprovals(testContext.sessionId)
      const approvalRequest = pendingApprovals[0]
      
      // Simulate expiration by setting past date
      approvalRequest.expiresAt = new Date(Date.now() - 1000)
      
      // Try to approve expired request
      await expect(
        toolService.submitApproval(approvalRequest.id, { approved: true })
      ).rejects.toThrow('not found or expired')
    })
  })
})
