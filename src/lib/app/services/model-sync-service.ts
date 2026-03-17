/**
 * Model Sync Service
 * 
 * Handles synchronization of model inventory between the runtime and local storage.
 * Provides model metadata enrichment, change detection, and persistence.
 */

import { RuntimeModel, RuntimeModelState } from '../runtime/types'
import { RuntimeError, RuntimeErrorCode } from '../runtime/errors'
import { getRuntimeService } from './runtime-service'
import { modelProfileRepository, ModelRole } from '../persistence/model-profile-repository'
import { ModelProfile as DBModelProfile } from '../db/schema'

export interface ModelCapabilities {
  supportsChat: boolean
  supportsEmbeddings: boolean
  supportsVision: boolean
  supportsJsonFormat: boolean
  supportsToolCalling: boolean
  maxContextLength: number
  preferredTemperature?: number
  recommendedMaxTokens?: number
}

export interface SyncResult {
  added: DBModelProfile[]
  updated: DBModelProfile[]
  removed: string[]
  errors: string[]
}

export class ModelSyncService {
  private runtimeService = getRuntimeService()
  
  /**
   * Sync installed models with local profiles
   */
  async syncModels(): Promise<SyncResult> {
    try {
      const runtimeModels = await this.runtimeService.listModels()
      const existingProfiles = await this.getLocalProfiles()
      
      const result: SyncResult = {
        added: [],
        updated: [],
        removed: [],
        errors: []
      }

      // Create a map for efficient lookup
      const existingMap = new Map(existingProfiles.map(p => [p.runtimeModelName, p]))
      const runtimeMap = new Map(runtimeModels.map(m => [m.name, m]))

      // Find new and updated models
      for (const runtimeModel of runtimeModels) {
        const existingProfile = existingMap.get(runtimeModel.name)
        
        if (!existingProfile) {
          // New model found
          try {
            const profile = await this.createProfileFromRuntime(runtimeModel)
            result.added.push(profile)
            await this.saveProfile(profile)
          } catch (error) {
            result.errors.push(`Failed to create profile for ${runtimeModel.name}: ${error}`)
          }
        } else if (this.hasModelChanged(runtimeModel, existingProfile)) {
          // Model has been updated
          try {
            const updatedProfile = await this.updateProfileFromRuntime(existingProfile, runtimeModel)
            result.updated.push(updatedProfile)
            await this.saveProfile(updatedProfile)
          } catch (error) {
            result.errors.push(`Failed to update profile for ${runtimeModel.name}: ${error}`)
          }
        }
      }

      // Find removed models
      for (const profile of existingProfiles) {
        if (!runtimeMap.has(profile.runtimeModelName)) {
          result.removed.push(profile.id)
          await this.removeProfile(profile.id)
        }
      }

      return result
    } catch (error) {
      throw new RuntimeError(
        RuntimeErrorCode.MODEL_LOAD_FAILED,
        `Model sync failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Get all local model profiles
   */
  async getLocalProfiles(): Promise<DBModelProfile[]> {
    try {
      return await modelProfileRepository.findActive()
    } catch (error) {
      console.error('Failed to get local profiles:', error)
      return []
    }
  }

  /**
   * Get a specific model profile by runtime name
   */
  async getProfileByRuntimeName(runtimeName: string): Promise<DBModelProfile | null> {
    try {
      return await modelProfileRepository.findByRuntimeModelName(runtimeName)
    } catch (error) {
      console.error('Failed to get profile by runtime name:', error)
      return null
    }
  }

  /**
   * Save a model profile
   */
  async saveProfile(profile: DBModelProfile): Promise<void> {
    try {
      await modelProfileRepository.update(profile.id, {
        displayName: profile.displayName || undefined,
        role: profile.role,
        maxSafeContext: profile.maxSafeContext,
        structuredOutputReliability: profile.structuredOutputReliability,
        toolCallingReliability: profile.toolCallingReliability,
        performanceScore: profile.performanceScore,
        costPerToken: profile.costPerToken,
        isActive: profile.isActive,
        metadata: profile.metadata ? JSON.parse(profile.metadata) : undefined,
      })
    } catch (error) {
      console.error('Failed to save profile:', error)
      throw error
    }
  }

  /**
   * Remove a model profile
   */
  async removeProfile(id: string): Promise<void> {
    try {
      await modelProfileRepository.delete(id)
    } catch (error) {
      console.error('Failed to remove profile:', error)
      throw error
    }
  }

  /**
   * Create a profile from runtime model information
   */
  private async createProfileFromRuntime(runtimeModel: RuntimeModel): Promise<DBModelProfile> {
    const role = this.inferRole(runtimeModel)
    const capabilities = this.inferCapabilities(runtimeModel)

    // Create the profile using the repository
    return await modelProfileRepository.create({
      runtimeModelName: runtimeModel.name,
      role,
      maxSafeContext: capabilities.maxContextLength,
      structuredOutputReliability: capabilities.supportsJsonFormat ? 0.8 : 0.3,
      toolCallingReliability: capabilities.supportsToolCalling ? 0.7 : 0.1,
      displayName: this.createDisplayName(runtimeModel),
      description: this.createDescription(runtimeModel),
      performanceScore: 0.5, // Default score
      metadata: {
        family: runtimeModel.details?.family,
        parameterSize: runtimeModel.details?.parameter_size,
        quantizationLevel: runtimeModel.details?.quantization_level,
        format: runtimeModel.details?.format,
        size: runtimeModel.size,
        contextLength: runtimeModel.details?.num_ctx || 2048,
        modifiedAt: runtimeModel.modified_at,
        digest: runtimeModel.digest,
        capabilities,
      },
    })
  }

  /**
   * Update an existing profile with runtime model information
   */
  private async updateProfileFromRuntime(
    profile: DBModelProfile,
    runtimeModel: RuntimeModel
  ): Promise<DBModelProfile> {
    const role = this.inferRole(runtimeModel)
    const capabilities = this.inferCapabilities(runtimeModel)

    return await modelProfileRepository.update(profile.id, {
      displayName: this.createDisplayName(runtimeModel),
      description: this.createDescription(runtimeModel),
      role,
      maxSafeContext: capabilities.maxContextLength,
      structuredOutputReliability: capabilities.supportsJsonFormat ? 0.8 : 0.3,
      toolCallingReliability: capabilities.supportsToolCalling ? 0.7 : 0.1,
      metadata: {
        family: runtimeModel.details?.family,
        parameterSize: runtimeModel.details?.parameter_size,
        quantizationLevel: runtimeModel.details?.quantization_level,
        format: runtimeModel.details?.format,
        size: runtimeModel.size,
        contextLength: runtimeModel.details?.num_ctx || 2048,
        modifiedAt: runtimeModel.modified_at,
        digest: runtimeModel.digest,
        capabilities,
      },
    })
  }

  /**
   * Check if a model has changed since last sync
   */
  private hasModelChanged(runtimeModel: RuntimeModel, profile: DBModelProfile): boolean {
    const profileMetadata = profile.metadata ? JSON.parse(profile.metadata) : {}
    
    return (
      runtimeModel.digest !== profileMetadata.digest ||
      runtimeModel.modified_at !== profileMetadata.modifiedAt ||
      runtimeModel.size !== profileMetadata.size
    )
  }

  /**
   * Infer model capabilities from runtime information
   */
  private inferCapabilities(runtimeModel: RuntimeModel): ModelCapabilities {
    const family = runtimeModel.details?.family?.toLowerCase() || ''
    const name = runtimeModel.name.toLowerCase()
    
    // Base capabilities
    const capabilities: ModelCapabilities = {
      supportsChat: true,
      supportsEmbeddings: false,
      supportsVision: false,
      supportsJsonFormat: true,
      supportsToolCalling: false,
      maxContextLength: runtimeModel.details?.num_ctx || 2048,
    }

    // Vision capabilities
    if (family.includes('llava') || family.includes('vision') || name.includes('vision')) {
      capabilities.supportsVision = true
    }

    // Embedding capabilities
    if (family.includes('embed') || name.includes('embed') || name.includes('sentence')) {
      capabilities.supportsEmbeddings = true
      capabilities.supportsChat = false
    }

    // Tool calling (based on model size and family)
    if (this.isLargeModel(runtimeModel) && !capabilities.supportsEmbeddings) {
      capabilities.supportsToolCalling = true
    }

    // Recommended settings based on model characteristics
    if (this.isLargeModel(runtimeModel)) {
      capabilities.preferredTemperature = 0.7
      capabilities.recommendedMaxTokens = Math.floor(capabilities.maxContextLength * 0.75)
    } else {
      capabilities.preferredTemperature = 0.8
      capabilities.recommendedMaxTokens = Math.floor(capabilities.maxContextLength * 0.8)
    }

    return capabilities
  }

  /**
   * Infer model role based on characteristics
   */
  private inferRole(runtimeModel: RuntimeModel): ModelRole {
    const family = runtimeModel.details?.family?.toLowerCase() || ''
    const name = runtimeModel.name.toLowerCase()
    
    // Specialized models
    if (family.includes('embed') || name.includes('embed') || name.includes('sentence')) {
      return 'embedding'
    }
    
    if (family.includes('codellama') || name.includes('code') || name.includes('codellama')) {
      return 'code'
    }
    
    if (family.includes('llava') || name.includes('vision')) {
      return 'vision'
    }
    
    if (name.includes('router') || name.includes('judge')) {
      return name.includes('router') ? 'router' : 'judge'
    }
    
    // Large models for reasoning
    if (this.isLargeModel(runtimeModel)) {
      return 'reasoning'
    }
    
    // Default to general purpose
    return 'general'
  }

  /**
   * Create a display name from runtime model
   */
  private createDisplayName(runtimeModel: RuntimeModel): string {
    const name = runtimeModel.name
    const details = runtimeModel.details
    
    // Extract base name and size
    let displayName = name
    
    // Add parameter size if available
    if (details?.parameter_size) {
      displayName += ` (${details.parameter_size})`
    }
    
    // Add quantization level if not default
    if (details?.quantization_level && details.quantization_level !== 'q4_0') {
      displayName += ` ${details.quantization_level}`
    }
    
    return displayName
  }

  /**
   * Create a description for the model
   */
  private createDescription(runtimeModel: RuntimeModel): string {
    const family = runtimeModel.details?.family || 'Unknown'
    const parameterSize = runtimeModel.details?.parameter_size || 'Unknown'
    
    return `${family} model with ${parameterSize} parameters`
  }

  /**
   * Check if this is a large model
   */
  private isLargeModel(runtimeModel: RuntimeModel): boolean {
    const parameterSize = runtimeModel.details?.parameter_size?.toLowerCase() || ''
    const name = runtimeModel.name.toLowerCase()
    
    return (
      parameterSize.includes('70b') ||
      parameterSize.includes('65b') ||
      parameterSize.includes('34b') ||
      parameterSize.includes('33b') ||
      name.includes('70b') ||
      name.includes('65b') ||
      name.includes('34b') ||
      name.includes('33b')
    )
  }

  /**
   * Update model usage statistics
   */
  async updateModelUsage(runtimeModelName: string): Promise<void> {
    const profile = await this.getProfileByRuntimeName(runtimeModelName)
    
    if (profile) {
      const currentMetadata = profile.metadata ? JSON.parse(profile.metadata) : {}
      const updatedMetadata = {
        ...currentMetadata,
        lastUsedAt: new Date().toISOString(),
        usageCount: (currentMetadata.usageCount || 0) + 1,
      }
      
      await modelProfileRepository.update(profile.id, {
        metadata: updatedMetadata,
      })
    }
  }

  /**
   * Get models by role
   */
  async getModelsByRole(role: ModelRole): Promise<DBModelProfile[]> {
    try {
      return await modelProfileRepository.findByRole(role)
    } catch (error) {
      console.error('Failed to get models by role:', error)
      return []
    }
  }

  /**
   * Get models by capability
   */
  async getModelsByCapability(capability: keyof ModelCapabilities): Promise<DBModelProfile[]> {
    try {
      const profiles = await modelProfileRepository.findActive()
      return profiles.filter(p => {
        const metadata = p.metadata ? JSON.parse(p.metadata) : {}
        const capabilities = metadata.capabilities as ModelCapabilities
        return capabilities?.[capability] === true
      })
    } catch (error) {
      console.error('Failed to get models by capability:', error)
      return []
    }
  }

  /**
   * Search models by query
   */
  async searchModels(query: string): Promise<DBModelProfile[]> {
    try {
      const result = await modelProfileRepository.findMany({ search: query })
      return result.profiles
    } catch (error) {
      console.error('Failed to search models:', error)
      return []
    }
  }
}

// Singleton instance
let modelSyncService: ModelSyncService | null = null

export function getModelSyncService(): ModelSyncService {
  if (!modelSyncService) {
    modelSyncService = new ModelSyncService()
  }
  return modelSyncService
}
