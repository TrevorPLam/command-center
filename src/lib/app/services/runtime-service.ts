/**
 * Runtime Service
 * 
 * Server-side service wrapper that provides a clean interface for runtime operations.
 * Handles service discovery, health monitoring, and provides cached responses
 * for expensive operations like model listing.
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
  RuntimeHealth,
  RuntimeSnapshot,
  RuntimeMetrics
} from '../runtime/types'
import { 
  RuntimeError,
  RuntimeErrorCode,
  shouldLogError
} from '../runtime/errors'
import { createOllamaAdapter } from '../runtime/ollama-adapter'
import { env } from '@/lib/config/env'

export interface RuntimeServiceConfig {
  adapter: RuntimeAdapter
  cacheTimeoutMs: number
  healthCheckIntervalMs: number
  maxRetries: number
}

interface CachedData<T> {
  data: T
  timestamp: number
  ttl: number
}

export class RuntimeService {
  private readonly adapter: RuntimeAdapter
  private readonly config: RuntimeServiceConfig
  
  // Cache for expensive operations
  private modelsCache: CachedData<RuntimeModel[]> | null = null
  private runningModelsCache: CachedData<RuntimeModelState[]> | null = null
  private capabilitiesCache: CachedData<RuntimeCapabilities> | null = null
  private healthCache: CachedData<RuntimeHealth> | null = null
  
  // Metrics collection
  private metrics: RuntimeMetrics = {
    requestCount: 0,
    errorCount: 0,
    averageLatency: 0,
    tokensGenerated: 0,
    tokensProcessed: 0,
    modelUsage: {},
    errorTypes: {},
    timestamp: new Date().toISOString()
  }

  constructor(config: RuntimeServiceConfig) {
    this.adapter = config.adapter
    this.config = config
  }

  /**
   * Get list of all installed models with caching
   */
  async listModels(forceRefresh = false): Promise<RuntimeModel[]> {
    const now = Date.now()
    
    if (!forceRefresh && this.modelsCache && (now - this.modelsCache.timestamp) < this.modelsCache.ttl) {
      return this.modelsCache.data
    }

    try {
      const startTime = Date.now()
      const models = await this.adapter.listModels()
      const latency = Date.now() - startTime
      
      // Update cache
      this.modelsCache = {
        data: models,
        timestamp: now,
        ttl: this.config.cacheTimeoutMs
      }
      
      // Update metrics
      this.updateMetrics('listModels', latency, true)
      
      return models
    } catch (error) {
      this.updateMetrics('listModels', 0, false, error)
      
      // Return cached data if available, otherwise rethrow
      if (this.modelsCache) {
        console.warn('Failed to fetch fresh models, returning cached data:', error)
        return this.modelsCache.data
      }
      
      throw error
    }
  }

  /**
   * Get list of currently running models with caching
   */
  async listRunningModels(forceRefresh = false): Promise<RuntimeModelState[]> {
    const now = Date.now()
    
    if (!forceRefresh && this.runningModelsCache && (now - this.runningModelsCache.timestamp) < this.runningModelsCache.ttl) {
      return this.runningModelsCache.data
    }

    try {
      const startTime = Date.now()
      const models = await this.adapter.listRunningModels()
      const latency = Date.now() - startTime
      
      // Update cache
      this.runningModelsCache = {
        data: models,
        timestamp: now,
        ttl: this.config.cacheTimeoutMs / 2 // Shorter cache for running models
      }
      
      // Update metrics
      this.updateMetrics('listRunningModels', latency, true)
      
      return models
    } catch (error) {
      this.updateMetrics('listRunningModels', 0, false, error)
      
      if (this.runningModelsCache) {
        console.warn('Failed to fetch fresh running models, returning cached data:', error)
        return this.runningModelsCache.data
      }
      
      throw error
    }
  }

  /**
   * Get runtime capabilities with caching
   */
  async getCapabilities(forceRefresh = false): Promise<RuntimeCapabilities> {
    const now = Date.now()
    
    if (!forceRefresh && this.capabilitiesCache && (now - this.capabilitiesCache.timestamp) < this.capabilitiesCache.ttl) {
      return this.capabilitiesCache.data
    }

    try {
      const startTime = Date.now()
      const capabilities = await this.adapter.getCapabilities()
      const latency = Date.now() - startTime
      
      // Update cache
      this.capabilitiesCache = {
        data: capabilities,
        timestamp: now,
        ttl: this.config.cacheTimeoutMs * 5 // Longer cache for capabilities
      }
      
      // Update metrics
      this.updateMetrics('getCapabilities', latency, true)
      
      return capabilities
    } catch (error) {
      this.updateMetrics('getCapabilities', 0, false, error)
      
      if (this.capabilitiesCache) {
        console.warn('Failed to fetch fresh capabilities, returning cached data:', error)
        return this.capabilitiesCache.data
      }
      
      throw error
    }
  }

  /**
   * Get runtime health status with caching
   */
  async getHealth(forceRefresh = false): Promise<RuntimeHealth> {
    const now = Date.now()
    
    if (!forceRefresh && this.healthCache && (now - this.healthCache.timestamp) < this.healthCache.ttl) {
      return this.healthCache.data
    }

    try {
      const startTime = Date.now()
      const health = await this.adapter.getHealth()
      const latency = Date.now() - startTime
      
      // Update cache
      this.healthCache = {
        data: health,
        timestamp: now,
        ttl: this.config.healthCheckIntervalMs
      }
      
      // Update metrics
      this.updateMetrics('getHealth', latency, true)
      
      return health
    } catch (error) {
      this.updateMetrics('getHealth', 0, false, error)
      
      // Always return a health status, even if check failed
      const fallbackHealth: RuntimeHealth = {
        status: 'unhealthy',
        latency: 0,
        uptime: 0,
        modelCount: 0,
        runningModelCount: 0,
        lastCheck: new Date().toISOString(),
        errors: [error instanceof Error ? error.message : String(error)]
      }
      
      if (this.healthCache) {
        return {
          ...this.healthCache.data,
          status: 'degraded',
          errors: [...this.healthCache.data.errors, 'Health check failed']
        }
      }
      
      return fallbackHealth
    }
  }

  /**
   * Execute chat completion
   */
  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ResponseStream> {
    const startTime = Date.now()
    
    try {
      const stream = await this.adapter.chat(request, signal)
      
      // Update metrics
      this.updateMetrics('chat', Date.now() - startTime, true)
      this.updateModelUsage(request.model)
      
      return stream
    } catch (error) {
      this.updateMetrics('chat', Date.now() - startTime, false, error)
      throw error
    }
  }

  /**
   * Generate embeddings
   */
  async embed(request: EmbedRequest, signal?: AbortSignal): Promise<number[][]> {
    const startTime = Date.now()
    
    try {
      const embeddings = await this.adapter.embed(request, signal)
      
      // Update metrics
      this.updateMetrics('embed', Date.now() - startTime, true)
      this.updateModelUsage(request.model)
      
      return embeddings
    } catch (error) {
      this.updateMetrics('embed', Date.now() - startTime, false, error)
      throw error
    }
  }

  /**
   * Generate text
   */
  async generate(request: GenerateRequest, signal?: AbortSignal): Promise<ResponseStream> {
    const startTime = Date.now()
    
    try {
      const stream = await this.adapter.generate(request, signal)
      
      // Update metrics
      this.updateMetrics('generate', Date.now() - startTime, true)
      this.updateModelUsage(request.model)
      
      return stream
    } catch (error) {
      this.updateMetrics('generate', Date.now() - startTime, false, error)
      throw error
    }
  }

  /**
   * Pull a model
   */
  async pullModel(name: string, signal?: AbortSignal): Promise<ResponseStream> {
    const startTime = Date.now()
    
    try {
      const stream = await this.adapter.pullModel(name, signal)
      
      // Invalidate caches after pulling
      this.invalidateCache('models')
      
      // Update metrics
      this.updateMetrics('pullModel', Date.now() - startTime, true)
      
      return stream
    } catch (error) {
      this.updateMetrics('pullModel', Date.now() - startTime, false, error)
      throw error
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(name: string): Promise<void> {
    const startTime = Date.now()
    
    try {
      await this.adapter.deleteModel(name)
      
      // Invalidate caches after deletion
      this.invalidateCache('models')
      this.invalidateCache('runningModels')
      
      // Update metrics
      this.updateMetrics('deleteModel', Date.now() - startTime, true)
    } catch (error) {
      this.updateMetrics('deleteModel', Date.now() - startTime, false, error)
      throw error
    }
  }

  /**
   * Get detailed model information
   */
  async showModel(name: string): Promise<RuntimeModel> {
    const startTime = Date.now()
    
    try {
      const model = await this.adapter.showModel(name)
      
      // Update metrics
      this.updateMetrics('showModel', Date.now() - startTime, true)
      
      return model
    } catch (error) {
      this.updateMetrics('showModel', Date.now() - startTime, false, error)
      throw error
    }
  }

  /**
   * Create a runtime snapshot
   */
  async createSnapshot(): Promise<RuntimeSnapshot> {
    const timestamp = new Date().toISOString()
    
    try {
      const [health, models, runningModels, capabilities] = await Promise.all([
        this.getHealth(),
        this.listModels(),
        this.listRunningModels(),
        this.getCapabilities()
      ])

      return {
        id: `snapshot-${Date.now()}`,
        timestamp,
        health,
        models,
        runningModels,
        capabilities,
        version: '1.0.0'
      }
    } catch (error) {
      throw new RuntimeError(
        RuntimeErrorCode.SYSTEM_ERROR,
        `Failed to create runtime snapshot: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): RuntimeMetrics {
    return { ...this.metrics }
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      averageLatency: 0,
      tokensGenerated: 0,
      tokensProcessed: 0,
      modelUsage: {},
      errorTypes: {},
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Invalidate specific caches
   */
  private invalidateCache(type: 'models' | 'runningModels' | 'capabilities' | 'health' | 'all'): void {
    switch (type) {
      case 'models':
        this.modelsCache = null
        break
      case 'runningModels':
        this.runningModelsCache = null
        break
      case 'capabilities':
        this.capabilitiesCache = null
        break
      case 'health':
        this.healthCache = null
        break
      case 'all':
        this.modelsCache = null
        this.runningModelsCache = null
        this.capabilitiesCache = null
        this.healthCache = null
        break
    }
  }

  /**
   * Update metrics with operation results
   */
  private updateMetrics(
    operation: string,
    latency: number,
    success: boolean,
    error?: unknown
  ): void {
    this.metrics.requestCount++
    
    if (!success) {
      this.metrics.errorCount++
      
      if (RuntimeError.isRuntimeError(error)) {
        const errorCode = error.code
        this.metrics.errorTypes[errorCode] = (this.metrics.errorTypes[errorCode] || 0) + 1
        
        if (shouldLogError(error)) {
          console.error(`Runtime error in ${operation}:`, error)
        }
      } else {
        console.error(`Unknown error in ${operation}:`, error)
      }
    }
    
    // Update average latency (exponential moving average)
    const alpha = 0.1 // Smoothing factor
    this.metrics.averageLatency = this.metrics.averageLatency * (1 - alpha) + latency * alpha
    
    this.metrics.timestamp = new Date().toISOString()
  }

  /**
   * Update model usage statistics
   */
  private updateModelUsage(modelName: string): void {
    this.metrics.modelUsage[modelName] = (this.metrics.modelUsage[modelName] || 0) + 1
  }
}

// Singleton instance for the application
let runtimeService: RuntimeService | null = null

export function getRuntimeService(): RuntimeService {
  if (!runtimeService) {
    const adapter = createOllamaAdapter({
      baseUrl: env.OLLAMA_BASE_URL,
      timeouts: {
        connectionTimeoutMs: 5000,
        firstTokenTimeoutMs: 30000,
        totalTimeoutMs: 300000,
      }
    })
    
    runtimeService = new RuntimeService({
      adapter,
      cacheTimeoutMs: 30000, // 30 seconds
      healthCheckIntervalMs: 10000, // 10 seconds
      maxRetries: 3
    })
  }
  
  return runtimeService
}

export function resetRuntimeService(): void {
  runtimeService = null
}
