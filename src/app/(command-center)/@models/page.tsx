import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getModelProfiles } from '@/app/actions/model-profiles'
import { ModelProfile } from '@/lib/db/schema'

// Server-side data loader with real runtime integration
async function getModels() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'
    
    // Fetch both installed and running models, plus model profiles
    const [modelsResponse, runningModelsResponse, profilesResponse] = await Promise.all([
      fetch(`${baseUrl}/api/runtime/models`, { cache: 'no-store' }),
      fetch(`${baseUrl}/api/runtime/models?running=true`, { cache: 'no-store' }),
      getModelProfiles()
    ])

    let models: any[] = []
    let runningModels: any[] = []
    let runtimeStatus = 'connected'
    let profiles: ModelProfile[] = []

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

    if (profilesResponse.success) {
      profiles = profilesResponse.data.profiles || []
    }

    // Merge model information with running status and profile data
    const mergedModels = models.map(model => {
      const runningInfo = runningModels.find(rm => rm.name === model.name)
      const profile = profiles.find(p => p.runtimeModelName === model.name)
      
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
        digest: model.digest,
        profile, // Include profile data
        reliability: profile ? {
          structuredOutput: profile.structuredOutputReliability,
          toolCalling: profile.toolCallingReliability,
          performance: profile.performanceScore,
          role: profile.role,
        } : null
      }
    })

    return {
      models: mergedModels,
      runtimeStatus,
      modelCount: models.length,
      runningCount: runningModels.length,
      profiles: profiles.length
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
          quantization: 'q4_0',
          profile: null,
          reliability: null
        },
      ],
      runtimeStatus: 'error' as const,
      modelCount: 0,
      runningCount: 0,
      profiles: 0
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

function getReliabilityColor(score: number): string {
  if (score >= 0.8) return 'text-green-600'
  if (score >= 0.6) return 'text-yellow-600'
  return 'text-red-600'
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case 'general': return 'default'
    case 'code': return 'secondary'
    case 'reasoning': return 'outline'
    case 'vision': return 'default'
    case 'embedding': return 'secondary'
    default: return 'outline'
  }
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
          {data.profiles > 0 && (
            <Badge variant="secondary" className="text-xs">
              {data.profiles} profiles
            </Badge>
          )}
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
                  {model.reliability && (
                    <Badge variant={getRoleBadgeVariant(model.reliability.role)} className="text-xs">
                      {model.reliability.role}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {model.description}
                </p>
                
                {/* Reliability Stats */}
                {model.reliability && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Performance</span>
                        <div className="flex items-center gap-1">
                          <Progress value={model.reliability.performance * 100} className="h-1 flex-1" />
                          <span className={getReliabilityColor(model.reliability.performance)}>
                            {(model.reliability.performance * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Structured Output</span>
                        <div className="flex items-center gap-1">
                          <Progress value={model.reliability.structuredOutput * 100} className="h-1 flex-1" />
                          <span className={getReliabilityColor(model.reliability.structuredOutput)}>
                            {(model.reliability.structuredOutput * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">Tool Calling</span>
                        <div className="flex items-center gap-1">
                          <Progress value={model.reliability.toolCalling * 100} className="h-1 flex-1" />
                          <span className={getReliabilityColor(model.reliability.toolCalling)}>
                            {(model.reliability.toolCalling * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Context: {model.contextLength.toLocaleString()}</span>
                  <span>Modified: {new Date(model.modified).toLocaleTimeString()}</span>
                  {model.profile && (
                    <span className="text-green-600">✓ Profile Configured</span>
                  )}
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
                  {!model.profile && (
                    <button className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                      Create Profile
                    </button>
                  )}
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
