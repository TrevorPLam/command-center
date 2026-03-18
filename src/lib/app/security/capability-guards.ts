/**
 * Capability Guards
 * 
 * Implements capability-based access control for filesystem, shell, and network operations
 * following 2026 security best practices for AI agent tool systems.
 */

import { z } from 'zod'
import { ToolCapability, ToolContext, SecurityEvent } from '../tools/types'
import { getEnv } from '../config/env'

// ============================================================================
// CAPABILITY GUARD TYPES
// ============================================================================

/**
 * Security policy for capability enforcement
 */
export interface SecurityPolicy {
  /** Policy name */
  name: string
  /** Policy description */
  description: string
  /** Capability restrictions */
  capabilityRestrictions: {
    /** Completely forbidden capabilities */
    forbidden: ToolCapability[]
    /** Require explicit approval */
    requireApproval: ToolCapability[]
    /** Resource limits */
    resourceLimits: Partial<Record<ToolCapability, ResourceLimit>>
  }
  /** Path restrictions */
  pathRestrictions: {
    /** Allowed base paths (glob patterns) */
    allowed: string[]
    /** Forbidden paths (glob patterns) */
    forbidden: string[]
    /** Allow workspace-relative paths */
    allowWorkspaceRelative: boolean
  }
  /** Network restrictions */
  networkRestrictions: {
    /** Allow network access */
    allowNetwork: boolean
    /** Allowed domains */
    allowedDomains: string[]
    /** Forbidden domains */
    forbiddenDomains: string[]
    /** Allow localhost only */
    localhostOnly: boolean
  }
}

/**
 * Resource limits for capabilities
 */
export interface ResourceLimit {
  /** Maximum memory usage in MB */
  maxMemoryMB?: number
  /** Maximum execution time in seconds */
  maxExecutionTimeSec?: number
  /** Maximum file size in MB */
  maxFileSizeMB?: number
  /** Maximum number of operations */
  maxOperations?: number
}

/**
 * Capability check result
 */
export interface CapabilityCheckResult {
  /** Access granted */
  granted: boolean
  /** Reason for denial (if denied) */
  reason?: string
  /** Required approval */
  requiresApproval: boolean
  /** Security events generated */
  securityEvents: SecurityEvent[]
  /** Recommendations */
  recommendations: string[]
}

// ============================================================================
// DEFAULT SECURITY POLICIES
// ============================================================================

export const DEFAULT_POLICIES: Record<string, SecurityPolicy> = {
  // Default secure policy
  'default-secure': {
    name: 'Default Secure',
    description: 'Secure defaults for local AI operations',
    capabilityRestrictions: {
      forbidden: ['process-exec'], // Never allow process execution by default
      requireApproval: ['filesystem-write', 'network-egress'],
      resourceLimits: {
        'filesystem-read': {
          maxFileSizeMB: 100,
          maxOperations: 1000,
        },
        'filesystem-write': {
          maxFileSizeMB: 50,
          maxOperations: 100,
        },
        'network-egress': {
          maxExecutionTimeSec: 30,
        },
      },
    },
    pathRestrictions: {
      allowed: ['./data/**', './workspace/**', './temp/**'],
      forbidden: ['./**/.env', './**/secrets/**', './**/private/**'],
      allowWorkspaceRelative: true,
    },
    networkRestrictions: {
      allowNetwork: true,
      allowedDomains: ['registry.npmjs.org', 'github.com', 'ollama.ai', 'huggingface.co'],
      forbiddenDomains: ['malware-example.com'],
      localhostOnly: false,
    },
  },

  // Shared machine policy (more restrictive)
  'shared-machine': {
    name: 'Shared Machine',
    description: 'Restrictive policy for multi-user environments',
    capabilityRestrictions: {
      forbidden: ['process-exec', 'network-egress'],
      requireApproval: ['filesystem-write', 'database-write'],
      resourceLimits: {
        'filesystem-read': {
          maxFileSizeMB: 50,
          maxOperations: 500,
        },
        'filesystem-write': {
          maxFileSizeMB: 10,
          maxOperations: 50,
        },
        'database-write': {
          maxOperations: 10,
        },
      },
    },
    pathRestrictions: {
      allowed: ['./data/user-*/**', './temp/**'],
      forbidden: ['./**/.env', './**/secrets/**', './**/private/**', './**/config/**'],
      allowWorkspaceRelative: true,
    },
    networkRestrictions: {
      allowNetwork: false,
      allowedDomains: [],
      forbiddenDomains: ['*'],
      localhostOnly: true,
    },
  },

  // Air-gapped policy (most restrictive)
  'air-gapped': {
    name: 'Air Gapped',
    description: 'Maximum security policy for isolated environments',
    capabilityRestrictions: {
      forbidden: ['process-exec', 'network-egress'],
      requireApproval: ['filesystem-write', 'database-write'],
      resourceLimits: {
        'filesystem-read': {
          maxFileSizeMB: 25,
          maxOperations: 200,
        },
        'filesystem-write': {
          maxFileSizeMB: 5,
          maxOperations: 25,
        },
      },
    },
    pathRestrictions: {
      allowed: ['./data/**'],
      forbidden: ['./**/.env', './**/secrets/**', './**/private/**', './**/downloads/**'],
      allowWorkspaceRelative: false,
    },
    networkRestrictions: {
      allowNetwork: false,
      allowedDomains: [],
      forbiddenDomains: ['*'],
      localhostOnly: true,
    },
  },
}

// ============================================================================
// CAPABILITY GUARD MANAGER
// ============================================================================

export class CapabilityGuardManager {
  private policy: SecurityPolicy
  private securityEvents: SecurityEvent[] = []

  constructor(policyName?: string) {
    // Determine policy from environment or use default
    const env = getEnv()
    let selectedPolicy = 'default-secure'

    if (env.AIR_GAPPED) {
      selectedPolicy = 'air-gapped'
    } else if (env.ENABLE_AUTH) {
      selectedPolicy = 'shared-machine'
    }

    this.policy = DEFAULT_POLICIES[policyName || selectedPolicy] || DEFAULT_POLICIES['default-secure']
  }

  /**
   * Check if a capability is allowed
   */
  checkCapability(
    capability: ToolCapability,
    context: ToolContext,
    resourcePath?: string,
    targetDomain?: string
  ): CapabilityCheckResult {
    const events: SecurityEvent[] = []
    const recommendations: string[] = []

    // Check if capability is forbidden
    if (this.policy.capabilityRestrictions.forbidden.includes(capability)) {
      events.push({
        type: 'access_denied',
        severity: 'high',
        description: `Capability ${capability} is forbidden by policy`,
        timestamp: new Date(),
        details: { capability, policy: this.policy.name },
      })
      return {
        granted: false,
        reason: `Capability ${capability} is forbidden by ${this.policy.name} policy`,
        requiresApproval: false,
        securityEvents: events,
        recommendations: ['Use a less privileged capability or contact administrator'],
      }
    }

    // Check if capability requires approval
    const requiresApproval = this.policy.capabilityRestrictions.requireApproval.includes(capability)

    // Check resource limits
    const resourceLimit = this.policy.capabilityRestrictions.resourceLimits[capability]
    if (resourceLimit) {
      // In a real implementation, you'd check actual resource usage
      // For now, just record the limit for monitoring
      events.push({
        type: 'capability_violation',
        severity: 'low',
        description: `Resource limits applied to ${capability}`,
        timestamp: new Date(),
        details: { capability, limits: resourceLimit },
      })
    }

    // Check path restrictions for filesystem operations
    if (resourcePath && this.isFilesystemCapability(capability)) {
      const pathCheck = this.checkPathAccess(resourcePath, context)
      if (!pathCheck.allowed) {
        events.push({
          type: 'access_denied',
          severity: 'medium',
          description: `Path access denied: ${resourcePath}`,
          timestamp: new Date(),
          details: { path: resourcePath, reason: pathCheck.reason },
        })
        return {
          granted: false,
          reason: pathCheck.reason,
          requiresApproval: false,
          securityEvents: events,
          recommendations: ['Use an allowed path or request policy exception'],
        }
      }
    }

    // Check network restrictions for network operations
    if (targetDomain && capability === 'network-egress') {
      const networkCheck = this.checkNetworkAccess(targetDomain)
      if (!networkCheck.allowed) {
        events.push({
          type: 'access_denied',
          severity: 'high',
          description: `Network access denied: ${targetDomain}`,
          timestamp: new Date(),
          details: { domain: targetDomain, reason: networkCheck.reason },
        })
        return {
          granted: false,
          reason: networkCheck.reason,
          requiresApproval: false,
          securityEvents: events,
          recommendations: ['Use allowed domain or disable network access'],
        }
      }
    }

    // Generate recommendations
    if (requiresApproval) {
      recommendations.push('Consider using a less privileged alternative')
      recommendations.push('Ensure this operation is necessary for the task')
    }

    return {
      granted: true,
      requiresApproval,
      securityEvents: events,
      recommendations,
    }
  }

  /**
   * Check if a capability is filesystem-related
   */
  private isFilesystemCapability(capability: ToolCapability): boolean {
    return capability === 'filesystem-read' || capability === 'filesystem-write'
  }

  /**
   * Check path access against restrictions
   */
  private checkPathAccess(path: string, context: ToolContext): { allowed: boolean; reason?: string } {
    // Normalize path
    const normalizedPath = path.replace(/\\/g, '/')

    // Check forbidden paths first
    for (const forbidden of this.policy.pathRestrictions.forbidden) {
      if (this.matchesPattern(normalizedPath, forbidden)) {
        return { allowed: false, reason: `Path matches forbidden pattern: ${forbidden}` }
      }
    }

    // Check if workspace-relative paths are allowed
    if (this.policy.pathRestrictions.allowWorkspaceRelative) {
      const relativePath = normalizedPath.replace(context.workspaceDir, './')
      if (relativePath.startsWith('./')) {
        // Workspace-relative path, check if it matches allowed patterns
        for (const allowed of this.policy.pathRestrictions.allowed) {
          if (this.matchesPattern(relativePath, allowed)) {
            return { allowed: true }
          }
        }
      }
    }

    // Check allowed paths
    for (const allowed of this.policy.pathRestrictions.allowed) {
      if (this.matchesPattern(normalizedPath, allowed)) {
        return { allowed: true }
      }
    }

    return { allowed: false, reason: 'Path not in allowed list' }
  }

  /**
   * Check network access against restrictions
   */
  private checkNetworkAccess(domain: string): { allowed: boolean; reason?: string } {
    // Check if network access is allowed
    if (!this.policy.networkRestrictions.allowNetwork) {
      return { allowed: false, reason: 'Network access disabled by policy' }
    }

    // Check localhost-only restriction
    if (this.policy.networkRestrictions.localhostOnly) {
      const isLocalhost = domain === 'localhost' || domain === '127.0.0.1' || domain === '::1'
      if (!isLocalhost) {
        return { allowed: false, reason: 'Only localhost access allowed' }
      }
    }

    // Check forbidden domains
    for (const forbidden of this.policy.networkRestrictions.forbiddenDomains) {
      if (this.matchesPattern(domain, forbidden)) {
        return { allowed: false, reason: `Domain forbidden by policy: ${forbidden}` }
      }
    }

    // Check allowed domains (if specified)
    if (this.policy.networkRestrictions.allowedDomains.length > 0) {
      const isAllowed = this.policy.networkRestrictions.allowedDomains.includes(domain)
      if (!isAllowed) {
        return { allowed: false, reason: 'Domain not in allowed list' }
      }
    }

    return { allowed: true }
  }

  /**
   * Check if a string matches a glob pattern
   */
  private matchesPattern(str: string, pattern: string): boolean {
    if (pattern === '*') {
      return true
    }

    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]')

    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(str)
  }

  /**
   * Get current security policy
   */
  getPolicy(): SecurityPolicy {
    return { ...this.policy }
  }

  /**
   * Get accumulated security events
   */
  getSecurityEvents(): SecurityEvent[] {
    return [...this.securityEvents]
  }

  /**
   * Clear security events
   */
  clearSecurityEvents(): void {
    this.securityEvents = []
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create capability guard manager from environment
 */
export function createCapabilityGuard(): CapabilityGuardManager {
  return new CapabilityGuardManager()
}

/**
 * Quick capability check
 */
export function checkCapability(
  capability: ToolCapability,
  context: ToolContext,
  resourcePath?: string,
  targetDomain?: string
): CapabilityCheckResult {
  const guard = createCapabilityGuard()
  return guard.checkCapability(capability, context, resourcePath, targetDomain)
}

/**
 * Get current security policy name
 */
export function getCurrentPolicyName(): string {
  const env = getEnv()
  
  if (env.AIR_GAPPED) {
    return 'air-gapped'
  }
  
  if (env.ENABLE_AUTH) {
    return 'shared-machine'
  }
  
  return 'default-secure'
}
