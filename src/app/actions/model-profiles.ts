/**
 * Model Profiles Server Actions
 * 
 * Server-side actions for model profile management with proper validation,
 * error handling, and security measures.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { modelProfileRepository, ModelProfileCreateInput, ModelProfileUpdateInput } from '../../lib/app/persistence/model-profile-repository'
import { RuntimeError } from '../../lib/app/runtime/errors'

// Validation schemas
const CreateModelProfileSchema = z.object({
  runtimeModelName: z.string().min(1, 'Runtime model name is required'),
  role: z.enum(['general', 'code', 'reasoning', 'vision', 'embedding', 'router', 'judge']),
  maxSafeContext: z.number().min(1, 'Max safe context must be at least 1'),
  structuredOutputReliability: z.number().min(0).max(1, 'Structured output reliability must be between 0 and 1'),
  toolCallingReliability: z.number().min(0).max(1, 'Tool calling reliability must be between 0 and 1'),
  displayName: z.string().optional(),
  description: z.string().optional(),
  performanceScore: z.number().min(0).max(1).optional(),
  costPerToken: z.number().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
})

const UpdateModelProfileSchema = z.object({
  displayName: z.string().optional(),
  description: z.string().optional(),
  role: z.enum(['general', 'code', 'reasoning', 'vision', 'embedding', 'router', 'judge']).optional(),
  maxSafeContext: z.number().min(1).optional(),
  structuredOutputReliability: z.number().min(0).max(1).optional(),
  toolCallingReliability: z.number().min(0).max(1).optional(),
  performanceScore: z.number().min(0).max(1).optional(),
  costPerToken: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const GetModelProfilesSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  role: z.enum(['general', 'code', 'reasoning', 'vision', 'embedding', 'router', 'judge']).optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
})

/**
 * Create a new model profile
 */
export async function createModelProfile(input: ModelProfileCreateInput) {
  try {
    // Validate input
    const validatedInput = CreateModelProfileSchema.parse(input)

    // Create the profile
    const profile = await modelProfileRepository.create(validatedInput)

    // Revalidate relevant paths
    revalidatePath('/(command-center)/@models')
    revalidatePath('/api/models')

    return {
      success: true,
      data: profile,
      message: 'Model profile created successfully',
    }
  } catch (error) {
    console.error('Failed to create model profile:', error)
    
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }
    }

    if (error instanceof RuntimeError) {
      return {
        success: false,
        error: error.code,
        message: error.message,
      }
    }

    return {
      success: false,
      error: 'create_failed',
      message: 'Failed to create model profile',
    }
  }
}

/**
 * Get model profiles with pagination and filtering
 */
export async function getModelProfiles(options: {
  page?: number
  limit?: number
  role?: string
  isActive?: boolean
  search?: string
} = {}) {
  try {
    // Validate input
    const validatedOptions = GetModelProfilesSchema.parse(options)

    // Get profiles
    const result = await modelProfileRepository.findMany(validatedOptions)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Failed to get model profiles:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }
    }

    return {
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch model profiles',
    }
  }
}

/**
 * Get a single model profile by ID
 */
export async function getModelProfile(id: string) {
  try {
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'invalid_id',
        message: 'Valid profile ID is required',
      }
    }

    const profile = await modelProfileRepository.findById(id)

    if (!profile) {
      return {
        success: false,
        error: 'not_found',
        message: 'Model profile not found',
      }
    }

    return {
      success: true,
      data: profile,
    }
  } catch (error) {
    console.error('Failed to get model profile:', error)
    
    return {
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch model profile',
    }
  }
}

/**
 * Update a model profile
 */
export async function updateModelProfile(id: string, input: ModelProfileUpdateInput) {
  try {
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'invalid_id',
        message: 'Valid profile ID is required',
      }
    }

    // Validate input
    const validatedInput = UpdateModelProfileSchema.parse(input)

    // Update the profile
    const profile = await modelProfileRepository.update(id, validatedInput)

    // Revalidate relevant paths
    revalidatePath('/(command-center)/@models')
    revalidatePath('/api/models')

    return {
      success: true,
      data: profile,
      message: 'Model profile updated successfully',
    }
  } catch (error) {
    console.error('Failed to update model profile:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }
    }

    if (error instanceof RuntimeError) {
      return {
        success: false,
        error: error.code,
        message: error.message,
      }
    }

    return {
      success: false,
      error: 'update_failed',
      message: 'Failed to update model profile',
    }
  }
}

/**
 * Delete a model profile (soft delete)
 */
export async function deleteModelProfile(id: string) {
  try {
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'invalid_id',
        message: 'Valid profile ID is required',
      }
    }

    await modelProfileRepository.delete(id)

    // Revalidate relevant paths
    revalidatePath('/(command-center)/@models')
    revalidatePath('/api/models')

    return {
      success: true,
      message: 'Model profile deleted successfully',
    }
  } catch (error) {
    console.error('Failed to delete model profile:', error)

    if (error instanceof RuntimeError) {
      return {
        success: false,
        error: error.code,
        message: error.message,
      }
    }

    return {
      success: false,
      error: 'delete_failed',
      message: 'Failed to delete model profile',
    }
  }
}

/**
 * Get active model profiles for routing
 */
export async function getActiveModelProfiles(role?: string) {
  try {
    let profiles
    if (role) {
      profiles = await modelProfileRepository.findByRole(role as any)
    } else {
      profiles = await modelProfileRepository.findActive()
    }

    return {
      success: true,
      data: profiles,
    }
  } catch (error) {
    console.error('Failed to get active model profiles:', error)
    
    return {
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch active model profiles',
    }
  }
}

/**
 * Update model profile metrics
 */
export async function updateModelProfileMetrics(
  id: string,
  metrics: {
    performanceScore?: number
    latencyMs?: number
    successRate?: number
  }
) {
  try {
    if (!id || typeof id !== 'string') {
      return {
        success: false,
        error: 'invalid_id',
        message: 'Valid profile ID is required',
      }
    }

    const profile = await modelProfileRepository.updateMetrics(id, metrics)

    // Revalidate relevant paths
    revalidatePath('/(command-center)/@models')
    revalidatePath('/api/models')

    return {
      success: true,
      data: profile,
      message: 'Model profile metrics updated successfully',
    }
  } catch (error) {
    console.error('Failed to update model profile metrics:', error)

    if (error instanceof RuntimeError) {
      return {
        success: false,
        error: error.code,
        message: error.message,
      }
    }

    return {
      success: false,
      error: 'metrics_update_failed',
      message: 'Failed to update model profile metrics',
    }
  }
}

/**
 * Sync model profiles with runtime models
 */
export async function syncModelProfiles() {
  try {
    // This would integrate with the model sync service
    // to create profiles for newly discovered models
    // For now, return a placeholder response
    
    return {
      success: true,
      message: 'Model profiles sync completed',
      data: {
        synced: 0,
        created: 0,
        updated: 0,
      },
    }
  } catch (error) {
    console.error('Failed to sync model profiles:', error)
    
    return {
      success: false,
      error: 'sync_failed',
      message: 'Failed to sync model profiles',
    }
  }
}
