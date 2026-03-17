/**
 * Settings Repository
 * 
 * Repository helpers for application settings management.
 * Provides typed CRUD operations with validation and caching.
 */

import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { settings } from '@/lib/db/schema'
import type { Setting, NewSetting } from '@/lib/db/schema'

export class SettingsRepository {
  private cache = new Map<string, Setting>()
  private cacheTimeout = 5 * 60 * 1000 // 5 minutes
  private lastCacheClear = 0

  /**
   * Get a setting by key with type safety
   */
  async get<T = any>(key: string): Promise<T | null> {
    // Check cache first
    this.clearCacheIfNeeded()
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.updatedAt < this.cacheTimeout) {
      return this.parseValue<T>(cached.value, cached.type)
    }

    const database = await db
    const [setting] = await database
      .select()
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)

    if (setting) {
      this.cache.set(key, setting)
      return this.parseValue<T>(setting.value, setting.type)
    }

    return null
  }

  /**
   * Get a setting with default value
   */
  async getWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get<T>(key)
    return value !== null ? value : defaultValue
  }

  /**
   * Get multiple settings by category
   */
  async getByCategory(category: string): Promise<Setting[]> {
    const database = await db
    return await database
      .select()
      .from(settings)
      .where(eq(settings.category, category))
      .orderBy(settings.key)
  }

  /**
   * Get all public settings (user-visible)
   */
  async getPublic(): Promise<Setting[]> {
    const database = await db
    return await database
      .select()
      .from(settings)
      .where(eq(settings.isPublic, true))
      .orderBy(settings.category, settings.key)
  }

  /**
   * Set a setting value with type inference
   */
  async set<T>(key: string, value: T, options: {
    category?: string
    description?: string
    isPublic?: boolean
    metadata?: any
  } = {}): Promise<Setting> {
    const { category = 'general', description, isPublic = false, metadata } = options
    const type = this.getValueType(value)
    const stringValue = this.stringifyValue(value)

    const database = await db
    const [setting] = await database
      .insert(settings)
      .values({
        key,
        value: stringValue,
        type,
        category,
        description,
        isPublic,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: stringValue,
          type,
          category,
          description,
          isPublic,
          metadata: metadata ? JSON.stringify(metadata) : null,
          updatedAt: new Date()
        }
      })
      .returning()

    // Update cache
    this.cache.set(key, setting)
    return setting
  }

  /**
   * Set multiple settings in a transaction
   */
  async setMany(settingsData: Array<{
    key: string
    value: any
    category?: string
    description?: string
    isPublic?: boolean
    metadata?: any
  }>): Promise<Setting[]> {
    const results: Setting[] = []

    for (const settingData of settingsData) {
      const setting = await this.set(
        settingData.key,
        settingData.value,
        settingData
      )
      results.push(setting)
    }

    return results
  }

  /**
   * Delete a setting
   */
  async delete(key: string): Promise<boolean> {
    const database = await db
    const result = await database
      .delete(settings)
      .where(eq(settings.key, key))

    if (result.changes > 0) {
      this.cache.delete(key)
      return true
    }

    return false
  }

  /**
   * Check if a setting exists
   */
  async exists(key: string): Promise<boolean> {
    const database = await db
    const [setting] = await database
      .select({ key: settings.key })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)

    return !!setting
  }

  /**
   * Get all settings (for backup/restore)
   */
  async getAll(): Promise<Setting[]> {
    const database = await db
    return await database
      .select()
      .from(settings)
      .orderBy(settings.category, settings.key)
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear()
    this.lastCacheClear = Date.now()
  }

  /**
   * Initialize default settings
   */
  async initializeDefaults(): Promise<void> {
    const defaults: Array<{
      key: string
      value: any
      category: string
      description: string
      isPublic: boolean
    }> = [
      // UI Settings
      {
        key: 'ui.theme',
        value: 'system',
        category: 'ui',
        description: 'UI theme preference',
        isPublic: true
      },
      {
        key: 'ui.language',
        value: 'en',
        category: 'ui',
        description: 'Interface language',
        isPublic: true
      },
      {
        key: 'ui.sidebar_collapsed',
        value: false,
        category: 'ui',
        description: 'Sidebar collapsed state',
        isPublic: true
      },
      {
        key: 'ui.panel_layout',
        value: { activePanel: 'chat', splitSizes: [40, 60] },
        category: 'ui',
        description: 'Panel layout configuration',
        isPublic: true
      },

      // Runtime Settings
      {
        key: 'runtime.default_model',
        value: 'llama3.1:8b',
        category: 'runtime',
        description: 'Default chat model',
        isPublic: true
      },
      {
        key: 'runtime.timeout_ms',
        value: 30000,
        category: 'runtime',
        description: 'Request timeout in milliseconds',
        isPublic: false
      },
      {
        key: 'runtime.max_tokens',
        value: 4096,
        category: 'runtime',
        description: 'Maximum response tokens',
        isPublic: true
      },
      {
        key: 'runtime.temperature',
        value: 0.7,
        category: 'runtime',
        description: 'Default generation temperature',
        isPublic: true
      },

      // Security Settings
      {
        key: 'security.require_auth',
        value: false,
        category: 'security',
        description: 'Require authentication for access',
        isPublic: false
      },
      {
        key: 'security.session_timeout',
        value: 24 * 60 * 60 * 1000, // 24 hours
        category: 'security',
        description: 'Session timeout in milliseconds',
        isPublic: false
      },

      // Feature Settings
      {
        key: 'features.rag_enabled',
        value: true,
        category: 'features',
        description: 'Enable RAG functionality',
        isPublic: true
      },
      {
        key: 'features.agents_enabled',
        value: false,
        category: 'features',
        description: 'Enable AI agents',
        isPublic: true
      },
      {
        key: 'features.monitoring_enabled',
        value: true,
        category: 'features',
        description: 'Enable system monitoring',
        isPublic: true
      },

      // System Settings
      {
        key: 'system.auto_backup',
        value: true,
        category: 'system',
        description: 'Enable automatic backups',
        isPublic: false
      },
      {
        key: 'system.backup_interval',
        value: 24 * 60 * 60 * 1000, // 24 hours
        category: 'system',
        description: 'Backup interval in milliseconds',
        isPublic: false
      },
      {
        key: 'system.max_conversation_age',
        value: 30 * 24 * 60 * 60 * 1000, // 30 days
        category: 'system',
        description: 'Maximum conversation age before cleanup',
        isPublic: false
      }
    ]

    for (const setting of defaults) {
      if (!(await this.exists(setting.key))) {
        await this.set(setting.key, setting.value, {
          category: setting.category,
          description: setting.description,
          isPublic: setting.isPublic
        })
      }
    }
  }

  /**
   * Validate setting value against type
   */
  private parseValue<T>(value: string, type: string): T {
    try {
      switch (type) {
        case 'string':
          return value as T
        case 'number':
          return Number(value) as T
        case 'boolean':
          return (value === 'true') as T
        case 'object':
        case 'array':
          return JSON.parse(value) as T
        default:
          return value as T
      }
    } catch (error) {
      console.warn(`Failed to parse setting value: ${value} as ${type}`, error)
      return value as T
    }
  }

  /**
   * Convert value to string for storage
   */
  private stringifyValue(value: any): string {
    if (typeof value === 'string') {
      return value
    }
    return JSON.stringify(value)
  }

  /**
   * Determine value type for storage
   */
  private getValueType(value: any): string {
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object' && value !== null) return 'object'
    return typeof value
  }

  /**
   * Clear cache if needed
   */
  private clearCacheIfNeeded(): void {
    if (Date.now() - this.lastCacheClear > this.cacheTimeout) {
      this.clearCache()
    }
  }
}

// Export singleton instance
export const settingsRepository = new SettingsRepository()
