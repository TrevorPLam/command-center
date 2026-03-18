/**
 * Security Settings Component
 * 
 * UI for configuring security settings with inline explanations
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Lock, 
  Network, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle,
  Info,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react'

interface SecuritySettings {
  enableAuth: boolean
  networkIsolation: boolean
  airGapped: boolean
  bindingMode: 'localhost-only' | 'lan-access' | 'all-interfaces'
  allowOutbound: boolean
  allowedDomains: string[]
  blockedDomains: string[]
}

export default function SecuritySettings() {
  const [settings, setSettings] = useState<SecuritySettings>({
    enableAuth: false,
    networkIsolation: true,
    airGapped: false,
    bindingMode: 'localhost-only',
    allowOutbound: true,
    allowedDomains: ['registry.npmjs.org', 'github.com', 'ollama.ai'],
    blockedDomains: [],
  })
  
  const [showSecrets, setShowSecrets] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Load current settings
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/security')
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
      }
    } catch (error) {
      console.error('Failed to load security settings:', error)
    }
  }

  const saveSettings = async () => {
    setIsLoading(true)
    setSaveStatus('idle')

    try {
      const response = await fetch('/api/settings/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
      }
    } catch (error) {
      console.error('Failed to save security settings:', error)
      setSaveStatus('error')
    } finally {
      setIsLoading(false)
    }
  }

  const getSecurityLevel = () => {
    if (settings.airGapped) return { level: 'Maximum', color: 'bg-red-500', icon: WifiOff }
    if (settings.enableAuth && settings.networkIsolation) return { level: 'High', color: 'bg-orange-500', icon: Shield }
    if (settings.networkIsolation) return { level: 'Medium', color: 'bg-yellow-500', icon: Lock }
    return { level: 'Basic', color: 'bg-blue-500', icon: Settings }
  }

  const securityLevel = getSecurityLevel()
  const SecurityIcon = securityLevel.icon

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8" />
            Security Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure security posture and access controls for your AI command center
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge className={`${securityLevel.color} text-white`}>
            <SecurityIcon className="h-3 w-3 mr-1" />
            {securityLevel.level} Security
          </Badge>
        </div>
      </div>

      {/* Security Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Security Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Authentication</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {settings.enableAuth ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Network className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Network Binding</p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  {settings.bindingMode.replace('-', ' ')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <WifiOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-200">Isolation</p>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  {settings.airGapped ? 'Air-gapped' : settings.networkIsolation ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Authentication
          </CardTitle>
          <CardDescription>
            Configure user authentication for shared machine access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="enable-auth">Enable Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require users to sign in with credentials
              </p>
            </div>
            <Switch
              id="enable-auth"
              checked={settings.enableAuth}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enableAuth: checked }))}
            />
          </div>

          {settings.enableAuth && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Authentication requires a JWT_SECRET environment variable to be set.
                Restart the application after changing this setting.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Network Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Network Security
          </CardTitle>
          <CardDescription>
            Configure network binding and access restrictions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="binding-mode">Network Binding Mode</Label>
            <Select
              value={settings.bindingMode}
              onValueChange={(value: any) => setSettings(prev => ({ ...prev, bindingMode: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="localhost-only">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Localhost Only (Recommended)
                  </div>
                </SelectItem>
                <SelectItem value="lan-access">
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    LAN Access
                  </div>
                </SelectItem>
                <SelectItem value="all-interfaces">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    All Interfaces (Not Recommended)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {settings.bindingMode === 'localhost-only' && 'Only allow connections from localhost (127.0.0.1)'}
              {settings.bindingMode === 'lan-access' && 'Allow connections from local network'}
              {settings.bindingMode === 'all-interfaces' && 'Allow connections from any network interface'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="network-isolation">Network Isolation</Label>
              <p className="text-sm text-muted-foreground">
                Enable network access restrictions and monitoring
              </p>
            </div>
            <Switch
              id="network-isolation"
              checked={settings.networkIsolation}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, networkIsolation: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="air-gapped">Air-Gapped Mode</Label>
              <p className="text-sm text-muted-foreground">
                Complete network isolation for maximum security
              </p>
            </div>
            <Switch
              id="air-gapped"
              checked={settings.airGapped}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, airGapped: checked }))}
            />
          </div>

          {settings.airGapped && (
            <Alert>
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                Air-gapped mode disables all external network access. Ensure all required models and dependencies are locally available.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Outbound Access */}
      {!settings.airGapped && (
        <Card>
          <CardHeader>
            <CardTitle>Outbound Network Access</CardTitle>
            <CardDescription>
              Configure allowed external domains and services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="allow-outbound">Allow Outbound Connections</Label>
                <p className="text-sm text-muted-foreground">
                  Permit external network requests
                </p>
              </div>
              <Switch
                id="allow-outbound"
                checked={settings.allowOutbound}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, allowOutbound: checked }))}
              />
            </div>

            {settings.allowOutbound && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Allowed Domains</Label>
                  <div className="flex flex-wrap gap-2">
                    {settings.allowedDomains.map((domain, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {domain}
                        <button
                          onClick={() => {
                            setSettings(prev => ({
                              ...prev,
                              allowedDomains: prev.allowedDomains.filter((_, i) => i !== index)
                            }))
                          }}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Blocked Domains</Label>
                  <div className="flex flex-wrap gap-2">
                    {settings.blockedDomains.map((domain, index) => (
                      <Badge key={index} variant="destructive" className="flex items-center gap-1">
                        {domain}
                        <button
                          onClick={() => {
                            setSettings(prev => ({
                              ...prev,
                              blockedDomains: prev.blockedDomains.filter((_, i) => i !== index)
                            }))
                          }}
                          className="ml-1 hover:text-red-300"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Save Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Changes require application restart to take effect
        </div>
        
        <div className="flex items-center gap-3">
          {saveStatus === 'success' && (
            <span className="text-green-600 text-sm">Settings saved successfully</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-600 text-sm">Failed to save settings</span>
          )}
          
          <Button
            onClick={saveSettings}
            disabled={isLoading}
            className="min-w-[100px]"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  )
}
