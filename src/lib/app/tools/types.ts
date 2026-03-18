/**
 * Tool System Types
 * 
 * Defines the contracts for tool registration, execution, and security
 * following 2026 security best practices for AI agent tool systems.
 */

import { z } from 'zod'

// ============================================================================
// CORE TOOL TYPES
// ============================================================================

/**
 * Tool capability enumeration for security scoping
 */
export type ToolCapability = 
  | 'filesystem-read'
  | 'filesystem-write'
  | 'network-egress'
  | 'database-read'
  | 'database-write'
  | 'runtime-query'
  | 'system-info'
  | 'process-exec'

/**
 * Risk levels for tool approval gating
 */
export type ToolRiskLevel = 'low' | 'medium' | 'high'

/**
 * Execution scope defines where and how tools can run
 */
export interface ExecutionScope {
  /** Allowed filesystem paths (glob patterns) */
  allowedPaths: string[]
  /** Denied filesystem paths (glob patterns) */
  deniedPaths: string[]
  /** Network egress rules */
  networkRules: {
    allowedDomains?: string[]
    allowedPorts?: number[]
    defaultAllow: boolean
  }
  /** Resource limits */
  resourceLimits: {
    maxMemoryMB?: number
    maxCpuPercent?: number
    maxExecutionTimeSec?: number
  }
  /** Required permissions */
  requiredPermissions: ToolCapability[]
}

/**
 * Tool descriptor defines a tool's metadata and security requirements
 */
export interface ToolDescriptor {
  /** Unique tool identifier */
  name: string
  /** Human-readable description */
  description: string
  /** Tool version for compatibility tracking */
  version: string
  /** Tool author/maintainer */
  author?: string
  /** Tool capabilities for security validation */
  capabilities: ToolCapability[]
  /** Risk level determines approval requirements */
  riskLevel: ToolRiskLevel
  /** Whether tool requires explicit user approval */
  approvalRequired: boolean
  /** Execution scope and constraints */
  executionScope: ExecutionScope
  /** Input schema validation */
  inputSchema: z.ZodSchema
  /** Output schema validation */
  outputSchema?: z.ZodSchema
  /** Tool tags for categorization and discovery */
  tags: string[]
  /** Tool metadata */
  metadata?: Record<string, unknown>
}

/**
 * Tool execution context provides runtime information
 */
export interface ToolContext {
  /** Execution ID for tracking */
  executionId: string
  /** User ID (if available) */
  userId?: string
  /** Session ID for approval tracking */
  sessionId: string
  /** Workspace directory */
  workspaceDir: string
  /** Granted capabilities (subset of tool requirements) */
  grantedCapabilities: ToolCapability[]
  /** Execution start time */
  startTime: Date
  /** Parent conversation ID (if applicable) */
  conversationId?: string
}

/**
 * Tool execution request
 */
export interface ToolExecutionRequest {
  /** Tool name to execute */
  toolName: string
  /** Tool input parameters */
  input: unknown
  /** Execution context */
  context: ToolContext
  /** Whether this is a dry-run (validation only) */
  dryRun?: boolean
  /** Approval token if pre-approved */
  approvalToken?: string
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  /** Execution success status */
  success: boolean
  /** Tool output data */
  output?: unknown
  /** Error information if failed */
  error?: {
    code: string
    message: string
    details?: unknown
  }
  /** Execution metrics */
  metrics: {
    executionTimeMs: number
    memoryUsedMB?: number
    capabilitiesUsed: ToolCapability[]
  }
  /** Approval information */
  approval: {
    required: boolean
    granted: boolean
    token?: string
    reason?: string
  }
}

/**
 * Tool approval request for human-in-the-loop
 */
export interface ToolApprovalRequest {
  /** Request ID */
  id: string
  /** Tool being executed */
  tool: ToolDescriptor
  /** Execution context */
  context: ToolContext
  /** Tool input parameters (sanitized) */
  inputSanitized: unknown
  /** Risk assessment */
  riskAssessment: {
    level: ToolRiskLevel
    score: number
    reasons: string[]
    potentialImpact: string[]
  }
  /** Request timestamp */
  requestedAt: Date
  /** Expiration time for approval */
  expiresAt: Date
  /** Session ID */
  sessionId: string
  /** User ID (if available) */
  userId?: string
}

/**
 * Tool approval response
 */
export interface ToolApprovalResponse {
  /** Request ID */
  requestId: string
  /** Approval decision */
  approved: boolean
  /** Approval token if granted */
  token?: string
  /** Granted capabilities (may be subset of requested) */
  grantedCapabilities: ToolCapability[]
  /** Response timestamp */
  respondedAt: Date
  /** Reason for decision */
  reason?: string
}

/**
 * Tool audit log entry
 */
export interface ToolAuditLog {
  /** Log entry ID */
  id: string
  /** Tool name */
  toolName: string
  /** Tool version */
  toolVersion: string
  /** Execution context */
  context: Omit<ToolContext, 'grantedCapabilities'>
  /** Input parameters (sanitized) */
  inputSanitized: unknown
  /** Execution result */
  result: Omit<ToolExecutionResult, 'approval'>
  /** Approval information */
  approval: {
    required: boolean
    granted: boolean
    grantedAt?: Date
    grantedBy?: string
    token?: string
  }
  /** Security events during execution */
  securityEvents: SecurityEvent[]
  /** Timestamp */
  timestamp: Date
}

/**
 * Security event during tool execution
 */
export interface SecurityEvent {
  /** Event type */
  type: 'access_denied' | 'capability_violation' | 'resource_limit_exceeded' | 'suspicious_activity'
  /** Event severity */
  severity: 'low' | 'medium' | 'high' | 'critical'
  /** Event description */
  description: string
  /** Event timestamp */
  timestamp: Date
  /** Event details */
  details: Record<string, unknown>
}

// ============================================================================
// REGISTRY TYPES
// ============================================================================

/**
 * Tool registry interface for tool discovery and management
 */
export interface ToolRegistry {
  /** Register a new tool */
  register(tool: ToolDescriptor): Promise<void>
  /** Unregister a tool */
  unregister(toolName: string): Promise<void>
  /** Get tool descriptor by name */
  get(toolName: string): Promise<ToolDescriptor | null>
  /** List all registered tools */
  list(): Promise<ToolDescriptor[]>
  /** List tools by capability */
  listByCapability(capability: ToolCapability): Promise<ToolDescriptor[]>
  /** List tools by risk level */
  listByRiskLevel(riskLevel: ToolRiskLevel): Promise<ToolDescriptor[]>
  /** Validate tool descriptor */
  validate(tool: ToolDescriptor): Promise<ValidationResult>
  /** Get registry statistics */
  getStats(): Promise<RegistryStats>
}

/**
 * Validation result for tool descriptors
 */
export interface ValidationResult {
  /** Validation success */
  valid: boolean
  /** Validation errors */
  errors: string[]
  /** Validation warnings */
  warnings: string[]
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  /** Total registered tools */
  totalTools: number
  /** Tools by risk level */
  toolsByRiskLevel: Record<ToolRiskLevel, number>
  /** Tools by capability */
  toolsByCapability: Record<ToolCapability, number>
  /** Last updated timestamp */
  lastUpdated: Date
}

// ============================================================================
// EXECUTION PROVIDER TYPES
// ============================================================================

/**
 * Tool execution provider interface
 */
export interface ToolExecutionProvider {
  /** Execute a tool */
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>
  /** Validate execution request */
  validateRequest(request: ToolExecutionRequest): Promise<ValidationResult>
  /** Check if execution requires approval */
  requiresApproval(request: ToolExecutionRequest): Promise<boolean>
  /** Create approval request */
  createApprovalRequest(request: ToolExecutionRequest): Promise<ToolApprovalRequest>
  /** Process approval response */
  processApproval(response: ToolApprovalResponse): Promise<void>
  /** Get execution history */
  getExecutionHistory(toolName?: string, limit?: number): Promise<ToolAuditLog[]>
  /** Cancel running execution */
  cancelExecution(executionId: string): Promise<boolean>
}

// ============================================================================
// BUILT-IN TOOL TYPES
// ============================================================================

/**
 * Base interface for built-in tools
 */
export interface BuiltinTool {
  /** Tool descriptor */
  descriptor: ToolDescriptor
  /** Tool implementation */
  execute(input: unknown, context: ToolContext): Promise<unknown>
  /** Tool validation */
  validate?(input: unknown): ValidationResult
}

// ============================================================================
// SECURITY SCHEMA DEFINITIONS
// ============================================================================

/**
 * Zod schema for execution scope validation
 */
export const ExecutionScopeSchema = z.object({
  allowedPaths: z.array(z.string()).default([]),
  deniedPaths: z.array(z.string()).default([]),
  networkRules: z.object({
    allowedDomains: z.array(z.string()).optional(),
    allowedPorts: z.array(z.number()).optional(),
    defaultAllow: z.boolean().default(false),
  }).default({
    defaultAllow: false,
  }),
  resourceLimits: z.object({
    maxMemoryMB: z.number().positive().optional(),
    maxCpuPercent: z.number().min(0).max(100).optional(),
    maxExecutionTimeSec: z.number().positive().optional(),
  }).default({}),
  requiredPermissions: z.array(z.enum(['filesystem-read', 'filesystem-write', 'network-egress', 'database-read', 'database-write', 'runtime-query', 'system-info', 'process-exec'])).default([]),
})

/**
 * Zod schema for tool descriptor validation
 */
export const ToolDescriptorSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  version: z.string().min(1).max(20),
  author: z.string().optional(),
  capabilities: z.array(z.enum(['filesystem-read', 'filesystem-write', 'network-egress', 'database-read', 'database-write', 'runtime-query', 'system-info', 'process-exec'])),
  riskLevel: z.enum(['low', 'medium', 'high']),
  approvalRequired: z.boolean(),
  executionScope: ExecutionScopeSchema,
  inputSchema: z.any(), // Zod schema instance
  outputSchema: z.any().optional(), // Zod schema instance
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
})

/**
 * Type guards for runtime validation
 */
export function isValidToolCapability(value: unknown): value is ToolCapability {
  return typeof value === 'string' && [
    'filesystem-read',
    'filesystem-write', 
    'network-egress',
    'database-read',
    'database-write',
    'runtime-query',
    'system-info',
    'process-exec'
  ].includes(value)
}

export function isValidToolRiskLevel(value: unknown): value is ToolRiskLevel {
  return typeof value === 'string' && ['low', 'medium', 'high'].includes(value)
}

export function isValidToolDescriptor(value: unknown): value is ToolDescriptor {
  try {
    ToolDescriptorSchema.parse(value)
    return true
  } catch {
    return false
  }
}
