import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { StatusIndicator } from '@/components/ui/status-indicator'

// Server-side data loader with real runtime integration
async function getModels() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'
    
    // Fetch both installed and running models
    const [modelsResponse, runningModelsResponse] = await Promise.all([
      fetch(`${baseUrl}/api/runtime/models`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/runtime/models?running=true`, { cache: 'no-store' })
    ])

    let models: any[] = []
    let runningModels: any[] = []
    let runtimeStatus = 'connected'

    if (modelsResponse.ok) {
      const modelsResult = await modelsResponse.json()
      models = modelsResult.data || []
    } else {
      runtimeStatus = 'error'
    }

    if (runningModelsResponse.ok) {
      const runningModelsResult = await runningModelsResponse.json()
      runningModels = runningModelsResult.data || []
    }

    // Merge model information with running status
    const mergedModels = models.map(model => {
      const runningInfo = runningModels.find(rm => rm.name === model.name)
      return {
        id: model.name,
        name: model.name.replace(/:.+$/, ''), // Remove tag for display
        fullName: model.name,
        size: formatModelSize(model.size),
        status: runningInfo ? 'running' : 'available',
        description: createModelDescription(model),
        contextLength: model.details?.num_ctx || 0,
        modified: model.modified_at,
        family: model.details?.family,
        parameterSize: model.details?.parameter_size,
        quantization: model.details?.quantization_level,
        digest: model.digest
      }
    })

    return {
      models: mergedModels,
      runtimeStatus,
      modelCount: models.length,
      runningCount: runningModels.length
    }
  } catch (error) {
    console.error('Failed to fetch models:', error)
    
    // Return fallback data
    return {
      models: [
        {
          id: 'llama-3.1-8b',
          name: 'Llama 3.1',
          fullName: 'llama3.1:8b',
          size: '8B',
          status: 'available' as const,
          description: 'Meta\'s Llama 3.1 8B parameter model',
          contextLength: 128000,
          modified: new Date(Date.now() - 3600000).toISOString(),
          family: 'llama',
          parameterSize: '8B',
          quantization: 'q4_0'
        },
      ],
      runtimeStatus: 'error' as const,
      modelCount: 0,
      runningCount: 0
    }
  }
}

function formatModelSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  }
  return `${bytes}B`
}

function createModelDescription(model: any): string {
  const family = model.details?.family || 'Unknown'
  const parameterSize = model.details?.parameter_size || 'Unknown'
  const quantization = model.details?.quantization_level || 'Unknown'
  
  return `${family} model with ${parameterSize} parameters (${quantization})`
}

export default async function ModelsPage() {
  const data = await getModels()

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'online'
      case 'available':
        return 'busy'
      case 'stopped':
        return 'offline'
      default:
        return 'offline'
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Models</PanelTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator status={data.runtimeStatus === 'connected' ? 'online' : 'error'} />
          <span className="text-sm text-muted-foreground">
            {data.modelCount} models ({data.runningCount} running)
          </span>
        </div>
      </PanelHeader>
      
      <div className="space-y-3">
        {data.models.map((model) => (
          <div
            key={model.id}
            className="rounded-md border border-border p-4 hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">{model.name}</h4>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {model.size}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {model.description}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Context: {model.contextLength.toLocaleString()}</span>
                  <span>Modified: {new Date(model.modified).toLocaleTimeString()}</span>
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-2">
                <StatusIndicator status={getStatusVariant(model.status)} />
                <span className="text-xs text-muted-foreground capitalize">
                  {model.status}
                </span>
                <div className="flex gap-1">
                  {model.status === 'stopped' && (
                    <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded hover:bg-primary/90">
                      Start
                    </button>
                  )}
                  {model.status === 'running' && (
                    <button className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded hover:bg-destructive/90">
                      Stop
                    </button>
                  )}
                  <button className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded hover:bg-secondary/90">
                    Configure
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {data.models.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No models found</p>
            <button className="mt-2 text-sm bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
              Pull Model
            </button>
          </div>
        )}
      </div>
    </Panel>
  )
}
