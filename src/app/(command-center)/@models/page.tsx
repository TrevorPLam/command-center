import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getModelProfiles } from '@/app/actions/model-profiles'
import { ModelProfile } from '@/lib/db/schema'
import { ModelsPageClient } from '@/components/models/models-page-client'

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

export default async function ModelsPage() {
  const data = await getModels()
  
  return <ModelsPageClient initialData={data} />
}
