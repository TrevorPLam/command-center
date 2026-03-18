/**
 * Built-in Tools Exports
 * 
 * Exports all built-in tool implementations and factory functions
 * for easy registration and use in the tool system.
 */

// Tool implementations
export { ListModelsTool, createListModelsTool } from './list-models'
export { ReadFileTool, createReadFileTool } from './read-file'
export { QuerySettingsTool, createQuerySettingsTool } from './query-settings'
export { GetMetricsTool, createGetMetricsTool } from './get-metrics'
export { IndexFileTool, createIndexFileTool } from './index-file'
export { SummarizeFileTool, createSummarizeFileTool } from './summarize-file'

// Tool schemas for validation
export { ListModelsInputSchema, ListModelsOutputSchema } from './list-models'
export { ReadFileInputSchema, ReadFileOutputSchema } from './read-file'
export { QuerySettingsInputSchema, QuerySettingsOutputSchema } from './query-settings'
export { GetMetricsInputSchema, GetMetricsOutputSchema } from './get-metrics'
export { IndexFileInputSchema, IndexFileOutputSchema } from './index-file'
export { SummarizeFileInputSchema, SummarizeFileOutputSchema } from './summarize-file'

/**
 * All built-in tools registry
 * 
 * Helper function to get all built-in tools for easy registration
 */
export function getAllBuiltinTools(): Array<{
  name: string
  factory: (...args: any[]) => any
  dependencies?: string[]
}> {
  return [
    {
      name: 'list-models',
      factory: createListModelsTool,
      dependencies: ['runtime']
    },
    {
      name: 'read-file',
      factory: createReadFileTool,
      dependencies: []
    },
    {
      name: 'query-settings',
      factory: createQuerySettingsTool,
      dependencies: []
    },
    {
      name: 'get-metrics',
      factory: createGetMetricsTool,
      dependencies: []
    },
    {
      name: 'index-file',
      factory: createIndexFileTool,
      dependencies: []
    },
    {
      name: 'summarize-file',
      factory: createSummarizeFileTool,
      dependencies: ['runtime']
    }
  ]
}

/**
 * Register all built-in tools with the execution provider
 * 
 * @param provider Tool execution provider
 * @param dependencies Service dependencies (runtime, etc.)
 */
export async function registerBuiltinTools(
  provider: any,
  dependencies: {
    runtime?: any
    [key: string]: any
  } = {}
): Promise<void> {
  const tools = getAllBuiltinTools()

  for (const tool of tools) {
    try {
      // Resolve dependencies
      const args: any[] = []
      if (tool.dependencies) {
        for (const dep of tool.dependencies) {
          if (dependencies[dep]) {
            args.push(dependencies[dep])
          } else {
            console.warn(`Missing dependency '${dep}' for tool '${tool.name}'`)
          }
        }
      }

      // Create and register tool
      const toolInstance = tool.factory(...args)
      provider.registerTool(toolInstance)
      
      console.log(`Registered built-in tool: ${tool.name}`)
    } catch (error) {
      console.error(`Failed to register tool '${tool.name}':`, error)
    }
  }
}
