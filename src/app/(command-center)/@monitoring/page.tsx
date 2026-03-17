import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { StatusIndicator } from '@/components/ui/status-indicator'

// Server-side data loader with real runtime diagnostics
async function getMonitoringData() {
  try {
    // Fetch runtime health and diagnostics
    const [healthResponse, diagnosticsResponse] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/runtime/health`, {
        cache: 'no-store'
      }),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/runtime/diagnostics?metrics=true`, {
        cache: 'no-store'
      })
    ])

    let health = { status: 'unhealthy', modelCount: 0, runningModelCount: 0, errors: ['API unavailable'] }
    let diagnostics = null

    if (healthResponse.ok) {
      const healthResult = await healthResponse.json()
      health = healthResult.data
    }

    if (diagnosticsResponse.ok) {
      const diagnosticsResult = await diagnosticsResponse.json()
      diagnostics = diagnosticsResult.data
    }

    return {
      runtime: {
        health,
        diagnostics,
        models: diagnostics?.models || { total: 0, running: 0, available: 0, list: [] },
        runningModels: diagnostics?.runningModels || []
      },
      // Keep mock system data for now (will be replaced with real system monitoring later)
      system: {
        cpu: {
          usage: 45.2,
          cores: 8,
          temperature: 62,
        },
        memory: {
          used: 8.2,
          total: 16,
          percentage: 51.3,
        },
        disk: {
          used: 234.5,
          total: 512,
          percentage: 45.8,
        },
        network: {
          download: 1.2,
          upload: 0.8,
        },
      },
      services: [
        {
          name: 'Ollama Runtime',
          status: health.status === 'healthy' ? 'healthy' as const : health.status === 'degraded' ? 'warning' as const : 'error' as const,
          uptime: 'Unknown',
          memory: diagnostics?.metrics ? (diagnostics.metrics.averageLatency / 1000).toFixed(1) : 'Unknown',
          cpu: health.latency || 0,
        },
        {
          name: 'Command Center',
          status: 'healthy' as const,
          uptime: 'Unknown',
          memory: 0.5,
          cpu: 8.7,
        },
      ],
      alerts: health.errors.map((error: string, index: number) => ({
        id: index.toString(),
        level: health.status === 'healthy' ? 'success' as const : health.status === 'degraded' ? 'warning' as const : 'error' as const,
        message: error,
        timestamp: new Date().toISOString(),
      })),
    }
  } catch (error) {
    // Fallback to mock data if API calls fail
    return {
      runtime: {
        health: { status: 'error', modelCount: 0, runningModelCount: 0, errors: ['Failed to connect to runtime'] },
        diagnostics: null,
        models: { total: 0, running: 0, available: 0, list: [] },
        runningModels: []
      },
      system: {
        cpu: { usage: 45.2, cores: 8, temperature: 62 },
        memory: { used: 8.2, total: 16, percentage: 51.3 },
        disk: { used: 234.5, total: 512, percentage: 45.8 },
        network: { download: 1.2, upload: 0.8 },
      },
      services: [
        {
          name: 'Ollama Runtime',
          status: 'error' as const,
          uptime: 'Unknown',
          memory: 'Unknown',
          cpu: 0,
        },
        {
          name: 'Command Center',
          status: 'healthy' as const,
          uptime: 'Unknown',
          memory: 0.5,
          cpu: 8.7,
        },
      ],
      alerts: [
        {
          id: '1',
          level: 'error' as const,
          message: 'Failed to connect to Ollama runtime',
          timestamp: new Date().toISOString(),
        },
      ],
    }
  }
}

export default async function MonitoringPage() {
  const data = await getMonitoringData()

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'online'
      case 'warning':
        return 'busy'
      case 'error':
        return 'error'
      default:
        return 'offline'
    }
  }

  const getAlertVariant = (level: string) => {
    switch (level) {
      case 'error':
        return 'destructive'
      case 'warning':
        return 'secondary'
      default:
        return 'muted'
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Monitoring</PanelTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator status="online" />
          <span className="text-sm text-muted-foreground">System Healthy</span>
        </div>
      </PanelHeader>
      
      <div className="space-y-4">
        {/* Runtime Status */}
        <div className="rounded-md border border-border p-4">
          <h4 className="font-medium text-foreground mb-3">Runtime Status</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ollama Runtime</span>
              <div className="flex items-center gap-2">
                <StatusIndicator status={getStatusVariant(data.runtime.health.status)} />
                <span className="text-sm text-foreground capitalize">{data.runtime.health.status}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Models</span>
                <div className="text-foreground">{data.runtime.models.total}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Running</span>
                <div className="text-foreground">{data.runtime.models.running}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Latency</span>
                <div className="text-foreground">{data.runtime.health.latency}ms</div>
              </div>
              <div>
                <span className="text-muted-foreground">Available</span>
                <div className="text-foreground">{data.runtime.models.available}</div>
              </div>
            </div>

            {data.runtime.runningModels.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-foreground mb-2">Running Models</h5>
                <div className="space-y-1">
                  {data.runtime.runningModels.map((model: any) => (
                    <div key={model.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{model.name}</span>
                      <div className="flex items-center gap-2">
                        <StatusIndicator status={model.status === 'running' ? 'online' : 'busy'} />
                        <span className="text-foreground">{model.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* System Resources */}
        <div className="rounded-md border border-border p-4">
          <h4 className="font-medium text-foreground mb-3">System Resources</h4>
          <div className="space-y-3">
            {/* CPU */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">CPU Usage</span>
                <span className="text-foreground">{data.system.cpu.usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${data.system.cpu.usage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{data.system.cpu.cores} cores</span>
                <span>{data.system.cpu.temperature}°C</span>
              </div>
            </div>

            {/* Memory */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Memory</span>
                <span className="text-foreground">{data.system.memory.used}GB / {data.system.memory.total}GB</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${data.system.memory.percentage}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.system.memory.percentage.toFixed(1)}% used
              </div>
            </div>

            {/* Disk */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Disk</span>
                <span className="text-foreground">{data.system.disk.used}GB / {data.system.disk.total}GB</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full"
                  style={{ width: `${data.system.disk.percentage}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.system.disk.percentage.toFixed(1)}% used
              </div>
            </div>

            {/* Network */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Network</span>
              <div className="flex gap-4">
                <span className="text-foreground">↓ {data.system.network.download}MB/s</span>
                <span className="text-foreground">↑ {data.system.network.upload}MB/s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Services Status */}
        <div className="rounded-md border border-border p-4">
          <h4 className="font-medium text-foreground mb-3">Services</h4>
          <div className="space-y-3">
            {data.services.map((service) => (
              <div key={service.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIndicator status={getStatusVariant(service.status)} />
                  <div>
                    <div className="font-medium text-foreground text-sm">{service.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Uptime: {service.uptime} • Memory: {service.memory}GB • CPU: {service.cpu}%
                    </div>
                  </div>
                </div>
                <button className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90">
                  Details
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <div className="rounded-md border border-border p-4">
            <h4 className="font-medium text-foreground mb-3">Recent Alerts</h4>
            <div className="space-y-2">
              {data.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-md border border-border p-3 bg-${getAlertVariant(alert.level)}/10`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-foreground text-sm">{alert.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded bg-${getAlertVariant(alert.level)} text-${getAlertVariant(alert.level)}-foreground`}>
                      {alert.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
