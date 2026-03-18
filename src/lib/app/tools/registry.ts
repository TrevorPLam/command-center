/**
 * Tool Registry Implementation
 * 
 * Provides centralized tool registration, discovery, and validation
 * following 2026 security best practices for AI agent tool systems.
 */

import { randomUUID } from 'crypto'
import { 
  ToolDescriptor, 
  ToolRegistry, 
  ValidationResult, 
  RegistryStats,
  ToolCapability,
  ToolRiskLevel,
  ToolDescriptorSchema,
  isValidToolDescriptor
} from './types'

/**
 * In-memory tool registry implementation
 * 
 * Note: In production, this should be backed by persistent storage
 * with proper concurrency controls and audit logging.
 */
export class InMemoryToolRegistry implements ToolRegistry {
  private tools = new Map<string, ToolDescriptor>()
  private toolsByCapability = new Map<ToolCapability, Set<string>>()
  private toolsByRiskLevel = new Map<ToolRiskLevel, Set<string>>()
  private lastUpdated = new Date()

  /**
   * Register a new tool
   */
  async register(tool: ToolDescriptor): Promise<void> {
    // Validate tool descriptor
    const validation = await this.validate(tool)
    if (!validation.valid) {
      throw new Error(`Tool validation failed: ${validation.errors.join(', ')}`)
    }

    // Check for conflicts
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`)
    }

    // Register tool
    this.tools.set(tool.name, tool)

    // Update capability index
    for (const capability of tool.capabilities) {
      if (!this.toolsByCapability.has(capability)) {
        this.toolsByCapability.set(capability, new Set())
      }
      this.toolsByCapability.get(capability)!.add(tool.name)
    }

    // Update risk level index
    if (!this.toolsByRiskLevel.has(tool.riskLevel)) {
      this.toolsByRiskLevel.set(tool.riskLevel, new Set())
    }
    this.toolsByRiskLevel.get(tool.riskLevel)!.add(tool.name)

    this.lastUpdated = new Date()
  }

  /**
   * Unregister a tool
   */
  async unregister(toolName: string): Promise<void> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Tool '${toolName}' is not registered`)
    }

    // Remove from main registry
    this.tools.delete(toolName)

    // Remove from capability indexes
    for (const capability of tool.capabilities) {
      this.toolsByCapability.get(capability)?.delete(toolName)
    }

    // Remove from risk level index
    this.toolsByRiskLevel.get(tool.riskLevel)?.delete(toolName)

    this.lastUpdated = new Date()
  }

  /**
   * Get tool descriptor by name
   */
  async get(toolName: string): Promise<ToolDescriptor | null> {
    return this.tools.get(toolName) || null
  }

  /**
   * List all registered tools
   */
  async list(): Promise<ToolDescriptor[]> {
    return Array.from(this.tools.values())
  }

  /**
   * List tools by capability
   */
  async listByCapability(capability: ToolCapability): Promise<ToolDescriptor[]> {
    const toolNames = this.toolsByCapability.get(capability) || new Set()
    const tools: ToolDescriptor[] = []
    
    for (const name of toolNames) {
      const tool = this.tools.get(name)
      if (tool) {
        tools.push(tool)
      }
    }
    
    return tools
  }

  /**
   * List tools by risk level
   */
  async listByRiskLevel(riskLevel: ToolRiskLevel): Promise<ToolDescriptor[]> {
    const toolNames = this.toolsByRiskLevel.get(riskLevel) || new Set()
    const tools: ToolDescriptor[] = []
    
    for (const name of toolNames) {
      const tool = this.tools.get(name)
      if (tool) {
        tools.push(tool)
      }
    }
    
    return tools
  }

  /**
   * Validate tool descriptor
   */
  async validate(tool: ToolDescriptor): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Schema validation
    try {
      ToolDescriptorSchema.parse(tool)
    } catch (error) {
      errors.push(`Schema validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Business logic validation
    if (!tool.name || tool.name.trim().length === 0) {
      errors.push('Tool name is required')
    }

    if (!tool.description || tool.description.trim().length === 0) {
      errors.push('Tool description is required')
    }

    if (!tool.version || tool.version.trim().length === 0) {
      errors.push('Tool version is required')
    }

    // Security validation
    if (tool.capabilities.length === 0) {
      warnings.push('Tool has no declared capabilities')
    }

    if (tool.riskLevel === 'high' && !tool.approvalRequired) {
      warnings.push('High-risk tool should require approval')
    }

    if (tool.riskLevel === 'low' && tool.approvalRequired) {
      warnings.push('Low-risk tool may not need approval')
    }

    // Execution scope validation
    if (tool.executionScope.requiredPermissions.length === 0) {
      warnings.push('Tool has no required permissions')
    }

    // Check for capability/permission mismatch
    const missingPermissions = tool.capabilities.filter(
      cap => !tool.executionScope.requiredPermissions.includes(cap)
    )
    if (missingPermissions.length > 0) {
      warnings.push(`Tool declares capabilities not in required permissions: ${missingPermissions.join(', ')}`)
    }

    // Check for permission/capability mismatch
    const extraPermissions = tool.executionScope.requiredPermissions.filter(
      perm => !tool.capabilities.includes(perm)
    )
    if (extraPermissions.length > 0) {
      warnings.push(`Tool requires permissions not declared as capabilities: ${extraPermissions.join(', ')}`)
    }

    // Input schema validation
    if (!tool.inputSchema) {
      errors.push('Tool must have an input schema')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<RegistryStats> {
    const toolsByRiskLevel: Record<ToolRiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0
    }

    const toolsByCapability: Record<ToolCapability, number> = {
      'filesystem-read': 0,
      'filesystem-write': 0,
      'network-egress': 0,
      'database-read': 0,
      'database-write': 0,
      'runtime-query': 0,
      'system-info': 0,
      'process-exec': 0
    }

    for (const tool of this.tools.values()) {
      toolsByRiskLevel[tool.riskLevel]++
      for (const capability of tool.capabilities) {
        toolsByCapability[capability]++
      }
    }

    return {
      totalTools: this.tools.size,
      toolsByRiskLevel,
      toolsByCapability,
      lastUpdated: this.lastUpdated
    }
  }

  /**
   * Clear all registered tools (for testing/reset)
   */
  async clear(): Promise<void> {
    this.tools.clear()
    this.toolsByCapability.clear()
    this.toolsByRiskLevel.clear()
    this.lastUpdated = new Date()
  }

  /**
   * Check if a tool exists
   */
  async exists(toolName: string): Promise<boolean> {
    return this.tools.has(toolName)
  }

  /**
   * Get tools by tag
   */
  async listByTag(tag: string): Promise<ToolDescriptor[]> {
    return Array.from(this.tools.values()).filter(tool => 
      tool.tags.includes(tag)
    )
  }

  /**
   * Search tools by name or description
   */
  async search(query: string): Promise<ToolDescriptor[]> {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.tools.values()).filter(tool =>
      tool.name.toLowerCase().includes(lowerQuery) ||
      tool.description.toLowerCase().includes(lowerQuery) ||
      tool.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }
}

/**
 * Global tool registry instance
 * 
 * In a real application, this should be properly initialized and managed
 * through dependency injection or a service container.
 */
export const globalToolRegistry = new InMemoryToolRegistry()

/**
 * Tool registry factory for creating configured instances
 */
export function createToolRegistry(): ToolRegistry {
  return new InMemoryToolRegistry()
}

/**
 * Utility function to register multiple tools
 */
export async function registerTools(registry: ToolRegistry, tools: ToolDescriptor[]): Promise<void> {
  const errors: string[] = []
  
  for (const tool of tools) {
    try {
      await registry.register(tool)
    } catch (error) {
      errors.push(`Failed to register tool '${tool.name}': ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Tool registration failed: ${errors.join('; ')}`)
  }
}
