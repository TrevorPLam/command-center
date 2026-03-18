/**
 * Offline Mode and Air-Gapped Security
 * 
 * Implements offline/air-gapped mode flags and enforcement points
 * for maximum security in isolated environments.
 */

import { z } from 'zod'
import { getEnv } from '../config/env'

// ============================================================================
// OFFLINE MODE TYPES
// ============================================================================

/**
 * Offline operation modes
 */
export type OfflineMode = 'online' | 'offline' | 'air-gapped'

/**
 * Network access policies
 */
export interface NetworkAccessPolicy {
  /** Allow any network access */
  allowAny: boolean
  /** Allow specific domains */
  allowedDomains: string[]
  /** Block specific domains */
  blockedDomains: string[]
  /** Allow local network access */
  allowLocalNetwork: boolean
  /** Allow loopback access */
  allowLoopback: boolean
}

/**
 * Offline mode restrictions
 */
export interface OfflineModeRestrictions {
  /** Network access restrictions */
  networkAccess: NetworkAccessPolicy
  /** Disable external API calls */
  disableExternalApis: boolean
  /** Disable model downloads */
  disableModelDownloads: boolean
  /** Disable telemetry and analytics */
  disableTelemetry: boolean
  /** Disable automatic updates */
  disableAutoUpdates: boolean
  /** Require local resources only */
  requireLocalResources: boolean
}

/**
 * Offline mode validation result
 */
export interface OfflineModeValidationResult {
  /** Valid offline mode configuration */
  valid: boolean
  /** Current offline mode */
  mode: OfflineMode
  /** Violations detected */
  violations: string[]
  /** Warnings */
  warnings: string[]
  /** Recommendations */
  recommendations: string[]
}

// ============================================================================
// OFFLINE MODE CONFIGURATION
// ============================================================================

export const OFFLINE_MODE_CONFIGS = {
  /** Online mode - no restrictions */
  online: {
    networkAccess: {
      allowAny: true,
      allowedDomains: [],
      blockedDomains: [],
      allowLocalNetwork: true,
      allowLoopback: true,
    },
    disableExternalApis: false,
    disableModelDownloads: false,
    disableTelemetry: false,
    disableAutoUpdates: false,
    requireLocalResources: false,
  },

  /** Offline mode - block external access but allow local */
  offline: {
    networkAccess: {
      allowAny: false,
      allowedDomains: [],
      blockedDomains: [
        '*.google.com',
        '*.facebook.com',
        '*.microsoft.com',
        '*.amazon.com',
        '*.cloudflare.com',
      ],
      allowLocalNetwork: true,
      allowLoopback: true,
    },
    disableExternalApis: true,
    disableModelDownloads: true,
    disableTelemetry: true,
    disableAutoUpdates: true,
    requireLocalResources: true,
  },

  /** Air-gapped mode - complete network isolation */
  'air-gapped': {
    networkAccess: {
      allowAny: false,
      allowedDomains: [],
      blockedDomains: ['*'],
      allowLocalNetwork: false,
      allowLoopback: true, // Only allow loopback for local services
    },
    disableExternalApis: true,
    disableModelDownloads: true,
    disableTelemetry: true,
    disableAutoUpdates: true,
    requireLocalResources: true,
  },
} as const

// ============================================================================
// OFFLINE MODE MANAGER
// ============================================================================

export class OfflineModeManager {
  private mode: OfflineMode
  private restrictions: OfflineModeRestrictions

  constructor(mode?: OfflineMode) {
    this.mode = mode || this.determineMode()
    this.restrictions = { ...OFFLINE_MODE_CONFIGS[this.mode] }
  }

  /**
   * Determine offline mode from environment
   */
  private determineMode(): OfflineMode {
    const env = getEnv()
    
    if (env.AIR_GAPPED) {
      return 'air-gapped'
    }
    
    if (process.env.OFFLINE_MODE === 'true') {
      return 'offline'
    }
    
    return 'online'
  }

  /**
   * Get current offline mode
   */
  getMode(): OfflineMode {
    return this.mode
  }

  /**
   * Get current restrictions
   */
  getRestrictions(): OfflineModeRestrictions {
    return { ...this.restrictions }
  }

  /**
   * Check if network access is allowed for a domain
   */
  isNetworkAccessAllowed(domain: string): boolean {
    const policy = this.restrictions.networkAccess

    // If any access is allowed
    if (policy.allowAny) {
      return true
    }

    // Check loopback
    if (domain === 'localhost' || domain === '127.0.0.1' || domain === '::1') {
      return policy.allowLoopback
    }

    // Check local network
    if (this.isLocalNetwork(domain)) {
      return policy.allowLocalNetwork
    }

    // Check blocked domains
    if (policy.blockedDomains.some(pattern => this.matchesPattern(domain, pattern))) {
      return false
    }

    // Check allowed domains
    if (policy.allowedDomains.length > 0) {
      return policy.allowedDomains.includes(domain)
    }

    // Default deny
    return false
  }

  /**
   * Check if external APIs are allowed
   */
  areExternalApisAllowed(): boolean {
    return !this.restrictions.disableExternalApis
  }

  /**
   * Check if model downloads are allowed
   */
  areModelDownloadsAllowed(): boolean {
    return !this.restrictions.disableModelDownloads
  }

  /**
   * Check if telemetry is allowed
   */
  isTelemetryAllowed(): boolean {
    return !this.restrictions.disableTelemetry
  }

  /**
   * Check if automatic updates are allowed
   */
  areAutoUpdatesAllowed(): boolean {
    return !this.restrictions.disableAutoUpdates
  }

  /**
   * Check if local resources are required
   */
  localResourcesRequired(): boolean {
    return this.restrictions.requireLocalResources
  }

  /**
   * Validate current offline mode configuration
   */
  validateConfiguration(): OfflineModeValidationResult {
    const violations: string[] = []
    const warnings: string[] = []
    const recommendations: string[] = []

    // Check for inconsistencies
    if (this.mode === 'air-gapped' && this.restrictions.networkAccess.allowLocalNetwork) {
      violations.push('Air-gapped mode should not allow local network access')
    }

    if (this.mode === 'online' && this.restrictions.disableExternalApis) {
      warnings.push('Online mode with external APIs disabled may limit functionality')
    }

    // Check environment consistency
    const env = getEnv()
    if (this.mode === 'air-gapped' && env.ALLOW_OUTBOUND) {
      violations.push('Air-gapped mode conflicts with ALLOW_OUTBOUND=true')
    }

    if (this.mode === 'offline' && !env.NETWORK_ISOLATION) {
      warnings.push('Offline mode should have network isolation enabled')
    }

    // Check for potential security issues
    if (this.mode === 'air-gapped' && this.restrictions.networkAccess.allowedDomains.length > 0) {
      violations.push('Air-gapped mode should not have allowed domains')
    }

    // Generate recommendations
    if (this.mode === 'online') {
      recommendations.push('Consider offline mode for better security')
      recommendations.push('Monitor network access for unauthorized connections')
    }

    if (this.mode === 'offline') {
      recommendations.push('Ensure all required models are locally available')
      recommendations.push('Test functionality without external dependencies')
    }

    if (this.mode === 'air-gapped') {
      recommendations.push('Verify complete network isolation')
      recommendations.push('Ensure all dependencies are pre-installed')
    }

    return {
      valid: violations.length === 0,
      mode: this.mode,
      violations,
      warnings,
      recommendations,
    }
  }

  /**
   * Enforce offline mode restrictions on a network request
   */
  enforceNetworkRestrictions(url: string): { allowed: boolean; reason?: string } {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname

      if (!this.isNetworkAccessAllowed(domain)) {
        return {
          allowed: false,
          reason: `Network access to ${domain} is blocked in ${this.mode} mode`,
        }
      }

      return { allowed: true }
    } catch (error) {
      return {
        allowed: false,
        reason: 'Invalid URL format',
      }
    }
  }

  /**
   * Check if a domain is a local network address
   */
  private isLocalNetwork(domain: string): boolean {
    // Check for common local network patterns
    const localPatterns = [
      /^192\.168\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^169\.254\./, // Link-local
      /^localhost$/,
      /^\.local$/,
    ]

    return localPatterns.some(pattern => pattern.test(domain))
  }

  /**
   * Check if domain matches a pattern (supports wildcards)
   */
  private matchesPattern(domain: string, pattern: string): boolean {
    if (pattern === '*') {
      return true
    }

    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
      const regex = new RegExp(`^${regexPattern}$`)
      return regex.test(domain)
    }

    return domain === pattern
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create offline mode manager from environment
 */
export function createOfflineModeManager(): OfflineModeManager {
  return new OfflineModeManager()
}

/**
 * Validate offline mode configuration
 */
export function validateOfflineMode(): OfflineModeValidationResult {
  const manager = createOfflineModeManager()
  return manager.validateConfiguration()
}

/**
 * Check if network request is allowed
 */
export function isNetworkRequestAllowed(url: string): { allowed: boolean; reason?: string } {
  const manager = createOfflineModeManager()
  return manager.enforceNetworkRestrictions(url)
}

/**
 * Get offline mode status for display
 */
export function getOfflineModeStatus(): {
  mode: OfflineMode
  isTrulyOffline: boolean
  restrictions: string[]
} {
  const manager = createOfflineModeManager()
  const restrictions = manager.getRestrictions()
  
  const restrictionList = [
    ...(restrictions.disableExternalApis ? ['External APIs disabled'] : []),
    ...(restrictions.disableModelDownloads ? ['Model downloads disabled'] : []),
    ...(restrictions.disableTelemetry ? ['Telemetry disabled'] : []),
    ...(restrictions.disableAutoUpdates ? ['Auto updates disabled'] : []),
    ...(restrictions.requireLocalResources ? ['Local resources only'] : []),
  ]

  return {
    mode: manager.getMode(),
    isTrulyOffline: manager.getMode() !== 'online',
    restrictions: restrictionList,
  }
}
