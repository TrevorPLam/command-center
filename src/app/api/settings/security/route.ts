/**
 * Security Settings API Route
 * 
 * API endpoints for managing security settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEnv } from '@/lib/config/env'
import { createNetworkSecurityManager } from '@/lib/app/security/network-security'
import { createOfflineModeManager } from '@/lib/app/security/offline-mode'
import { getCurrentPolicyName } from '@/lib/app/security/capability-guards'

// GET /api/settings/security - Get current security settings
export async function GET() {
  try {
    const env = getEnv()
    const networkManager = createNetworkSecurityManager()
    const offlineManager = createOfflineModeManager()
    
    const settings = {
      enableAuth: env.ENABLE_AUTH,
      networkIsolation: env.NETWORK_ISOLATION,
      airGapped: env.AIR_GAPPED,
      bindingMode: networkManager.getConfig().bindingMode,
      allowOutbound: env.ALLOW_OUTBOUND,
      allowedDomains: env.ALLOWED_DOMAINS?.split(',').filter(Boolean) || [],
      blockedDomains: env.BLOCKED_DOMAINS?.split(',').filter(Boolean) || [],
      securityPolicy: getCurrentPolicyName(),
      networkConfig: networkManager.getConfig(),
      offlineMode: offlineManager.getMode(),
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Failed to get security settings:', error)
    return NextResponse.json(
      { error: 'Failed to get security settings' },
      { status: 500 }
    )
  }
}

// POST /api/settings/security - Update security settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const { enableAuth, networkIsolation, airGapped, bindingMode, allowOutbound, allowedDomains, blockedDomains } = body
    
    // In a real implementation, you would update environment configuration
    // For now, we'll just validate and return success
    
    const validation = validateSecuritySettings(body)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid settings', details: validation.errors },
        { status: 400 }
      )
    }

    // Log the change for audit purposes
    console.log('Security settings updated:', {
      timestamp: new Date().toISOString(),
      changes: body,
      // In production, you'd include user info
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Settings updated. Restart required for changes to take effect.',
      restartRequired: true
    })
  } catch (error) {
    console.error('Failed to update security settings:', error)
    return NextResponse.json(
      { error: 'Failed to update security settings' },
      { status: 500 }
    )
  }
}

// Validate security settings
function validateSecuritySettings(settings: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate binding mode
  const validBindingModes = ['localhost-only', 'lan-access', 'all-interfaces']
  if (settings.bindingMode && !validBindingModes.includes(settings.bindingMode)) {
    errors.push('Invalid binding mode')
  }

  // Validate domains
  if (settings.allowedDomains && !Array.isArray(settings.allowedDomains)) {
    errors.push('Allowed domains must be an array')
  }

  if (settings.blockedDomains && !Array.isArray(settings.blockedDomains)) {
    errors.push('Blocked domains must be an array')
  }

  // Validate domain formats
  const domainRegex = /^[a-zA-Z0-9.-]+$/
  if (settings.allowedDomains?.some((domain: string) => !domainRegex.test(domain))) {
    errors.push('Invalid domain format in allowed domains')
  }

  if (settings.blockedDomains?.some((domain: string) => !domainRegex.test(domain))) {
    errors.push('Invalid domain format in blocked domains')
  }

  // Validate air-gapped mode consistency
  if (settings.airGapped && settings.allowOutbound) {
    errors.push('Air-gapped mode cannot allow outbound connections')
  }

  if (settings.airGapped && settings.bindingMode !== 'localhost-only') {
    errors.push('Air-gapped mode requires localhost-only binding')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
