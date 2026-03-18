/**
 * Query Settings Tool
 * 
 * Low-risk tool for reading application settings and configuration.
 * Provides read-only access to system settings with proper filtering.
 */

import { z } from 'zod'
import { BuiltinTool, ToolContext, ToolCapability } from '../types'
import { getSetting } from '../../persistence/settings-repository'

/**
 * Input schema for query-settings tool
 */
export const QuerySettingsInputSchema = z.object({
  /** Setting key to retrieve (optional - if not provided, returns all public settings) */
  key: z.string().optional(),
  /** Category filter */
  category: z.enum(['ui', 'runtime', 'security', 'features']).optional(),
  /** Include private settings (requires elevated permissions) */
  includePrivate: z.boolean().default(false),
  /** Include metadata */
  includeMetadata: z.boolean().default(false)
})

/**
 * Output schema for query-settings tool
 */
export const QuerySettingsOutputSchema = z.object({
  /** Setting value(s) */
  settings: z.union([
    z.unknown(), // Single setting value
    z.record(z.unknown()) // Multiple settings
  ]),
  /** Setting metadata (if requested) */
  metadata: z.array(z.object({
    key: z.string(),
    type: z.string(),
    category: z.string(),
    description: z.string().optional(),
    isPublic: z.boolean(),
    updatedAt: z.string()
  })).optional()
})

/**
 * Query settings tool implementation
 */
export class QuerySettingsTool implements BuiltinTool {
  readonly descriptor = {
    name: 'query-settings',
    description: 'Read application settings and configuration values',
    version: '1.0.0',
    author: 'Command Center',
    capabilities: ['database-read'] as ToolCapability[],
    riskLevel: 'low' as const,
    approvalRequired: false,
    executionScope: {
      allowedPaths: [],
      deniedPaths: [],
      networkRules: {
        defaultAllow: false
      },
      resourceLimits: {
        maxExecutionTimeSec: 5,
        maxMemoryMB: 32
      },
      requiredPermissions: ['database-read'] as ToolCapability[]
    },
    inputSchema: QuerySettingsInputSchema,
    outputSchema: QuerySettingsOutputSchema,
    tags: ['settings', 'configuration', 'database'],
    metadata: {
      category: 'system',
      readOnly: true,
      safeForAutomation: true,
      dataAccess: 'database'
    }
  }

  /**
   * Execute the query-settings tool
   */
  async execute(input: unknown, context: ToolContext): Promise<unknown> {
    const parsedInput = QuerySettingsInputSchema.parse(input)

    try {
      if (parsedInput.key) {
        // Retrieve single setting
        const setting = await this.getSingleSetting(
          parsedInput.key,
          parsedInput.includePrivate
        )

        const result: any = {
          settings: setting?.value || null
        }

        if (parsedInput.includeMetadata && setting) {
          result.metadata = [this.formatSettingMetadata(setting)]
        }

        return result
      } else {
        // Retrieve multiple settings
        const settings = await this.getMultipleSettings(
          parsedInput.category,
          parsedInput.includePrivate
        )

        const result: any = {
          settings: settings.reduce((acc, setting) => {
            acc[setting.key] = setting.value
            return acc
          }, {} as Record<string, unknown>)
        }

        if (parsedInput.includeMetadata) {
          result.metadata = settings.map(setting => this.formatSettingMetadata(setting))
        }

        return result
      }

    } catch (error) {
      throw new Error(`Failed to query settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate input (optional method)
   */
  validate?(input: unknown): { valid: boolean; errors: string[] } {
    try {
      QuerySettingsInputSchema.parse(input)
      return { valid: true, errors: [] }
    } catch (error) {
      return {
        valid: false,
        errors: error instanceof Error ? [error.message] : ['Unknown validation error']
      }
    }
  }

  /**
   * Get single setting
   */
  private async getSingleSetting(key: string, includePrivate: boolean): Promise<any> {
    try {
      // This would use the actual settings repository
      // For now, we'll simulate with some common settings
      const commonSettings = this.getCommonSettings()
      
      const setting = commonSettings.find(s => s.key === key)
      
      if (!setting) {
        return null
      }

      if (!setting.isPublic && !includePrivate) {
        throw new Error(`Setting '${key}' is private and requires elevated permissions`)
      }

      return setting
    } catch (error) {
      if (error instanceof Error && error.message.includes('private')) {
        throw error
      }
      return null
    }
  }

  /**
   * Get multiple settings
   */
  private async getMultipleSettings(
    category?: string,
    includePrivate: boolean = false
  ): Promise<any[]> {
    const commonSettings = this.getCommonSettings()
    
    let filtered = commonSettings
    
    // Filter by category
    if (category) {
      filtered = filtered.filter(setting => setting.category === category)
    }
    
    // Filter by visibility
    if (!includePrivate) {
      filtered = filtered.filter(setting => setting.isPublic)
    }

    return filtered
  }

  /**
   * Get common settings (simulated - would come from database)
   */
  private getCommonSettings(): any[] {
    return [
      {
        key: 'ui.theme',
        value: 'dark',
        type: 'string',
        category: 'ui',
        description: 'UI theme preference',
        isPublic: true,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'ui.language',
        value: 'en',
        type: 'string',
        category: 'ui',
        description: 'Interface language',
        isPublic: true,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'runtime.ollama_url',
        value: 'http://127.0.0.1:11434',
        type: 'string',
        category: 'runtime',
        description: 'Ollama server URL',
        isPublic: true,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'runtime.default_model',
        value: 'llama3.1:8b',
        type: 'string',
        category: 'runtime',
        description: 'Default AI model',
        isPublic: true,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'security.approval_required',
        value: true,
        type: 'boolean',
        category: 'security',
        description: 'Require approval for high-risk tools',
        isPublic: true,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'security.session_timeout',
        value: 3600,
        type: 'number',
        category: 'security',
        description: 'Session timeout in seconds',
        isPublic: true,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'features.rag_enabled',
        value: true,
        type: 'boolean',
        category: 'features',
        description: 'Enable RAG functionality',
        isPublic: true,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'features.agent_mode',
        value: false,
        type: 'boolean',
        category: 'features',
        description: 'Enable agent mode',
        isPublic: true,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'security.api_key',
        value: 'secret-key-hidden',
        type: 'string',
        category: 'security',
        description: 'API key for external services',
        isPublic: false,
        updatedAt: new Date().toISOString()
      },
      {
        key: 'runtime.database_password',
        value: 'password-hidden',
        type: 'string',
        category: 'runtime',
        description: 'Database connection password',
        isPublic: false,
        updatedAt: new Date().toISOString()
      }
    ]
  }

  /**
   * Format setting metadata
   */
  private formatSettingMetadata(setting: any): any {
    return {
      key: setting.key,
      type: setting.type,
      category: setting.category,
      description: setting.description,
      isPublic: setting.isPublic,
      updatedAt: setting.updatedAt
    }
  }
}

/**
 * Factory function for creating query-settings tool
 */
export function createQuerySettingsTool(): QuerySettingsTool {
  return new QuerySettingsTool()
}
