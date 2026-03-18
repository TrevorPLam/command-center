/**
 * Tool System Exports
 * 
 * Central exports for the tool registry, execution, and validation system
 * following 2026 security best practices for AI agent tool systems.
 */

// Core types
export {
  type ToolCapability,
  type ToolRiskLevel,
  type ExecutionScope,
  type ToolDescriptor,
  type ToolContext,
  type ToolExecutionRequest,
  type ToolExecutionResult,
  type ToolApprovalRequest,
  type ToolApprovalResponse,
  type ToolAuditLog,
  type SecurityEvent,
  type ToolRegistry,
  type ValidationResult,
  type RegistryStats,
  type ToolExecutionProvider,
  type BuiltinTool,
} from './types'

export {
  ExecutionScopeSchema,
  ToolDescriptorSchema,
  isValidToolCapability,
  isValidToolRiskLevel,
  isValidToolDescriptor,
} from './types'

// Registry implementation
export {
  InMemoryToolRegistry,
  globalToolRegistry,
  createToolRegistry,
  registerTools,
} from './registry'

// Validation utilities
export {
  ToolSecurityValidator,
  ToolDescriptorValidator,
  ToolInputSanitizer,
  validateToolDescriptor,
  validateExecutionRequest,
  sanitizeToolInput,
} from './validation'

// Execution provider and approval system
export {
  DefaultToolExecutionProvider,
  createToolExecutionProvider,
} from './execution-provider'

export {
  ToolApprovalGate,
  globalApprovalGate,
  createToolApprovalGate,
  type ApprovalStatus,
  type ApprovalDecision,
  type ApprovalSession,
  type ApprovalStats,
} from './approval-gate'

// Built-in tools
export {
  ListModelsTool,
  ReadFileTool,
  QuerySettingsTool,
  GetMetricsTool,
  IndexFileTool,
  SummarizeFileTool,
  createListModelsTool,
  createReadFileTool,
  createQuerySettingsTool,
  createGetMetricsTool,
  createIndexFileTool,
  createSummarizeFileTool,
  getAllBuiltinTools,
  registerBuiltinTools,
} from './builtin'

// Re-export for convenience
export type { 
  ToolCapability as Capability,
  ToolRiskLevel as RiskLevel,
  ExecutionScope as Scope,
  ToolDescriptor as Descriptor,
  ToolContext as Context,
  ToolExecutionRequest as Request,
  ToolExecutionResult as Result,
} from './types'
