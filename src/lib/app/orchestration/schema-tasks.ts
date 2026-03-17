/**
 * Schema Tasks Service
 * 
 * High-level service for common structured output tasks with predefined schemas
 * and optimized prompts. Includes extraction, classification, routing, and scoring tasks.
 */

import { z } from 'zod'
import { structuredOutputService, StructuredOutputRequest } from '../runtime/structured-output'
import { RuntimeAdapter } from '../runtime/types'
import { RuntimeError } from '../runtime/errors'

// Common schema definitions
export const ExtractionSchema = z.object({
  entities: z.array(z.object({
    text: z.string(),
    type: z.string(),
    confidence: z.number().min(0).max(1),
    start_index: z.number(),
    end_index: z.number(),
  })),
  key_points: z.array(z.string()),
  summary: z.string(),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  confidence: z.number().min(0).max(1),
})

export const ClassificationSchema = z.object({
  category: z.string(),
  subcategory: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  alternative_categories: z.array(z.object({
    name: z.string(),
    confidence: z.number().min(0).max(1),
  })),
})

export const RoutingSchema = z.object({
  selected_task: z.enum(['chat', 'code', 'extract', 'rag', 'tool_use', 'reasoning', 'vision', 'embedding']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  requirements: z.object({
    requires_tools: z.boolean(),
    requires_vision: z.boolean(),
    requires_structured_output: z.boolean(),
    max_tokens: z.number().optional(),
    preferred_latency: z.enum(['fast', 'balanced', 'deep']),
  }),
})

export const ScoringSchema = z.object({
  relevance_score: z.number().min(0).max(1),
  quality_score: z.number().min(0).max(1),
  completeness_score: z.number().min(0).max(1),
  overall_score: z.number().min(0).max(1),
  reasoning: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
})

export const CodeAnalysisSchema = z.object({
  language: z.string(),
  complexity: z.enum(['low', 'medium', 'high']),
  functionality: z.string(),
  dependencies: z.array(z.string()),
  security_issues: z.array(z.object({
    type: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string(),
    line_number: z.number().optional(),
  })),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export const DataValidationSchema = z.object({
  is_valid: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
  })),
  warnings: z.array(z.string()),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export type ExtractionResult = z.infer<typeof ExtractionSchema>
export type ClassificationResult = z.infer<typeof ClassificationSchema>
export type RoutingResult = z.infer<typeof RoutingSchema>
export type ScoringResult = z.infer<typeof ScoringSchema>
export type CodeAnalysisResult = z.infer<typeof CodeAnalysisSchema>
export type DataValidationResult = z.infer<typeof DataValidationSchema>

/**
 * Schema Tasks Service
 */
export class SchemaTasksService {
  constructor(
    private readonly structuredOutput: structuredOutputService,
    private readonly runtime: RuntimeAdapter
  ) {}

  /**
   * Extract entities and key information from text
   */
  async extractInformation(
    text: string,
    options: {
      entityTypes?: string[]
      extractSentiment?: boolean
      extractSummary?: boolean
      modelName?: string
    } = {}
  ): Promise<ExtractionResult> {
    const {
      entityTypes = ['person', 'organization', 'location', 'date', 'product'],
      extractSentiment = true,
      extractSummary = true,
      modelName = 'llama3.1-8b', // Default model
    } = options

    const systemPrompt = `You are an expert information extraction specialist. 
    Extract structured information from the given text with high accuracy.
    Focus on the requested entity types and provide confidence scores for each extraction.`

    const prompt = `Extract information from the following text:
    
Text: "${text}"

Entity types to extract: ${entityTypes.join(', ')}
Include sentiment analysis: ${extractSentiment}
Include summary: ${extractSummary}

Provide detailed extractions with confidence scores.`

    const request: StructuredOutputRequest<ExtractionResult> = {
      schema: ExtractionSchema,
      prompt,
      systemPrompt,
      temperature: 0.1, // Low temperature for consistent extraction
      validationMode: 'strict',
    }

    const result = await this.structuredOutput.generateStructuredOutput(
      this.runtime,
      modelName,
      request
    )

    if (!this.structuredOutput.validateResult(result)) {
      throw new RuntimeError(
        'extraction_confidence_low',
        `Extraction confidence ${result.confidence} below threshold`
      )
    }

    return result.data
  }

  /**
   * Classify text into categories
   */
  async classifyText(
    text: string,
    categories: string[],
    options: {
      requireReasoning?: boolean
      provideAlternatives?: boolean
      modelName?: string
    } = {}
  ): Promise<ClassificationResult> {
    const {
      requireReasoning = true,
      provideAlternatives = true,
      modelName = 'llama3.1-8b',
    } = options

    const systemPrompt = `You are an expert text classification specialist. 
    Analyze the given text and classify it into one of the provided categories.
    Provide confidence scores and reasoning for your classification.`

    const prompt = `Classify the following text:

Text: "${text}"

Available categories: ${categories.join(', ')}

Provide the most appropriate category with confidence score and reasoning${provideAlternatives ? ', along with alternative categories' : ''}.`

    const request: StructuredOutputRequest<ClassificationResult> = {
      schema: ClassificationSchema,
      prompt,
      systemPrompt,
      temperature: 0.2,
      validationMode: 'strict',
    }

    const result = await this.structuredOutput.generateStructuredOutput(
      this.runtime,
      modelName,
      request
    )

    if (!this.structuredOutput.validateResult(result)) {
      throw new RuntimeError(
        'classification_confidence_low',
        `Classification confidence ${result.confidence} below threshold`
      )
    }

    return result.data
  }

  /**
   * Route task to appropriate handler
   */
  async routeTask(
    taskDescription: string,
    options: {
      availableTasks?: string[]
      modelName?: string
    } = {}
  ): Promise<RoutingResult> {
    const {
      availableTasks = ['chat', 'code', 'extract', 'rag', 'tool_use', 'reasoning', 'vision', 'embedding'],
      modelName = 'llama3.1-8b',
    } = options

    const systemPrompt = `You are an intelligent task routing specialist. 
    Analyze the given task description and determine the most appropriate task type.
    Consider the requirements and constraints of the task.`

    const prompt = `Analyze and route the following task:

Task: "${taskDescription}"

Available task types: ${availableTasks.join(', ')}

Determine the best task type and provide detailed reasoning about the requirements.`

    const request: StructuredOutputRequest<RoutingResult> = {
      schema: RoutingSchema,
      prompt,
      systemPrompt,
      temperature: 0.1,
      validationMode: 'strict',
    }

    const result = await this.structuredOutput.generateStructuredOutput(
      this.runtime,
      modelName,
      request
    )

    if (!this.structuredOutput.validateResult(result)) {
      throw new RuntimeError(
        'routing_confidence_low',
        `Routing confidence ${result.confidence} below threshold`
      )
    }

    return result.data
  }

  /**
   * Score content based on multiple criteria
   */
  async scoreContent(
    content: string,
    criteria: {
      relevance?: string
      quality?: string
      completeness?: string
    },
    options: {
      modelName?: string
    } = {}
  ): Promise<ScoringResult> {
    const { modelName = 'llama3.1-8b' } = options

    const systemPrompt = `You are an expert content evaluator. 
    Analyze the given content based on the specified criteria and provide detailed scoring.
    Be objective and constructive in your assessment.`

    const prompt = `Evaluate the following content:

Content: "${content}"

Evaluation criteria:
${criteria.relevance ? `- Relevance: ${criteria.relevance}` : ''}
${criteria.quality ? `- Quality: ${criteria.quality}` : ''}
${criteria.completeness ? `- Completeness: ${criteria.completeness}` : ''}

Provide detailed scoring with reasoning and suggestions.`

    const request: StructuredOutputRequest<ScoringResult> = {
      schema: ScoringSchema,
      prompt,
      systemPrompt,
      temperature: 0.2,
      validationMode: 'strict',
    }

    const result = await this.structuredOutput.generateStructuredOutput(
      this.runtime,
      modelName,
      request
    )

    if (!this.structuredOutput.validateResult(result)) {
      throw new RuntimeError(
        'scoring_confidence_low',
        `Scoring confidence ${result.confidence} below threshold`
      )
    }

    return result.data
  }

  /**
   * Analyze code for security, complexity, and functionality
   */
  async analyzeCode(
    code: string,
    options: {
      language?: string
      checkSecurity?: boolean
      analyzeComplexity?: boolean
      modelName?: string
    } = {}
  ): Promise<CodeAnalysisResult> {
    const {
      language = 'auto-detect',
      checkSecurity = true,
      analyzeComplexity = true,
      modelName = 'codellama-7b', // Code-specific model
    } = options

    const systemPrompt = `You are an expert code analysis specialist. 
    Analyze the given code for security issues, complexity, functionality, and dependencies.
    Provide actionable suggestions for improvement.`

    const prompt = `Analyze the following code:

Language: ${language}
Code: "${code}"

Analysis requirements:
- Security analysis: ${checkSecurity}
- Complexity analysis: ${analyzeComplexity}
- Functionality assessment
- Dependency identification

Provide detailed analysis with confidence scores.`

    const request: StructuredOutputRequest<CodeAnalysisResult> = {
      schema: CodeAnalysisSchema,
      prompt,
      systemPrompt,
      temperature: 0.1,
      validationMode: 'strict',
    }

    const result = await this.structuredOutput.generateStructuredOutput(
      this.runtime,
      modelName,
      request
    )

    if (!this.structuredOutput.validateResult(result)) {
      throw new RuntimeError(
        'code_analysis_confidence_low',
        `Code analysis confidence ${result.confidence} below threshold`
      )
    }

    return result.data
  }

  /**
   * Validate data against schema and business rules
   */
  async validateData(
    data: any,
    schema: Record<string, any>,
    rules: string[] = [],
    options: {
      modelName?: string
    } = {}
  ): Promise<DataValidationResult> {
    const { modelName = 'llama3.1-8b' } = options

    const systemPrompt = `You are an expert data validation specialist. 
    Validate the given data against the provided schema and business rules.
    Identify errors, warnings, and provide suggestions for improvement.`

    const prompt = `Validate the following data:

Data: ${JSON.stringify(data, null, 2)}
Schema: ${JSON.stringify(schema, null, 2)}
Business rules: ${rules.join(', ')}

Provide detailed validation results with confidence scores.`

    const request: StructuredOutputRequest<DataValidationResult> = {
      schema: DataValidationSchema,
      prompt,
      systemPrompt,
      temperature: 0.1,
      validationMode: 'strict',
    }

    const result = await this.structuredOutput.generateStructuredOutput(
      this.runtime,
      modelName,
      request
    )

    if (!this.structuredOutput.validateResult(result)) {
      throw new RuntimeError(
        'data_validation_confidence_low',
        `Data validation confidence ${result.confidence} below threshold`
      )
    }

    return result.data
  }

  /**
   * Execute custom schema task
   */
  async executeCustomTask<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    options: {
      systemPrompt?: string
      examples?: Array<{ input: string; output: T }>
      modelName?: string
      temperature?: number
      validationMode?: 'strict' | 'lenient' | 'permissive'
    } = {}
  ): Promise<T> {
    const {
      systemPrompt,
      examples,
      modelName = 'llama3.1-8b',
      temperature = 0.2,
      validationMode = 'strict',
    } = options

    const request: StructuredOutputRequest<T> = {
      schema,
      prompt,
      systemPrompt,
      examples,
      temperature,
      validationMode,
    }

    const result = await this.structuredOutput.generateStructuredOutput(
      this.runtime,
      modelName,
      request
    )

    if (!this.structuredOutput.validateResult(result)) {
      throw new RuntimeError(
        'custom_task_confidence_low',
        `Custom task confidence ${result.confidence} below threshold`
      )
    }

    return result.data
  }

  /**
   * Batch process multiple items
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    options: {
      concurrency?: number
      progressCallback?: (completed: number, total: number) => void
    } = {}
  ): Promise<R[]> {
    const { concurrency = 5, progressCallback } = options
    const results: R[] = []

    // Process items in batches
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      )
      
      results.push(...batchResults)
      
      if (progressCallback) {
        progressCallback(Math.min(i + concurrency, items.length), items.length)
      }
    }

    return results
  }

  /**
   * Get available task schemas
   */
  getAvailableSchemas(): Record<string, z.ZodSchema<any>> {
    return {
      extraction: ExtractionSchema,
      classification: ClassificationSchema,
      routing: RoutingSchema,
      scoring: ScoringSchema,
      code_analysis: CodeAnalysisSchema,
      data_validation: DataValidationSchema,
    }
  }

  /**
   * Validate schema compatibility
   */
  validateSchemaCompatibility(schema: z.ZodSchema<any>): {
    compatible: boolean
    issues: string[]
  } {
    const issues: string[] = []

    try {
      // Convert to JSON schema to check compatibility
      const jsonSchema = (this.structuredOutput as any).zodSchemaToJsonSchema(schema)
      
      // Basic validation
      if (!jsonSchema.type) {
        issues.push('Schema must have a defined type')
      }

      // Check for unsupported features
      if (jsonSchema.anyOf || jsonSchema.oneOf) {
        issues.push('Union types (anyOf/oneOf) have limited support')
      }

      if (jsonSchema.additionalProperties === false) {
        issues.push('Strict object validation may not be fully supported')
      }

      return {
        compatible: issues.length === 0,
        issues,
      }
    } catch (error) {
      return {
        compatible: false,
        issues: [`Schema conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }
    }
  }
}

// Factory function to create service instances
export function createSchemaTasksService(
  runtime: RuntimeAdapter,
  structuredOutput?: structuredOutputService
): SchemaTasksService {
  return new SchemaTasksService(
    structuredOutput || structuredOutputService,
    runtime
  )
}
