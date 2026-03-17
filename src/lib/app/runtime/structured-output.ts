/**
 * Structured Output Utilities
 * 
 * Comprehensive utilities for handling structured output with JSON schema validation,
 * parsing guards, and error recovery. Supports multiple model providers and formats.
 */

import { z } from 'zod'
import { RuntimeError, RuntimeErrorErrorCode } from './errors'
import { RuntimeAdapter, ChatRequest } from './types'

export interface StructuredOutputRequest<T = any> {
  schema: z.ZodSchema<T>
  prompt: string
  systemPrompt?: string
  examples?: Array<{ input: string; output: T }>
  temperature?: number
  maxTokens?: number
  retryAttempts?: number
  validationMode?: 'strict' | 'lenient' | 'permissive'
}

export interface StructuredOutputResult<T> {
  data: T
  confidence: number
  validationErrors: string[]
  parsingAttempts: number
  modelUsed: string
  processingTimeMs: number
  rawResponse: string
}

export interface StructuredOutputConfig {
  defaultRetryAttempts: number
  defaultValidationMode: 'strict' | 'lenient' | 'permissive'
  maxParsingAttempts: number
  timeoutMs: number
  enableAutoRepair: boolean
  confidenceThreshold: number
}

/**
 * Structured Output Service
 */
export class StructuredOutputService {
  private config: StructuredOutputConfig = {
    defaultRetryAttempts: 3,
    defaultValidationMode: 'strict',
    maxParsingAttempts: 5,
    timeoutMs: 30000,
    enableAutoRepair: true,
    confidenceThreshold: 0.7,
  }

  constructor(config?: Partial<StructuredOutputConfig>) {
    if (config) {
      this.config = { ...this.config, ...config }
    }
  }

  /**
   * Generate structured output using a model with schema validation
   */
  async generateStructuredOutput<T>(
    runtime: RuntimeAdapter,
    modelName: string,
    request: StructuredOutputRequest<T>
  ): Promise<StructuredOutputResult<T>> {
    const startTime = Date.now()
    const {
      schema,
      prompt,
      systemPrompt,
      examples,
      temperature = 0.1, // Lower temperature for structured output
      maxTokens = 2000,
      retryAttempts = this.config.defaultRetryAttempts,
      validationMode = this.config.defaultValidationMode,
    } = request

    let lastError: Error | null = null
    let attempts = 0
    let rawResponse = ''
    let validationErrors: string[] = []

    try {
      // Build the enhanced prompt with schema and examples
      const enhancedPrompt = this.buildEnhancedPrompt(prompt, schema, examples, systemPrompt)

      for (let attempt = 0; attempt <= retryAttempts; attempt++) {
        attempts++
        
        try {
          // Make the request to the model
          const chatRequest: ChatRequest = {
            model: modelName,
            messages: [
              { role: 'system', content: enhancedPrompt },
              { role: 'user', content: prompt }
            ],
            format: 'json', // Request JSON format from the model
            options: {
              temperature,
              num_predict: maxTokens,
            },
            stream: false,
            totalTimeoutMs: this.config.timeoutMs,
          }

          const response = await runtime.chat(chatRequest)
          
          // Collect the response
          const responseText = await this.collectResponse(response)
          rawResponse = responseText

          // Parse and validate the response
          const parseResult = await this.parseAndValidate<T>(
            responseText,
            schema,
            validationMode,
            attempt
          )

          if (parseResult.success) {
            const processingTimeMs = Date.now() - startTime
            
            return {
              data: parseResult.data!,
              confidence: parseResult.confidence,
              validationErrors: parseResult.errors,
              parsingAttempts: attempts,
              modelUsed: modelName,
              processingTimeMs,
              rawResponse,
            }
          } else {
            validationErrors = parseResult.errors
            lastError = parseResult.error || new Error('Validation failed')
            
            // If auto-repair is enabled and this isn't the last attempt, try to repair
            if (this.config.enableAutoRepair && attempt < retryAttempts) {
              const repaired = await this.attemptRepair(responseText, schema, parseResult.errors)
              if (repaired.success) {
                const processingTimeMs = Date.now() - startTime
                return {
                  data: repaired.data!,
                  confidence: repaired.confidence * 0.9, // Slightly lower confidence for repaired data
                  validationErrors: repaired.errors,
                  parsingAttempts: attempts + 1,
                  modelUsed: modelName,
                  processingTimeMs,
                  rawResponse,
                }
              }
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')
          
          // Continue to next attempt if this isn't the last one
          if (attempt < retryAttempts) {
            // Add a small delay before retry
            await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
            continue
          }
        }
      }

      // All attempts failed
      throw new RuntimeError(
        'structured_output_failed',
        `Failed to generate valid structured output after ${attempts} attempts: ${lastError?.message}`,
        { validationErrors, rawResponse, attempts }
      )
    } catch (error) {
      if (error instanceof RuntimeError) {
        throw error
      }
      
      throw new RuntimeError(
        'structured_output_generation_failed',
        `Structured output generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { validationErrors, rawResponse, attempts }
      )
    }
  }

  /**
   * Build an enhanced prompt with schema information and examples
   */
  private buildEnhancedPrompt<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    examples?: Array<{ input: string; output: T }>,
    systemPrompt?: string
  ): string {
    const jsonSchema = this.zodSchemaToJsonSchema(schema)
    
    let enhancedPrompt = ''

    // System prompt with schema instructions
    if (systemPrompt) {
      enhancedPrompt += systemPrompt + '\n\n'
    }

    enhancedPrompt += `You must respond with valid JSON that conforms to the following schema:\n\n`
    enhancedPrompt += `${JSON.stringify(jsonSchema, null, 2)}\n\n`
    enhancedPrompt += `Important rules:\n`
    enhancedPrompt += `- Respond ONLY with valid JSON, no additional text\n`
    enhancedPrompt += `- Ensure all required fields are present\n`
    enhancedPrompt += `- Use the correct data types for each field\n`
    enhancedPrompt += `- Follow any constraints specified in the schema\n`

    // Add examples if provided
    if (examples && examples.length > 0) {
      enhancedPrompt += `\nExamples:\n`
      examples.forEach((example, index) => {
        enhancedPrompt += `Example ${index + 1}:\n`
        enhancedPrompt += `Input: ${example.input}\n`
        enhancedPrompt += `Output: ${JSON.stringify(example.output, null, 2)}\n\n`
      })
    }

    enhancedPrompt += `\nNow, respond to the following request:\n${prompt}`

    return enhancedPrompt
  }

  /**
   * Parse and validate response against schema
   */
  private async parseAndValidate<T>(
    response: string,
    schema: z.ZodSchema<T>,
    validationMode: 'strict' | 'lenient' | 'permissive',
    attempt: number
  ): Promise<{
    success: boolean
    data?: T
    confidence: number
    errors: string[]
    error?: Error
  }> {
    const errors: string[] = []

    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonText = this.extractJson(response)
      
      if (!jsonText) {
        errors.push('No valid JSON found in response')
        return { success: false, confidence: 0, errors }
      }

      // Parse JSON
      let parsed: any
      try {
        parsed = JSON.parse(jsonText)
      } catch (parseError) {
        errors.push(`JSON parsing failed: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`)
        return { success: false, confidence: 0, errors }
      }

      // Validate against schema
      const result = schema.safeParse(parsed)
      
      if (result.success) {
        // Calculate confidence based on validation mode and attempt number
        let confidence = 1.0
        
        switch (validationMode) {
          case 'strict':
            confidence = 1.0
            break
          case 'lenient':
            confidence = 0.9
            break
          case 'permissive':
            confidence = 0.8
            break
        }

        // Reduce confidence for later attempts
        confidence *= Math.max(0.7, 1.0 - (attempt * 0.1))

        return {
          success: true,
          data: result.data,
          confidence,
          errors: [],
        }
      } else {
        // Validation failed
        errors.push(...result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`))
        
        return {
          success: false,
          confidence: 0,
          errors,
          error: new Error('Schema validation failed'),
        }
      }
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        success: false,
        confidence: 0,
        errors,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }
    }
  }

  /**
   * Extract JSON from response text
   */
  private extractJson(response: string): string | null {
    // Remove any leading/trailing whitespace
    let cleaned = response.trim()

    // Handle markdown code blocks
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    // Try to find JSON object boundaries
    const startIndex = cleaned.indexOf('{')
    const endIndex = cleaned.lastIndexOf('}')
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const jsonCandidate = cleaned.substring(startIndex, endIndex + 1)
      
      // Validate that this looks like JSON
      try {
        JSON.parse(jsonCandidate)
        return jsonCandidate
      } catch {
        // Not valid JSON, continue searching
      }
    }

    // Try parsing the entire cleaned response as JSON
    try {
      JSON.parse(cleaned)
      return cleaned
    } catch {
      return null
    }
  }

  /**
   * Attempt to repair invalid JSON
   */
  private async attemptRepair<T>(
    response: string,
    schema: z.ZodSchema<T>,
    errors: string[]
  ): Promise<{
    success: boolean
    data?: T
    confidence: number
    errors: string[]
  }> {
    try {
      const jsonText = this.extractJson(response)
      if (!jsonText) {
        return { success: false, confidence: 0, errors: ['No JSON to repair'] }
      }

      // Basic JSON repairs
      let repaired = jsonText

      // Fix common JSON issues
      repaired = repaired
        .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
        .replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)\1:/g, '"$2":') // Quote unquoted property names
        .replace(/:\s*([^",\[\]{}0-9][^",\[\]{}]*?)\s*(,|})/g, ': "$1"$2') // Quote unquoted string values

      // Try parsing the repaired JSON
      try {
        const parsed = JSON.parse(repaired)
        const result = schema.safeParse(parsed)
        
        if (result.success) {
          return {
            success: true,
            data: result.data,
            confidence: 0.7, // Lower confidence for repaired data
            errors: [], // Repaired successfully
          }
        } else {
          return {
            success: false,
            confidence: 0,
            errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
          }
        }
      } catch (parseError) {
        return {
          success: false,
          confidence: 0,
          errors: [`JSON repair failed: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`],
        }
      }
    } catch (error) {
      return {
        success: false,
        confidence: 0,
        errors: [`Repair attempt failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      }
    }
  }

  /**
   * Convert Zod schema to JSON schema (simplified version)
   */
  private zodSchemaToJsonSchema(schema: z.ZodSchema<any>): any {
    // This is a simplified converter - in production you'd want a more comprehensive one
    const description = schema._def.description || ''
    
    if (schema instanceof z.ZodObject) {
      const shape = schema._def.shape()
      const properties: any = {}
      const required: string[] = []

      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as z.ZodSchema<any>
        properties[key] = this.zodSchemaToJsonSchema(fieldSchema)
        
        if (!fieldSchema.isOptional()) {
          required.push(key)
        }
      }

      return {
        type: 'object',
        properties,
        required,
        description,
      }
    } else if (schema instanceof z.ZodString) {
      return {
        type: 'string',
        description,
      }
    } else if (schema instanceof z.ZodNumber) {
      return {
        type: 'number',
        description,
      }
    } else if (schema instanceof z.ZodBoolean) {
      return {
        type: 'boolean',
        description,
      }
    } else if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodSchemaToJsonSchema(schema._def.type),
        description,
      }
    } else if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: schema._def.values,
        description,
      }
    } else if (schema instanceof z.ZodUnion) {
      return {
        anyOf: schema._def.options.map((option: z.ZodSchema<any>) => this.zodSchemaToJsonSchema(option)),
        description,
      }
    } else if (schema instanceof z.ZodOptional) {
      return this.zodSchemaToJsonSchema(schema._def.innerType)
    } else {
      // Fallback for unknown types
      return {
        type: 'string',
        description,
      }
    }
  }

  /**
   * Collect response from stream
   */
  private async collectResponse(stream: ReadableStream<any>): Promise<string> {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let response = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        if (value) {
          const chunk = typeof value === 'string' ? value : decoder.decode(value)
          response += chunk
        }
      }
    } finally {
      reader.releaseLock()
    }

    return response
  }

  /**
   * Validate structured output result against confidence threshold
   */
  validateResult<T>(result: StructuredOutputResult<T>): boolean {
    return result.confidence >= this.config.confidenceThreshold
  }

  /**
   * Get configuration
   */
  getConfig(): StructuredOutputConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StructuredOutputConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// Singleton instance
export const structuredOutputService = new StructuredOutputService()
