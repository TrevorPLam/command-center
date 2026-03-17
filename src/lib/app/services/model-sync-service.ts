/**
 * Model Sync Service
 * 
 * Handles synchronization of model inventory between the runtime and local storage.
 * Provides model metadata enrichment, change detection, and persistence.
 */

import { RuntimeModel, RuntimeModelState } from '../runtime/types'
import { RuntimeError, RuntimeErrorCode } from '../runtime/errors'
import { getRuntimeService } from './runtime-service'

export interface ModelProfile {
  id: string
  runtimeModelName: string
  displayName: string
  description?: string | undefined
  tags: string[]
  role: ModelRole
  capabilities: ModelCapabilities
  metadata: ModelMetadata
  pulledAt: string
  lastUsedAt?: string | undefined
  usageCount: number
  enabled: boolean
}

export type ModelRole = 
  | 'general'
  | 'code'
  | 'reasoning'
  | 'vision'
  | 'embedding'
  | 'router'
  | 'judge'

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

export interface ModelMetadata {
  family?: string | undefined
  parameterSize?: string | undefined
  quantizationLevel?: string | undefined
  format?: string | undefined
  size: number
  contextLength: number
  modifiedAt: string
  digest: string
}

export interface SyncResult {
  added: ModelProfile[]
  updated: ModelProfile[]
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
  async getLocalProfiles(): Promise<ModelProfile[]> {
    // In a real implementation, this would query the database
    // For now, return empty array
    return []
  }

  /**
   * Get a specific model profile by runtime name
   */
  async getProfileByRuntimeName(runtimeName: string): Promise<ModelProfile | null> {
    const profiles = await this.getLocalProfiles()
    return profiles.find(p => p.runtimeModelName === runtimeName) || null
  }

  /**
   * Save a model profile
   */
  async saveProfile(profile: ModelProfile): Promise<void> {
    // In a real implementation, this would save to the database
    console.log('Saving profile:', profile.id)
  }

  /**
   * Remove a model profile
   */
  async removeProfile(id: string): Promise<void> {
    // In a real implementation, this would delete from the database
    console.log('Removing profile:', id)
  }

  /**
   * Create a profile from runtime model information
   */
  private async createProfileFromRuntime(runtimeModel: RuntimeModel): Promise<ModelProfile> {
    const capabilities = this.inferCapabilities(runtimeModel)
    const role = this.inferRole(runtimeModel, capabilities)
    const metadata = this.extractMetadata(runtimeModel)

    return {
      id: `model-${Date.now()}-${runtimeModel.name.replace(/[^a-zA-Z0-9]/g, '-')}`,
      runtimeModelName: runtimeModel.name,
      displayName: this.createDisplayName(runtimeModel),
      description: this.createDescription(runtimeModel),
      tags: this.createTags(runtimeModel, role, capabilities),
      role,
      capabilities,
      metadata,
      pulledAt: new Date().toISOString(),
      usageCount: 0,
      enabled: true
    }
  }

  /**
   * Update an existing profile with runtime model information
   */
  private async updateProfileFromRuntime(
    profile: ModelProfile,
    runtimeModel: RuntimeModel
  ): Promise<ModelProfile> {
    const capabilities = this.inferCapabilities(runtimeModel)
    const role = this.inferRole(runtimeModel, capabilities)
    const metadata = this.extractMetadata(runtimeModel)

    return {
      ...profile,
      displayName: this.createDisplayName(runtimeModel),
      description: this.createDescription(runtimeModel),
      tags: this.createTags(runtimeModel, role, capabilities),
      role,
      capabilities,
      metadata,
      // Preserve usage-related fields
      pulledAt: profile.pulledAt,
      lastUsedAt: profile.lastUsedAt,
      usageCount: profile.usageCount,
      enabled: profile.enabled
    }
  }

  /**
   * Check if a model has changed since last sync
   */
  private hasModelChanged(runtimeModel: RuntimeModel, profile: ModelProfile): boolean {
    const metadata = this.extractMetadata(runtimeModel)
    
    return (
      metadata.digest !== profile.metadata.digest ||
      metadata.modifiedAt !== profile.metadata.modifiedAt ||
      metadata.size !== profile.metadata.size
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
  private inferRole(runtimeModel: RuntimeModel, capabilities: ModelCapabilities): ModelRole {
    const family = runtimeModel.details?.family?.toLowerCase() || ''
    const name = runtimeModel.name.toLowerCase()
    
    // Specialized models
    if (capabilities.supportsEmbeddings) {
      return 'embedding'
    }
    
    if (family.includes('codellama') || name.includes('code') || name.includes('codellama')) {
      return 'code'
    }
    
    if (family.includes('llava') || capabilities.supportsVision) {
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
   * Extract metadata from runtime model
   */
  private extractMetadata(runtimeModel: RuntimeModel): ModelMetadata {
    return {
      family: runtimeModel.details?.family,
      parameterSize: runtimeModel.details?.parameter_size,
      quantizationLevel: runtimeModel.details?.quantization_level,
      format: runtimeModel.details?.format,
      size: runtimeModel.size,
      contextLength: runtimeModel.details?.num_ctx || 2048,
      modifiedAt: runtimeModel.modified_at,
      digest: runtimeModel.digest
    }
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
   * Create tags for the model
   */
  private createTags(
    runtimeModel: RuntimeModel,
    role: ModelRole,
    capabilities: ModelCapabilities
  ): string[] {
    const tags: string[] = [role]
    
    const family = runtimeModel.details?.family?.toLowerCase() || ''
    
    // Family tags
    if (family.includes('llama')) tags.push('llama')
    if (family.includes('qwen')) tags.push('qwen')
    if (family.includes('mixtral')) tags.push('mixtral')
    if (family.includes('mistral')) tags.push('mistral')
    
    // Capability tags
    if (capabilities.supportsVision) tags.push('vision')
    if (capabilities.supportsEmbeddings) tags.push('embeddings')
    if (capabilities.supportsToolCalling) tags.push('tools')
    
    // Size tags
    const parameterSize = runtimeModel.details?.parameter_size?.toLowerCase() || ''
    if (parameterSize.includes('70b') || parameterSize.includes('65b')) tags.push('large')
    if (parameterSize.includes('34b') || parameterSize.includes('33b')) tags.push('medium-large')
    if (parameterSize.includes('13b') || parameterSize.includes('12b')) tags.push('medium')
    if (parameterSize.includes('8b') || parameterSize.includes('7b')) tags.push('small')
    
    return tags
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
      profile.usageCount++
      profile.lastUsedAt = new Date().toISOString()
      await this.saveProfile(profile)
    }
  }

  /**
   * Get models by role
   */
  async getModelsByRole(role: ModelRole): Promise<ModelProfile[]> {
    const profiles = await this.getLocalProfiles()
    return profiles.filter(p => p.role === role && p.enabled)
  }

  /**
   * Get models by capability
   */
  async getModelsByCapability(capability: keyof ModelCapabilities): Promise<ModelProfile[]> {
    const profiles = await this.getLocalProfiles()
    return profiles.filter(p => p.enabled && p.capabilities[capability])
  }

  /**
   * Search models by query
   */
  async searchModels(query: string): Promise<ModelProfile[]> {
    const profiles = await this.getLocalProfiles()
    const lowercaseQuery = query.toLowerCase()
    
    return profiles.filter(p => 
      p.enabled && (
        p.displayName.toLowerCase().includes(lowercaseQuery) ||
        p.description?.toLowerCase().includes(lowercaseQuery) ||
        p.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
        p.runtimeModelName.toLowerCase().includes(lowercaseQuery)
      )
    )
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
