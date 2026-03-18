/**
 * List Models Tool
 * 
 * Low-risk tool for listing available AI models from the runtime.
 * Provides read-only access to model inventory information.
 */

import { z } from 'zod'
import { BuiltinTool, ToolContext, ToolCapability } from '../types'
import { RuntimeAdapter } from '../../runtime/types'

/**
 * Input schema for list-models tool
 */
export const ListModelsInputSchema = z.object({
  /** Include only running models */
  runningOnly: z.boolean().default(false),
  /** Filter by model family */
  family: z.string().optional(),
  /** Include detailed model information */
  detailed: z.boolean().default(false)
})

/**
 * Output schema for list-models tool
 */
export const ListModelsOutputSchema = z.object({
  /** List of models */
  models: z.array(z.object({
    name: z.string(),
    model: z.string(),
    size: z.number(),
    digest: z.string(),
    modified_at: z.string(),
    details: z.object({
      parent_model: z.string().optional(),
      format: z.string().optional(),
      family: z.string().optional(),
      families: z.array(z.string()).optional(),
      parameter_size: z.string().optional(),
      quantization_level: z.string().optional(),
      num_ctx: z.number().optional()
    }).optional(),
    status: z.enum(['available', 'running', 'loading', 'error']).optional()
  })),
  /** Total count */
  count: z.number(),
  /** Runtime information */
  runtime: z.object({
    status: z.string(),
    modelCount: z.number(),
    runningModelCount: z.number()
  })
})

/**
 * List models tool implementation
 */
export class ListModelsTool implements BuiltinTool {
  readonly descriptor = {
    name: 'list-models',
    description: 'List available AI models from the runtime with optional filtering',
    version: '1.0.0',
    author: 'Command Center',
    capabilities: ['runtime-query'] as ToolCapability[],
    riskLevel: 'low' as const,
    approvalRequired: false,
    executionScope: {
      allowedPaths: [],
      deniedPaths: [],
      networkRules: {
        defaultAllow: false
      },
      resourceLimits: {
        maxExecutionTimeSec: 30,
        maxMemoryMB: 64
      },
      requiredPermissions: ['runtime-query'] as ToolCapability[]
    },
    inputSchema: ListModelsInputSchema,
    outputSchema: ListModelsOutputSchema,
    tags: ['runtime', 'models', 'inventory'],
    metadata: {
      category: 'runtime',
      readOnly: true,
      safeForAutomation: true
    }
  }

  constructor(private runtime: RuntimeAdapter) {}

  /**
   * Execute the list-models tool
   */
  async execute(input: unknown, context: ToolContext): Promise<unknown> {
    const parsedInput = ListModelsInputSchema.parse(input)

    try {
      // Get runtime health information
      const health = await this.runtime.getHealth()
      
      let models: any[] = []

      if (parsedInput.runningOnly) {
        // Get only running models
        const runningModels = await this.runtime.listRunningModels()
        models = runningModels.map(model => ({
          ...model,
          status: 'running' as const
        }))
      } else {
        // Get all installed models
        const allModels = await this.runtime.listModels()
        models = allModels.map(model => ({
          ...model,
          status: 'available' as const
        }))
      }

      // Apply family filter if specified
      if (parsedInput.family) {
        models = models.filter(model => 
          model.details?.family === parsedInput.family ||
          model.details?.families?.includes(parsedInput.family!)
        )
      }

      // Sort by name
      models.sort((a, b) => a.name.localeCompare(b.name))

      // Remove detailed information if not requested
      if (!parsedInput.detailed) {
        models = models.map(model => {
          const { details, ...basicModel } = model
          return basicModel
        })
      }

      return {
        models,
        count: models.length,
        runtime: {
          status: health.status,
          modelCount: health.modelCount,
          runningModelCount: health.runningModelCount
        }
      }

    } catch (error) {
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate input (optional method)
   */
  validate?(input: unknown): { valid: boolean; errors: string[] } {
    try {
      ListModelsInputSchema.parse(input)
      return { valid: true, errors: [] }
    } catch (error) {
      return {
        valid: false,
        errors: error instanceof Error ? [error.message] : ['Unknown validation error']
      }
    }
  }
}

/**
 * Factory function for creating list-models tool
 */
export function createListModelsTool(runtime: RuntimeAdapter): ListModelsTool {
  return new ListModelsTool(runtime)
}
