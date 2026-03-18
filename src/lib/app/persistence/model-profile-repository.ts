/**
 * Model Profile Repository
 * 
 * Handles persistence and management of model profiles with proper
 * CRUD operations, validation, and relationship management.
 */

import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/client'
import { modelProfiles, ModelProfile, NewModelProfile } from '../db/schema'
import { RuntimeError, RuntimeErrorErrorCode } from '../runtime/errors'

export interface ModelProfileCreateInput {
  runtimeModelName: string
  role: ModelRole
  maxSafeContext: number
  structuredOutputReliability: number
  toolCallingReliability: number
  displayName?: string
  description?: string
  performanceScore?: number
  costPerToken?: number
  metadata?: Record<string, unknown>
}

export interface ModelProfileUpdateInput {
  displayName?: string
  description?: string
  role?: ModelRole
  maxSafeContext?: number
  structuredOutputReliability?: number
  toolCallingReliability?: number
  performanceScore?: number
  costPerToken?: number
  isActive?: boolean
  metadata?: Record<string, unknown>
}

export type ModelRole = 
  | 'general'
  | 'code'
  | 'reasoning'
  | 'vision'
  | 'embedding'
  | 'router'
  | 'judge'

/**
 * Repository class for model profile operations
 */
export class ModelProfileRepository {
  /**
   * Create a new model profile
   */
  async create(input: ModelProfileCreateInput): Promise<ModelProfile> {
    try {
      // Check if profile already exists for this runtime model
      const existing = await this.findByRuntimeModelName(input.runtimeModelName)
      if (existing) {
        throw new RuntimeError(
          'model_profile_already_exists',
          `Model profile already exists for ${input.runtimeModelName}`
        )
      }

      // Validate reliability scores are between 0 and 1
      if (input.structuredOutputReliability < 0 || input.structuredOutputReliability > 1) {
        throw new RuntimeError(
          'invalid_reliability_score',
          'Structured output reliability must be between 0 and 1'
        )
      }
      if (input.toolCallingReliability < 0 || input.toolCallingReliability > 1) {
        throw new RuntimeError(
          'invalid_reliability_score',
          'Tool calling reliability must be between 0 and 1'
        )
      }

      const profileData: NewModelProfile = {
        id: `mp_${crypto.randomUUID()}`,
        runtimeModelName: input.runtimeModelName,
        role: input.role,
        maxSafeContext: input.maxSafeContext,
        structuredOutputReliability: input.structuredOutputReliability,
        toolCallingReliability: input.toolCallingReliability,
        performanceScore: input.performanceScore ?? 0.5,
        costPerToken: input.costPerToken,
        isActive: true,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const [profile] = await db.insert(modelProfiles).values(profileData).returning()
      return profile
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      throw new RuntimeError(
        'model_profile_create_failed',
        `Failed to create model profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get model profile by ID
   */
  async findById(id: string): Promise<ModelProfile | null> {
    try {
      const [profile] = await db
        .select()
        .from(modelProfiles)
        .where(eq(modelProfiles.id, id))
        .limit(1)
      
      return profile ?? null
    } catch (error) {
      throw new RuntimeError(
        'model_profile_find_failed',
        `Failed to find model profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get model profile by runtime model name
   */
  async findByRuntimeModelName(runtimeModelName: string): Promise<ModelProfile | null> {
    try {
      const [profile] = await db
        .select()
        .from(modelProfiles)
        .where(eq(modelProfiles.runtimeModelName, runtimeModelName))
        .limit(1)
      
      return profile ?? null
    } catch (error) {
      throw new RuntimeError(
        'model_profile_find_failed',
        `Failed to find model profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get all active model profiles
   */
  async findActive(): Promise<ModelProfile[]> {
    try {
      return await db
        .select()
        .from(modelProfiles)
        .where(eq(modelProfiles.isActive, true))
        .orderBy(desc(modelProfiles.performanceScore))
    } catch (error) {
      throw new RuntimeError(
        'model_profile_find_failed',
        `Failed to find active model profiles: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get model profiles by role
   */
  async findByRole(role: ModelRole): Promise<ModelProfile[]> {
    try {
      return await db
        .select()
        .from(modelProfiles)
        .where(and(eq(modelProfiles.role, role), eq(modelProfiles.isActive, true)))
        .orderBy(desc(modelProfiles.performanceScore))
    } catch (error) {
      throw new RuntimeError(
        'model_profile_find_failed',
        `Failed to find model profiles by role: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Update model profile
   */
  async update(id: string, input: ModelProfileUpdateInput): Promise<ModelProfile> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new RuntimeError(
          'model_profile_not_found',
          `Model profile not found: ${id}`
        )
      }

      // Validate reliability scores if provided
      if (input.structuredOutputReliability !== undefined && 
          (input.structuredOutputReliability < 0 || input.structuredOutputReliability > 1)) {
        throw new RuntimeError(
          'invalid_reliability_score',
          'Structured output reliability must be between 0 and 1'
        )
      }
      if (input.toolCallingReliability !== undefined && 
          (input.toolCallingReliability < 0 || input.toolCallingReliability > 1)) {
        throw new RuntimeError(
          'invalid_reliability_score',
          'Tool calling reliability must be between 0 and 1'
        )
      }

      const updateData: Partial<ModelProfile> = {
        ...input,
        updatedAt: new Date(),
      }

      // Handle metadata serialization
      if (input.metadata !== undefined) {
        updateData.metadata = input.metadata ? JSON.stringify(input.metadata) : null
      }

      const [profile] = await db
        .update(modelProfiles)
        .set(updateData)
        .where(eq(modelProfiles.id, id))
        .returning()

      return profile
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      throw new RuntimeError(
        'model_profile_update_failed',
        `Failed to update model profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete model profile (soft delete by setting isActive to false)
   */
  async delete(id: string): Promise<void> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new RuntimeError(
          'model_profile_not_found',
          `Model profile not found: ${id}`
        )
      }

      await db
        .update(modelProfiles)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(modelProfiles.id, id))
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      throw new RuntimeError(
        'model_profile_delete_failed',
        `Failed to delete model profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get model profiles with pagination and filtering
   */
  async findMany(options: {
    page?: number
    limit?: number
    role?: ModelRole
    isActive?: boolean
    search?: string
  } = {}): Promise<{
    profiles: ModelProfile[]
    total: number
    page: number
    totalPages: number
  }> {
    try {
      const { page = 1, limit = 20, role, isActive = true, search } = options
      const offset = (page - 1) * limit

      const whereConditions = []
      
      if (isActive !== undefined) {
        whereConditions.push(eq(modelProfiles.isActive, isActive))
      }
      
      if (role) {
        whereConditions.push(eq(modelProfiles.role, role))
      }

      if (search) {
        whereConditions.push(
          sql`(${modelProfiles.runtimeModelName} LIKE ${`%${search}%`} OR ${modelProfiles.displayName} LIKE ${`%${search}%`})`
        )
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

      // Get total count
      const [{ count }] = await db
        .select({ count: sql`count(*)` })
        .from(modelProfiles)
        .where(whereClause)

      // Get profiles
      const profiles = await db
        .select()
        .from(modelProfiles)
        .where(whereClause)
        .orderBy(desc(modelProfiles.performanceScore))
        .limit(limit)
        .offset(offset)

      const total = Number(count)
      const totalPages = Math.ceil(total / limit)

      return {
        profiles,
        total,
        page,
        totalPages,
      }
    } catch (error) {
      throw new RuntimeError(
        'model_profile_find_failed',
        `Failed to find model profiles: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Update performance metrics for a model profile
   */
  async updateMetrics(
    id: string, 
    metrics: {
      performanceScore?: number
      latencyMs?: number
      successRate?: number
    }
  ): Promise<ModelProfile> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new RuntimeError(
          'model_profile_not_found',
          `Model profile not found: ${id}`
        )
      }

      // Update performance score and metadata
      const currentMetadata = existing.metadata ? JSON.parse(existing.metadata) : {}
      const updatedMetadata = {
        ...currentMetadata,
        lastMetricsUpdate: new Date().toISOString(),
        ...(metrics.latencyMs && { averageLatencyMs: metrics.latencyMs }),
        ...(metrics.successRate && { successRate: metrics.successRate }),
      }

      return await this.update(id, {
        performanceScore: metrics.performanceScore,
        metadata: updatedMetadata,
      })
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      throw new RuntimeError(
        'model_profile_metrics_update_failed',
        `Failed to update model profile metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }
}

// Singleton instance
export const modelProfileRepository = new ModelProfileRepository()
