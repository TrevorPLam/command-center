/**
 * Network Security Configuration
 * 
 * Implements network isolation, binding validation, and security warnings
 * following 2026 security best practices for local AI applications.
 */

import { z } from 'zod'
import { getEnv } from '../config/env'

// ============================================================================
// NETWORK SECURITY TYPES
// ============================================================================

/**
 * Network binding modes
 */
export type NetworkBindingMode = 'localhost-only' | 'lan-access' | 'all-interfaces'

/**
 * Security posture levels
 */
export type SecurityPosture = 'default-secure' | 'shared-machine' | 'air-gapped'

/**
 * Network security configuration
 */
export interface NetworkSecurityConfig {
  /** Host binding mode */
  bindingMode: NetworkBindingMode
  /** Security posture */
  posture: SecurityPosture
  /** Allowed network interfaces */
  allowedInterfaces: string[]
  /** Blocked network interfaces */
  blockedInterfaces: string[]
  /** Port binding restrictions */
  portRestrictions: {
    /** Ports that must be localhost-only */
    localhostOnlyPorts: number[]
    /** Blocked ports */
    blockedPorts: number[]
    /** Allowed port ranges */
    allowedRanges: Array<{ start: number; end: number }>
  }
  /** Network isolation settings */
  isolation: {
    /** Enable network isolation */
    enabled: boolean
    /** Allow outbound connections */
    allowOutbound: boolean
    /** Allowed outbound domains */
    allowedDomains?: string[]
    /** Blocked outbound domains */
    blockedDomains?: string[]
  }
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  /** Overall validation status */
  valid: boolean
  /** Security warnings */
  warnings: string[]
  /** Security errors */
  errors: string[]
  /** Recommendations */
  recommendations: string[]
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

// ============================================================================
// SECURITY DEFAULTS
// ============================================================================

export const SECURITY_DEFAULTS = {
  // Default to localhost-only binding for maximum security
  bindingMode: 'localhost-only' as NetworkBindingMode,
  // Default secure posture
  posture: 'default-secure' as SecurityPosture,
  // Only allow loopback interface by default
  allowedInterfaces: ['127.0.0.1', '::1'],
  // Block all external interfaces by default
  blockedInterfaces: ['0.0.0.0', '::'],
  // Critical ports that must be localhost-only
  localhostOnlyPorts: [3000, 11434, 5678, 18789],
  // Commonly attacked ports to block
  blockedPorts: [22, 23, 80, 443, 3389, 5432, 3306],
  // Allowed port ranges for development
  allowedRanges: [
    { start: 3000, end: 3010 }, // Development ports
    { start: 8000, end: 8010 }, // Alternative dev ports
    { start: 9000, end: 9010 }, // Alternative service ports
  ],
  // Network isolation defaults
  isolation: {
    enabled: true,
    allowOutbound: true,
    allowedDomains: [
      'registry.npmjs.org',
      'github.com',
      'ollama.ai',
      'huggingface.co',
    ],
    blockedDomains: [
      'malware-example.com',
      'suspicious-domain.com',
    ],
  },
} as const

// ============================================================================
// CONFIGURATION SCHEMA
// ============================================================================

const NetworkSecurityConfigSchema = z.object({
  bindingMode: z.enum(['localhost-only', 'lan-access', 'all-interfaces']).default('localhost-only'),
  posture: z.enum(['default-secure', 'shared-machine', 'air-gapped']).default('default-secure'),
  allowedInterfaces: z.array(z.string()).default(['127.0.0.1', '::1']),
  blockedInterfaces: z.array(z.string()).default(['0.0.0.0', '::']),
  portRestrictions: z.object({
    localhostOnlyPorts: z.array(z.number()).default([3000, 11434, 5678, 18789]),
    blockedPorts: z.array(z.number()).default([22, 23, 80, 443, 3389, 5432, 3306]),
    allowedRanges: z.array(z.object({
      start: z.number(),
      end: z.number(),
    })).default([
      { start: 3000, end: 3010 },
      { start: 8000, end: 8010 },
      { start: 9000, end: 9010 },
    ]),
  }),
  isolation: z.object({
    enabled: z.boolean().default(true),
    allowOutbound: z.boolean().default(true),
    allowedDomains: z.array(z.string()).optional(),
    blockedDomains: z.array(z.string()).optional(),
  }).default({
    enabled: true,
    allowOutbound: true,
  }),
})

// ============================================================================
// NETWORK SECURITY MANAGER
// ============================================================================

export class NetworkSecurityManager {
  private config: NetworkSecurityConfig

  constructor(config?: Partial<NetworkSecurityConfig>) {
    // Merge provided config with security defaults
    this.config = {
      ...SECURITY_DEFAULTS,
      ...config,
      portRestrictions: {
        ...SECURITY_DEFAULTS.portRestrictions,
        ...config?.portRestrictions,
      },
      isolation: {
        ...SECURITY_DEFAULTS.isolation,
        ...config?.isolation,
      },
    }
  }

  /**
   * Get current network security configuration
   */
  getConfig(): NetworkSecurityConfig {
    return { ...this.config }
  }

  /**
   * Validate network binding configuration
   */
  validateBinding(host: string, port: number): SecurityValidationResult {
    const warnings: string[] = []
    const errors: string[] = []
    const recommendations: string[] = []

    // Check for unsafe binding
    if (host === '0.0.0.0' || host === '::') {
      errors.push(`Binding to ${host} exposes the service on all network interfaces`)
      recommendations.push('Use 127.0.0.1 or ::1 for localhost-only binding')
    }

    // Check for localhost-only ports
    if (this.config.portRestrictions.localhostOnlyPorts.includes(port)) {
      if (host !== '127.0.0.1' && host !== '::1') {
        errors.push(`Port ${port} must be bound to localhost only for security`)
        recommendations.push(`Use 127.0.0.1:${port} or ::1:${port}`)
      }
    }

    // Check for blocked ports
    if (this.config.portRestrictions.blockedPorts.includes(port)) {
      errors.push(`Port ${port} is blocked for security reasons`)
      recommendations.push('Use an alternative port from the allowed ranges')
    }

    // Check allowed port ranges
    const inAllowedRange = this.config.portRestrictions.allowedRanges.some(
      range => port >= range.start && port <= range.end
    )
    if (!inAllowedRange && !this.config.portRestrictions.localhostOnlyPorts.includes(port)) {
      warnings.push(`Port ${port} is outside the recommended ranges`)
      recommendations.push('Consider using ports 3000-3010, 8000-8010, or 9000-9010')
    }

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(errors.length, warnings.length)

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      recommendations,
      riskLevel,
    }
  }

  /**
   * Validate overall network security posture
   */
  validateSecurityPosture(): SecurityValidationResult {
    const warnings: string[] = []
    const errors: string[] = []
    const recommendations: string[] = []

    // Check binding mode
    if (this.config.bindingMode === 'all-interfaces') {
      errors.push('Binding to all interfaces creates significant security risk')
      recommendations.push('Use localhost-only binding unless explicitly required')
    }

    if (this.config.bindingMode === 'lan-access') {
      warnings.push('LAN access mode exposes services to local network')
      recommendations.push('Ensure network firewall is properly configured')
    }

    // Check isolation settings
    if (!this.config.isolation.enabled) {
      warnings.push('Network isolation is disabled')
      recommendations.push('Enable network isolation for better security')
    }

    if (this.config.isolation.allowOutbound && !this.config.isolation.allowedDomains?.length) {
      warnings.push('Outbound connections allowed without domain restrictions')
      recommendations.push('Configure allowed domains for outbound connections')
    }

    // Check posture-specific settings
    if (this.config.posture === 'air-gapped' && this.config.isolation.allowOutbound) {
      errors.push('Air-gapped posture should not allow outbound connections')
      recommendations.push('Disable outbound connections for air-gapped mode')
    }

    if (this.config.posture === 'shared-machine' && this.config.bindingMode !== 'localhost-only') {
      errors.push('Shared machine posture requires localhost-only binding')
      recommendations.push('Use localhost-only binding on shared machines')
    }

    const riskLevel = this.calculateRiskLevel(errors.length, warnings.length)

    return {
      valid: errors.length === 0,
      warnings,
      errors,
      recommendations,
      riskLevel,
    }
  }

  /**
   * Get security recommendations based on current configuration
   */
  getSecurityRecommendations(): string[] {
    const recommendations: string[] = []

    if (this.config.bindingMode !== 'localhost-only') {
      recommendations.push('Use localhost-only binding for maximum security')
    }

    if (!this.config.isolation.enabled) {
      recommendations.push('Enable network isolation to prevent unauthorized access')
    }

    if (this.config.isolation.allowOutbound && !this.config.isolation.allowedDomains?.length) {
      recommendations.push('Restrict outbound connections to specific domains')
    }

    if (this.config.posture === 'default-secure') {
      recommendations.push('Consider shared-machine posture if multiple users access this system')
      recommendations.push('Use air-gapped posture for maximum security')
    }

    return recommendations
  }

  /**
   * Check if a domain is allowed for outbound connections
   */
  isDomainAllowed(domain: string): boolean {
    // Check blocked domains first
    if (this.config.isolation.blockedDomains?.includes(domain)) {
      return false
    }

    // If no allowed domains are specified, allow by default
    if (!this.config.isolation.allowedDomains?.length) {
      return true
    }

    // Check allowed domains
    return this.config.isolation.allowedDomains.includes(domain)
  }

  /**
   * Calculate risk level based on issues found
   */
  private calculateRiskLevel(errorCount: number, warningCount: number): 'low' | 'medium' | 'high' | 'critical' {
    if (errorCount > 0) {
      return errorCount >= 3 ? 'critical' : 'high'
    }
    if (warningCount >= 3) {
      return 'medium'
    }
    if (warningCount > 0) {
      return 'low'
    }
    return 'low'
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create network security manager from environment configuration
 */
export function createNetworkSecurityManager(): NetworkSecurityManager {
  const env = getEnv()
  
  // Determine binding mode from environment
  let bindingMode: NetworkBindingMode = 'localhost-only'
  if (env.HOSTNAME === '0.0.0.0') {
    bindingMode = 'all-interfaces'
  } else if (env.HOSTNAME !== 'localhost' && env.HOSTNAME !== '127.0.0.1') {
    bindingMode = 'lan-access'
  }

  // Determine security posture
  let posture: SecurityPosture = 'default-secure'
  if (process.env.AIR_GAPPED === 'true') {
    posture = 'air-gapped'
  } else if (env.ENABLE_AUTH) {
    posture = 'shared-machine'
  }

  return new NetworkSecurityManager({
    bindingMode,
    posture,
    isolation: {
      enabled: process.env.NETWORK_ISOLATION !== 'false',
      allowOutbound: process.env.ALLOW_OUTBOUND !== 'false',
      allowedDomains: process.env.ALLOWED_DOMAINS?.split(','),
      blockedDomains: process.env.BLOCKED_DOMAINS?.split(','),
    },
  })
}

/**
 * Validate startup network configuration
 */
export function validateStartupNetworkConfig(): SecurityValidationResult {
  const manager = createNetworkSecurityManager()
  const env = getEnv()
  
  // Validate the main application binding
  const bindingValidation = manager.validateBinding(env.HOSTNAME, env.PORT)
  
  // Validate overall security posture
  const postureValidation = manager.validateSecurityPosture()
  
  // Combine results
  return {
    valid: bindingValidation.valid && postureValidation.valid,
    warnings: [...bindingValidation.warnings, ...postureValidation.warnings],
    errors: [...bindingValidation.errors, ...postureValidation.errors],
    recommendations: [...bindingValidation.recommendations, ...postureValidation.recommendations],
    riskLevel: bindingValidation.riskLevel === 'critical' || postureValidation.riskLevel === 'critical' 
      ? 'critical' 
      : bindingValidation.riskLevel === 'high' || postureValidation.riskLevel === 'high'
      ? 'high'
      : bindingValidation.riskLevel === 'medium' || postureValidation.riskLevel === 'medium'
      ? 'medium'
      : 'low',
  }
}
