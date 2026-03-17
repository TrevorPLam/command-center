/**
 * Settings Server Actions
 * 
 * Server actions for managing application settings with proper validation
 * and error handling. These actions are called from client components.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { settingsRepository } from '@/lib/app/persistence/settings-repository'

// Validation schemas
const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.any(),
  category: z.string().optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional()
})

const batchUpdateSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1),
    value: z.any(),
    category: z.string().optional(),
    description: z.string().optional(),
    isPublic: z.boolean().optional()
  }))
})

/**
 * Get a setting value
 */
export async function getSetting(key: string) {
  try {
    return await settingsRepository.get(key)
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error)
    return null
  }
}

/**
 * Get a setting with default value
 */
export async function getSettingWithDefault<T>(key: string, defaultValue: T) {
  try {
    return await settingsRepository.getWithDefault(key, defaultValue)
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error)
    return defaultValue
  }
}

/**
 * Get all public settings for UI display
 */
export async function getPublicSettings() {
  try {
    return await settingsRepository.getPublic()
  } catch (error) {
    console.error('Failed to get public settings:', error)
    return []
  }
}

/**
 * Get settings by category
 */
export async function getSettingsByCategory(category: string) {
  try {
    return await settingsRepository.getByCategory(category)
  } catch (error) {
    console.error(`Failed to get settings for category ${category}:`, error)
    return []
  }
}

/**
 * Update a single setting
 */
export async function updateSetting(data: z.infer<typeof updateSettingSchema>) {
  try {
    const validated = updateSettingSchema.parse(data)
    const setting = await settingsRepository.set(
      validated.key,
      validated.value,
      {
        category: validated.category,
        description: validated.description,
        isPublic: validated.isPublic
      }
    )

    // Revalidate relevant paths
    revalidatePath('/settings')
    revalidatePath('/')

    return { success: true, setting }
  } catch (error) {
    console.error(`Failed to update setting ${data.key}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Update multiple settings in a transaction
 */
export async function updateSettings(data: z.infer<typeof batchUpdateSchema>) {
  try {
    const validated = batchUpdateSchema.parse(data)
    const settings = await settingsRepository.setMany(validated.settings)

    // Revalidate relevant paths
    revalidatePath('/settings')
    revalidatePath('/')

    return { success: true, settings }
  } catch (error) {
    console.error('Failed to update settings:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Delete a setting
 */
export async function deleteSetting(key: string) {
  try {
    const deleted = await settingsRepository.delete(key)
    
    if (deleted) {
      // Revalidate relevant paths
      revalidatePath('/settings')
      revalidatePath('/')
    }

    return { success: deleted }
  } catch (error) {
    console.error(`Failed to delete setting ${key}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Initialize default settings
 */
export async function initializeSettings() {
  try {
    await settingsRepository.initializeDefaults()
    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Failed to initialize settings:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Reset settings to defaults for a category
 */
export async function resetCategory(category: string) {
  try {
    // Get current settings in category
    const currentSettings = await settingsRepository.getByCategory(category)
    
    // Delete current settings
    for (const setting of currentSettings) {
      await settingsRepository.delete(setting.key)
    }

    // Re-initialize defaults (this will recreate the deleted defaults)
    await settingsRepository.initializeDefaults()

    // Revalidate relevant paths
    revalidatePath('/settings')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error(`Failed to reset category ${category}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Export all settings (for backup)
 */
export async function exportSettings() {
  try {
    const allSettings = await settingsRepository.getAll()
    
    return { 
      success: true, 
      settings: allSettings,
      exportedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Failed to export settings:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Import settings (for restore)
 */
export async function importSettings(settingsData: any[]) {
  try {
    // Validate settings data
    const validatedSettings = batchUpdateSchema.parse({
      settings: settingsData
    })

    // Import settings
    const settings = await settingsRepository.setMany(validatedSettings.settings)

    // Revalidate relevant paths
    revalidatePath('/settings')
    revalidatePath('/')

    return { 
      success: true, 
      settings,
      importedAt: new Date().toISOString()
    }
  } catch (error) {
    console.error('Failed to import settings:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Validate setting value against type
 */
export async function validateSettingValue(key: string, value: any, type: string) {
  try {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return !isNaN(Number(value))
      case 'boolean':
        return typeof value === 'boolean' || value === 'true' || value === 'false'
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
      case 'array':
        return Array.isArray(value)
      default:
        return true
    }
  } catch (error) {
    return false
  }
}

/**
 * Get setting metadata (for UI form generation)
 */
export async function getSettingMetadata() {
  try {
    const settings = await settingsRepository.getPublic()
    
    return settings.map(setting => ({
      key: setting.key,
      type: setting.type,
      category: setting.category,
      description: setting.description,
      value: setting.value,
      metadata: setting.metadata ? JSON.parse(setting.metadata) : {}
    }))
  } catch (error) {
    console.error('Failed to get setting metadata:', error)
    return []
  }
}
