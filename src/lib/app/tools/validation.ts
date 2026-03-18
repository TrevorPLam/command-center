/**
 * Tool Validation Utilities
 * 
 * Comprehensive validation for tool descriptors, execution requests,
 * and security constraints following 2026 best practices.
 */

import { z } from 'zod'
import { 
  ToolDescriptor, 
  ToolExecutionRequest, 
  ToolContext,
  ValidationResult,
  ToolCapability,
  ToolRiskLevel,
  ExecutionScope,
  SecurityEvent
} from './types'

/**
 * Security validator for tool execution
 */
export class ToolSecurityValidator {
  // Static tracking properties
  private static totalValidationsCount = 0
  private static securityEventsList: SecurityEvent[] = []

  /**
   * Validate tool execution request against security constraints
   */
  static validateExecutionRequest(request: ToolExecutionRequest): ValidationResult {
    // Increment validation counter
    ToolSecurityValidator.totalValidationsCount++
    
    const errors: string[] = []
    const warnings: string[] = []

    // Validate tool exists (will be checked by registry, but do basic check)
    if (!request.toolName || request.toolName.trim().length === 0) {
      errors.push('Tool name is required')
    }

    // Validate context
    const contextValidation = this.validateToolContext(request.context)
    errors.push(...contextValidation.errors)
    warnings.push(...contextValidation.warnings)

    // Validate input
    if (request.input === undefined) {
      warnings.push('Tool input is undefined')
    }

    // Validate dry run flag
    if (request.dryRun && request.approvalToken) {
      warnings.push('Dry run with approval token may be unnecessary')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate tool context
   */
  static validateToolContext(context: ToolContext): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields
    if (!context.executionId || context.executionId.trim().length === 0) {
      errors.push('Execution ID is required')
    }

    if (!context.sessionId || context.sessionId.trim().length === 0) {
      errors.push('Session ID is required')
    }

    if (!context.workspaceDir || context.workspaceDir.trim().length === 0) {
      errors.push('Workspace directory is required')
    }

    // Validate workspace directory
    if (context.workspaceDir && !this.isValidPath(context.workspaceDir)) {
      errors.push('Invalid workspace directory path')
    }

    // Validate capabilities
    if (!context.grantedCapabilities || context.grantedCapabilities.length === 0) {
      warnings.push('No capabilities granted to tool')
    }

    // Validate start time
    if (!(context.startTime instanceof Date) || isNaN(context.startTime.getTime())) {
      errors.push('Invalid start time')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate execution scope compliance
   */
  static validateExecutionScope(
    requestedCapabilities: ToolCapability[],
    grantedCapabilities: ToolCapability[],
    executionScope: ExecutionScope,
    context: ToolContext
  ): SecurityEvent[] {
    const events: SecurityEvent[] = []

    // Check capability compliance
    for (const capability of requestedCapabilities) {
      if (!grantedCapabilities.includes(capability)) {
        events.push({
          type: 'capability_violation',
          severity: 'high',
          description: `Tool requires capability '${capability}' but it was not granted`,
          timestamp: new Date(),
          details: {
            requested: requestedCapabilities,
            granted: grantedCapabilities,
            missing: capability
          }
        })
      }
    }

    // Check file system access
    if (requestedCapabilities.includes('filesystem-read') || requestedCapabilities.includes('filesystem-write')) {
      const fsValidation = this.validateFileSystemAccess(executionScope, context)
      events.push(...fsValidation)
    }

    // Check network access
    if (requestedCapabilities.includes('network-egress')) {
      const networkValidation = this.validateNetworkAccess(executionScope)
      events.push(...networkValidation)
    }

    // Check resource limits
    const resourceValidation = this.validateResourceLimits(executionScope, context)
    events.push(...resourceValidation)

    return events
  }

  /**
   * Validate file system access constraints
   */
  static validateFileSystemAccess(executionScope: ExecutionScope, context: ToolContext): SecurityEvent[] {
    const events: SecurityEvent[] = []

    // Check denied paths
    for (const deniedPath of executionScope.deniedPaths) {
      if (this.pathMatches(context.workspaceDir, deniedPath)) {
        events.push({
          type: 'access_denied',
          severity: 'critical',
          description: `Workspace directory matches denied path pattern: ${deniedPath}`,
          timestamp: new Date(),
          details: {
            workspaceDir: context.workspaceDir,
            deniedPath
          }
        })
      }
    }

    // Check allowed paths (if specified)
    if (executionScope.allowedPaths.length > 0) {
      const allowed = executionScope.allowedPaths.some(allowedPath => 
        this.pathMatches(context.workspaceDir, allowedPath)
      )
      
      if (!allowed) {
        events.push({
          type: 'access_denied',
          severity: 'high',
          description: 'Workspace directory not in allowed paths',
          timestamp: new Date(),
          details: {
            workspaceDir: context.workspaceDir,
            allowedPaths: executionScope.allowedPaths
          }
        })
      }
    }

    return events
  }

  /**
   * Validate network access constraints
   */
  static validateNetworkAccess(executionScope: ExecutionScope): SecurityEvent[] {
    const events: SecurityEvent[] = []

    // Default deny policy check
    if (!executionScope.networkRules.defaultAllow && 
        (!executionScope.networkRules.allowedDomains || executionScope.networkRules.allowedDomains.length === 0)) {
      events.push({
        type: 'access_denied',
        severity: 'medium',
        description: 'Network access denied by default policy but no allowed domains specified',
        timestamp: new Date(),
        details: {
          defaultAllow: executionScope.networkRules.defaultAllow,
          allowedDomains: executionScope.networkRules.allowedDomains
        }
      })
    }

    return events
  }

  /**
   * Validate resource limits
   */
  static validateResourceLimits(executionScope: ExecutionScope, context: ToolContext): SecurityEvent[] {
    const events: SecurityEvent[] = []
    const limits = executionScope.resourceLimits

    // Check execution time
    if (limits.maxExecutionTimeSec) {
      const elapsed = (Date.now() - context.startTime.getTime()) / 1000
      if (elapsed > limits.maxExecutionTimeSec) {
        events.push({
          type: 'resource_limit_exceeded',
          severity: 'medium',
          description: `Execution time limit exceeded: ${elapsed.toFixed(2)}s > ${limits.maxExecutionTimeSec}s`,
          timestamp: new Date(),
          details: {
            elapsed,
            limit: limits.maxExecutionTimeSec
          }
        })
      }
    }

    return events
  }

  /**
   * Check if a path matches a glob pattern
   */
  private static pathMatches(path: string, pattern: string): boolean {
    // Simple glob matching - in production, use a proper glob library
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    )
    return regex.test(path)
  }

  /**
   * Validate if a path is safe and valid
   */
  private static isValidPath(path: string): boolean {
    // Basic path validation
    if (!path || typeof path !== 'string') return false
    
    // Check for dangerous path traversal
    if (path.includes('..') || path.includes('~')) return false
    
    // Check for absolute paths (should be relative to workspace)
    if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false
    
    return true
  }
}

/**
 * Tool descriptor validator
 */
export class ToolDescriptorValidator {
  /**
   * Comprehensive tool descriptor validation
   */
  static validate(tool: ToolDescriptor): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic field validation
    this.validateBasicFields(tool, errors, warnings)
    
    // Security validation
    this.validateSecurityFields(tool, errors, warnings)
    
    // Schema validation
    this.validateSchemas(tool, errors, warnings)
    
    // Execution scope validation
    this.validateExecutionScope(tool.executionScope, errors, warnings)

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate basic required fields
   */
  private static validateBasicFields(
    tool: ToolDescriptor, 
    errors: string[], 
    warnings: string[]
  ): void {
    if (!tool.name || tool.name.trim().length === 0) {
      errors.push('Tool name is required')
    } else if (tool.name.length > 100) {
      errors.push('Tool name must be 100 characters or less')
    } else if (!/^[a-zA-Z0-9_-]+$/.test(tool.name)) {
      errors.push('Tool name must contain only letters, numbers, underscores, and hyphens')
    }

    if (!tool.description || tool.description.trim().length === 0) {
      errors.push('Tool description is required')
    } else if (tool.description.length > 500) {
      errors.push('Tool description must be 500 characters or less')
    }

    if (!tool.version || tool.version.trim().length === 0) {
      errors.push('Tool version is required')
    } else if (!/^\d+\.\d+(\.\d+)?$/.test(tool.version)) {
      warnings.push('Tool version should follow semantic versioning (x.y.z)')
    }

    if (tool.author && tool.author.length > 100) {
      warnings.push('Tool author should be 100 characters or less')
    }
  }

  /**
   * Validate security-related fields
   */
  private static validateSecurityFields(
    tool: ToolDescriptor, 
    errors: string[], 
    warnings: string[]
  ): void {
    if (!tool.capabilities || tool.capabilities.length === 0) {
      errors.push('Tool must declare at least one capability')
    }

    if (tool.capabilities.includes('filesystem-write') && !tool.approvalRequired) {
      warnings.push('Tools with filesystem-write capability should require approval')
    }

    if (tool.capabilities.includes('network-egress') && !tool.approvalRequired) {
      warnings.push('Tools with network-egress capability should require approval')
    }

    if (tool.capabilities.includes('process-exec') && tool.riskLevel !== 'high') {
      warnings.push('Tools with process-exec capability should be high-risk')
    }

    if (tool.riskLevel === 'high' && !tool.approvalRequired) {
      warnings.push('High-risk tools should require approval')
    }

    if (tool.riskLevel === 'low' && tool.capabilities.some(cap => 
      ['filesystem-write', 'network-egress', 'process-exec'].includes(cap)
    )) {
      warnings.push('Tools with dangerous capabilities should not be low-risk')
    }
  }

  /**
   * Validate input/output schemas
   */
  private static validateSchemas(
    tool: ToolDescriptor, 
    errors: string[], 
    warnings: string[]
  ): void {
    if (!tool.inputSchema) {
      errors.push('Tool must have an input schema')
    } else if (!(tool.inputSchema instanceof z.ZodSchema)) {
      errors.push('Input schema must be a Zod schema instance')
    }

    if (tool.outputSchema && !(tool.outputSchema instanceof z.ZodSchema)) {
      errors.push('Output schema must be a Zod schema instance')
    }

    // Test input schema with sample data
    if (tool.inputSchema instanceof z.ZodSchema) {
      try {
        tool.inputSchema.parse({})
      } catch (error) {
        warnings.push('Input schema does not accept empty object - may be too restrictive')
      }
    }
  }

  /**
   * Validate execution scope
   */
  private static validateExecutionScope(
    scope: ExecutionScope, 
    errors: string[], 
    warnings: string[]
  ): void {
    // Path validation
    for (const path of scope.allowedPaths) {
      if (!path || typeof path !== 'string') {
        errors.push('Allowed paths must be non-empty strings')
      }
    }

    for (const path of scope.deniedPaths) {
      if (!path || typeof path !== 'string') {
        errors.push('Denied paths must be non-empty strings')
      }
    }

    // Network rules validation
    if (scope.networkRules.allowedDomains) {
      for (const domain of scope.networkRules.allowedDomains) {
        if (!this.isValidDomain(domain)) {
          errors.push(`Invalid domain in allowed domains: ${domain}`)
        }
      }
    }

    if (scope.networkRules.allowedPorts) {
      for (const port of scope.networkRules.allowedPorts) {
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          errors.push(`Invalid port in allowed ports: ${port}`)
        }
      }
    }

    // Resource limits validation
    if (scope.resourceLimits.maxMemoryMB && 
        (!Number.isInteger(scope.resourceLimits.maxMemoryMB) || scope.resourceLimits.maxMemoryMB <= 0)) {
      errors.push('Max memory limit must be a positive integer')
    }

    if (scope.resourceLimits.maxCpuPercent && 
        (!Number.isInteger(scope.resourceLimits.maxCpuPercent) || 
         scope.resourceLimits.maxCpuPercent < 0 || 
         scope.resourceLimits.maxCpuPercent > 100)) {
      errors.push('Max CPU percent must be an integer between 0 and 100')
    }

    if (scope.resourceLimits.maxExecutionTimeSec && 
        (!Number.isInteger(scope.resourceLimits.maxExecutionTimeSec) || 
         scope.resourceLimits.maxExecutionTimeSec <= 0)) {
      errors.push('Max execution time must be a positive integer')
    }
  }

  /**
   * Validate domain format
   */
  private static isValidDomain(domain: string): boolean {
    if (!domain || typeof domain !== 'string') return false
    
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    return domainRegex.test(domain)
  }

  /**
   * Get total number of validations performed
   */
  static getTotalValidations(): number {
    return ToolSecurityValidator.totalValidationsCount
  }

  /**
   * Get all recorded security events
   */
  static getSecurityEvents(): SecurityEvent[] {
    return [...ToolSecurityValidator.securityEventsList]
  }

  /**
   * Record a security event
   */
  static recordSecurityEvent(event: SecurityEvent): void {
    ToolSecurityValidator.securityEventsList.push(event)
  }
}

/**
 * Input sanitizer for tool execution
 */
export class ToolInputSanitizer {
  /**
   * Sanitize tool input for safe logging and storage
   */
  static sanitize(input: unknown, toolName: string): unknown {
    if (input === null || input === undefined) {
      return input
    }

    if (typeof input === 'string') {
      return this.sanitizeString(input)
    }

    if (typeof input === 'object') {
      if (Array.isArray(input)) {
        return input.map(item => this.sanitize(item, toolName))
      } else {
        const sanitized: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(input)) {
          sanitized[key] = this.sanitize(value, toolName)
        }
        return sanitized
      }
    }

    return input
  }

  /**
   * Sanitize string input
   */
  private static sanitizeString(str: string): string {
    // Remove potential sensitive information
    return str
      .replace(/password\s*[:=]\s*\S+/gi, 'password=***')
      .replace(/token\s*[:=]\s*\S+/gi, 'token=***')
      .replace(/key\s*[:=]\s*\S+/gi, 'key=***')
      .replace(/secret\s*[:=]\s*\S+/gi, 'secret=***')
      .replace(/\b[A-Za-z0-9+/]{20,}\b/g, '***') // Potential base64 encoded data
      .replace(/\b[A-Za-z0-9]{32,}\b/g, '***') // Potential API keys
  }
}

/**
 * Utility functions for validation
 */
export function validateToolDescriptor(tool: ToolDescriptor): ValidationResult {
  return ToolDescriptorValidator.validate(tool)
}

export function validateExecutionRequest(request: ToolExecutionRequest): ValidationResult {
  return ToolSecurityValidator.validateExecutionRequest(request)
}

export function sanitizeToolInput(input: unknown, toolName: string): unknown {
  return ToolInputSanitizer.sanitize(input, toolName)
}
