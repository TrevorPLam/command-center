import { MonitoringPanel } from '@/components/monitoring/monitoring-panel'
import { metricsEmitter } from '@/lib/app/services/metrics-emitter'

// Start metrics collection on server
export async function getServerMetrics() {
  try {
    // Start metrics emitter if not already running
    metricsEmitter.start()
    
    // Get initial metrics snapshot
    const snapshot = await metricsEmitter.forceCollection()
    return snapshot
  } catch (error) {
    console.error('Failed to get initial metrics:', error)
    return null
  }
}

export default async function MonitoringPage() {
  const initialMetrics = await getServerMetrics()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Monitoring</h1>
        <div className="text-sm text-muted-foreground">
          Real-time system and application metrics
        </div>
      </div>
      
      <MonitoringPanel />
    </div>
  )
}
