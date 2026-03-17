/**
 * Ollama Runtime Adapter
 * 
 * Production-ready implementation of the RuntimeAdapter interface for Ollama.
 * Handles all native Ollama API endpoints with proper error handling, timeouts,
 * and stream normalization.
 */

import { 
  RuntimeAdapter, 
  RuntimeModel, 
  RuntimeModelState,
  ChatRequest,
  ChatResponse,
  EmbedRequest,
  EmbedResponse,
  GenerateRequest,
  GenerateResponse,
  StreamEvent,
  ResponseStream,
  RuntimeCapabilities,
  RuntimeHealth
} from './types'
import { 
  RuntimeError, 
  RuntimeErrorCode, 
  getErrorRecoveryStrategy,
  RuntimeErrorContext 
} from './errors'
import { 
  TimeoutController,
  createTimeoutController,
  DEFAULT_TIMEOUTS
} from './timeouts'

interface OllamaAdapterOptions {
  baseUrl: string
  fetchImpl?: typeof fetch
  timeouts?: Partial<typeof DEFAULT_TIMEOUTS>
  userAgent?: string
}

interface OllamaListResponse {
  models: RuntimeModel[]
}

interface OllamaPSResponse {
  models: RuntimeModelState[]
}

interface OllamaShowResponse extends RuntimeModel {
  model: string
  modified_at: string
  size: number
  digest: string
  details: {
    parent_model?: string
    format?: string
    family?: string
    families?: string[]
    parameter_size?: string
    quantization_level?: string
  }
}

interface OllamaVersionResponse {
  version: string
}

export class OllamaAdapter implements RuntimeAdapter {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeouts: typeof DEFAULT_TIMEOUTS
  private readonly userAgent: string

  constructor(options: OllamaAdapterOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.fetchImpl = options.fetchImpl || fetch
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...options.timeouts }
    this.userAgent = options.userAgent || 'command-center/1.0.0'
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    context: Partial<RuntimeErrorContext> = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const startTime = Date.now()
    
    try {
      const response = await this.fetchImpl(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
          ...options.headers,
        },
      })

      const duration = Date.now() - startTime
      
      if (!response.ok) {
        const errorText = await response.text()
        throw RuntimeError.fromHttpError(
          response.status,
          errorText,
          { ...context, endpoint, statusCode: response.status, duration }
        )
      }

      return await response.json()
    } catch (error) {
      const duration = Date.now() - startTime
      
      if (error instanceof RuntimeError) {
        throw error
      }
      
      if (error instanceof Error) {
        throw RuntimeError.fromNetworkError(error, { ...context, endpoint, duration })
      }
      
      throw new RuntimeError(
        RuntimeErrorCode.UNKNOWN_ERROR,
        String(error),
        { ...context, endpoint, duration }
      )
    }
  }

  private async makeStreamRequest(
    endpoint: string,
    body: any,
    signal?: AbortSignal,
    context: Partial<RuntimeErrorContext> = {}
  ): Promise<ResponseStream> {
    const url = `${this.baseUrl}${endpoint}`
    const startTime = Date.now()
    
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.userAgent,
        },
        signal: signal || undefined,
      })

      const duration = Date.now() - startTime
      
      if (!response.ok || !response.body) {
        const errorText = await response.text()
        throw RuntimeError.fromHttpError(
          response.status,
          errorText,
          { ...context, endpoint, statusCode: response.status, duration }
        )
      }

      return this.normalizeOllamaStream(response.body, startTime)
    } catch (error) {
      const duration = Date.now() - startTime
      
      if (error instanceof RuntimeError) {
        throw error
      }
      
      if (error instanceof Error) {
        throw RuntimeError.fromNetworkError(error, { ...context, endpoint, duration })
      }
      
      throw new RuntimeError(
        RuntimeErrorCode.UNKNOWN_ERROR,
        String(error),
        { ...context, endpoint, duration }
      )
    }
  }

  private async *normalizeOllamaStream(
    body: ReadableStream<Uint8Array>,
    startTime: number
  ): AsyncGenerator<StreamEvent> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line)
              const normalizedEvent = this.normalizeStreamEvent(event, startTime)
              if (normalizedEvent) {
                yield normalizedEvent
              }
            } catch (parseError) {
              // Log parse error but continue processing
              console.warn('Failed to parse stream event:', line, parseError)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private normalizeStreamEvent(event: any, startTime: number): StreamEvent | null {
    const duration = Date.now() - startTime

    // Chat completion events
    if (event.message && event.message.content) {
      return {
        type: 'token',
        text: event.message.content
      }
    }

    // Generate events
    if (event.response) {
      return {
        type: 'token',
        text: event.response
      }
    }

    // Done events
    if (event.done) {
      return {
        type: 'metrics',
        latencyMs: duration
      }
    }

    // Error events
    if (event.error) {
      return {
        type: 'error',
        code: RuntimeErrorCode.RUNTIME_ERROR,
        message: event.error
      }
    }

    return null
  }

  async listModels(): Promise<RuntimeModel[]> {
    try {
      const response = await this.makeRequest<OllamaListResponse>('/api/tags')
      return response.models || []
    } catch (error) {
      if (RuntimeError.isRuntimeError(error)) {
        throw error
      }
      throw new RuntimeError(
        RuntimeErrorCode.MODEL_LOAD_FAILED,
        'Failed to list models',
        { endpoint: '/api/tags' }
      )
    }
  }

  async listRunningModels(): Promise<RuntimeModelState[]> {
    try {
      const response = await this.makeRequest<OllamaPSResponse>('/api/ps')
      return response.models || []
    } catch (error) {
      if (RuntimeError.isRuntimeError(error)) {
        throw error
      }
      throw new RuntimeError(
        RuntimeErrorCode.MODEL_LOAD_FAILED,
        'Failed to list running models',
        { endpoint: '/api/ps' }
      )
    }
  }

  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ResponseStream> {
    const context: Partial<RuntimeErrorContext> = {
      model: req.model,
      request: `messages=${req.messages.length}`
    }

    // Create timeout controller
    const timeoutController = createTimeoutController(
      req.model,
      undefined,
      req.options?.num_ctx,
      this.timeouts
    )

    // Create combined signal
    const controller = new AbortController()
    const combinedSignal = this.combineSignals([signal, timeoutController.createSignal(), controller.signal])

    // Start timers
    timeoutController.startConnectionTimer(() => {
      throw RuntimeError.fromTimeout('first_token', this.timeouts.firstTokenTimeoutMs, context)
    })
    timeoutController.startFirstTokenTimer(() => {
      throw RuntimeError.fromTimeout('first_token', this.timeouts.firstTokenTimeoutMs, context)
    })
    timeoutController.startTotalTimer(() => {
      throw RuntimeError.fromTimeout('total', this.timeouts.totalTimeoutMs, context)
    })

    try {
      const stream = await this.makeStreamRequest(
        '/api/chat',
        {
          model: req.model,
          messages: req.messages,
          format: req.format,
          options: req.options,
          stream: true
        },
        combinedSignal,
        context
      )

      // Clear first token timer on first response
      timeoutController.clearFirstTokenTimer()

      return stream
    } catch (error) {
      timeoutController.abort()
      throw error
    }
  }

  async embed(req: EmbedRequest, signal?: AbortSignal): Promise<number[][]> {
    const context: Partial<RuntimeErrorContext> = {
      model: req.model,
      request: `input=${Array.isArray(req.input) ? req.input.length : 1} items`
    }

    // Create timeout controller
    const timeoutController = createTimeoutController(
      req.model,
      undefined,
      undefined,
      this.timeouts
    )

    const controller = new AbortController()
    const combinedSignal = this.combineSignals([signal, timeoutController.createSignal(), controller.signal])

    timeoutController.startConnectionTimer(() => {
      controller.abort()
      throw RuntimeError.fromTimeout('first_token', this.timeouts.connectionTimeoutMs, context)
    })

    try {
      const response = await this.makeRequest<EmbedResponse>(
        '/api/embed',
        {
          method: 'POST',
          body: JSON.stringify({
            model: req.model,
            input: req.input,
            options: req.options,
            truncate: req.truncate
          }),
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': this.userAgent,
          },
          signal: combinedSignal
        },
        context
      )

      return response.embeddings
    } finally {
      timeoutController.abort()
    }
  }

  async generate(req: GenerateRequest, signal?: AbortSignal): Promise<ResponseStream> {
    const context: Partial<RuntimeErrorContext> = {
      model: req.model,
      request: `prompt_length=${req.prompt.length}`
    }

    const timeoutController = createTimeoutController(
      req.model,
      undefined,
      req.options?.num_ctx,
      this.timeouts
    )

    const controller = new AbortController()
    const combinedSignal = this.combineSignals([signal, timeoutController.createSignal(), controller.signal])

    timeoutController.startConnectionTimer(() => {
      throw RuntimeError.fromTimeout('first_token', this.timeouts.firstTokenTimeoutMs, context)
    })
    timeoutController.startFirstTokenTimer(() => {
      throw RuntimeError.fromTimeout('first_token', this.timeouts.firstTokenTimeoutMs, context)
    })
    timeoutController.startTotalTimer(() => {
      throw RuntimeError.fromTimeout('total', this.timeouts.totalTimeoutMs, context)
    })

    try {
      const stream = await this.makeStreamRequest(
        '/api/generate',
        {
          model: req.model,
          prompt: req.prompt,
          format: req.format,
          options: req.options,
          stream: true
        },
        combinedSignal,
        context
      )

      timeoutController.clearFirstTokenTimer()
      return stream
    } catch (error) {
      timeoutController.abort()
      throw error
    }
  }

  async pullModel(name: string, signal?: AbortSignal): Promise<ResponseStream> {
    const context: Partial<RuntimeErrorContext> = {
      model: name,
      request: 'pull'
    }

    const controller = new AbortController()
    const combinedSignal = this.combineSignals([signal, controller.signal])

    try {
      return await this.makeStreamRequest(
        '/api/pull',
        { name: name },
        combinedSignal,
        context
      )
    } catch (error) {
      controller.abort()
      throw error
    }
  }

  async deleteModel(name: string): Promise<void> {
    const context: Partial<RuntimeErrorContext> = {
      model: name,
      request: 'delete'
    }

    try {
      await this.makeRequest(
        '/api/delete',
        {
          method: 'DELETE',
          body: JSON.stringify({ name: name })
        },
        context
      )
    } catch (error) {
      if (RuntimeError.isRuntimeError(error)) {
        throw error
      }
      throw new RuntimeError(
        RuntimeErrorCode.MODEL_DELETE_FAILED,
        `Failed to delete model: ${name}`,
        context
      )
    }
  }

  async showModel(name: string): Promise<RuntimeModel> {
    const context: Partial<RuntimeErrorContext> = {
      model: name,
      request: 'show'
    }

    try {
      const response = await this.makeRequest<OllamaShowResponse>(
        '/api/show',
        {
          method: 'POST',
          body: JSON.stringify({ name: name })
        },
        context
      )

      return response
    } catch (error) {
      if (RuntimeError.isRuntimeError(error)) {
        throw error
      }
      throw new RuntimeError(
        RuntimeErrorCode.MODEL_NOT_FOUND,
        `Model not found: ${name}`,
        context
      )
    }
  }

  async getCapabilities(): Promise<RuntimeCapabilities> {
    try {
      const version = await this.getVersion()
      const models = await this.listModels()
      
      // Determine capabilities based on version and available models
      const supportsStreaming = true
      const supportsJsonFormat = version.localeCompare('0.1.0', undefined, { numeric: true }) >= 0
      const supportsVision = models.some(model => 
        model.details?.families?.includes('llava') || 
        model.details?.families?.includes('vision')
      )
      
      return {
        supportsChat: true,
        supportsEmbeddings: true,
        supportsStreaming,
        supportsJsonFormat,
        supportsToolCalling: false, // Ollama doesn't support tool calling natively yet
        supportsVision,
        maxContextLength: Math.max(...models.map(m => m.details?.num_ctx || 2048)),
        supportedFormats: supportsJsonFormat ? ['json'] : []
      }
    } catch (error) {
      // Return minimal capabilities if we can't determine
      return {
        supportsChat: true,
        supportsEmbeddings: true,
        supportsStreaming: true,
        supportsJsonFormat: false,
        supportsToolCalling: false,
        supportsVision: false
      }
    }
  }

  async getHealth(): Promise<RuntimeHealth> {
    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Test basic connectivity
      await this.makeRequest('/api/tags', undefined, { request: 'health_check' })
      
      // Get model counts
      const models = await this.listModels()
      const runningModels = await this.listRunningModels()
      
      // Calculate latency
      const latency = Date.now() - startTime
      
      return {
        status: errors.length > 0 ? 'degraded' : 'healthy',
        latency,
        uptime: 0, // Ollama doesn't provide uptime
        modelCount: models.length,
        runningModelCount: runningModels.length,
        lastCheck: new Date().toISOString(),
        errors
      }
    } catch (error) {
      const latency = Date.now() - startTime
      
      if (RuntimeError.isRuntimeError(error)) {
        errors.push(error.message)
      } else {
        errors.push('Unknown health check error')
      }
      
      return {
        status: 'unhealthy',
        latency,
        uptime: 0,
        modelCount: 0,
        runningModelCount: 0,
        lastCheck: new Date().toISOString(),
        errors
      }
    }
  }

  private async getVersion(): Promise<string> {
    try {
      const response = await this.makeRequest<OllamaVersionResponse>('/api/version')
      return response.version
    } catch (error) {
      return 'unknown'
    }
  }

  private combineSignals(signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController()
    
    for (const signal of signals) {
      if (signal?.aborted) {
        controller.abort()
        break
      }
      
      signal?.addEventListener('abort', () => {
        controller.abort()
      }, { once: true })
    }
    
    return controller.signal
  }
}

export function createOllamaAdapter(options: OllamaAdapterOptions): OllamaAdapter {
  return new OllamaAdapter(options)
}
