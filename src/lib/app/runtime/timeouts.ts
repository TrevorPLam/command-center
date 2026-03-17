/**
 * Runtime Timeout Configuration
 * 
 * Defines timeout taxonomy and configuration for different runtime operations.
 * Separates connection, first-token, and total timeouts for proper error classification.
 */

export interface TimeoutConfig {
  // Connection timeouts
  connectionTimeoutMs: number
  connectionReadTimeoutMs: number
  
  // Request timeouts  
  firstTokenTimeoutMs: number
  totalTimeoutMs: number
  
  // Model operation timeouts
  modelLoadTimeoutMs: number
  modelPullTimeoutMs: number
  modelDeleteTimeoutMs: number
  
  // Embedding timeouts
  embeddingTimeoutMs: number
  
  // Health check timeouts
  healthCheckTimeoutMs: number
  
  // Diagnostics timeouts
  diagnosticsTimeoutMs: number
}

export const DEFAULT_TIMEOUTS: TimeoutConfig = {
  // Connection: 5 seconds to establish, 30 seconds to read
  connectionTimeoutMs: 5000,
  connectionReadTimeoutMs: 30000,
  
  // Chat generation: 30 seconds for first token, 5 minutes total
  firstTokenTimeoutMs: 30000,
  totalTimeoutMs: 300000,
  
  // Model operations: 2 minutes to load, 10 minutes to pull, 30 seconds to delete
  modelLoadTimeoutMs: 120000,
  modelPullTimeoutMs: 600000,
  modelDeleteTimeoutMs: 30000,
  
  // Embeddings: 30 seconds
  embeddingTimeoutMs: 30000,
  
  // Health check: 10 seconds
  healthCheckTimeoutMs: 10000,
  
  // Diagnostics: 30 seconds
  diagnosticsTimeoutMs: 30000,
}

export interface TimeoutOptions {
  connectionTimeoutMs?: number
  firstTokenTimeoutMs?: number
  totalTimeoutMs?: number
  modelLoadTimeoutMs?: number
  embeddingTimeoutMs?: number
}

export function getTimeouts(options: TimeoutOptions = {}): TimeoutConfig {
  return {
    ...DEFAULT_TIMEOUTS,
    ...options
  }
}

export function getModelSpecificTimeouts(
  modelName: string,
  modelSize?: string,
  baseTimeouts: TimeoutConfig = DEFAULT_TIMEOUTS
): TimeoutConfig {
  // Adjust timeouts based on model characteristics
  const sizeMultiplier = getModelSizeMultiplier(modelSize)
  const isLargeModel = isLargeModelType(modelName)
  
  return {
    ...baseTimeouts,
    // Large models get more time for first token and total generation
    firstTokenTimeoutMs: baseTimeouts.firstTokenTimeoutMs * (isLargeModel ? 2 : 1) * sizeMultiplier,
    totalTimeoutMs: baseTimeouts.totalTimeoutMs * (isLargeModel ? 1.5 : 1) * sizeMultiplier,
    // Model loading takes longer for large models
    modelLoadTimeoutMs: baseTimeouts.modelLoadTimeoutMs * (isLargeModel ? 2 : 1) * sizeMultiplier,
  }
}

export function getModelSizeMultiplier(modelSize?: string): number {
  if (!modelSize) return 1
  
  const size = modelSize.toLowerCase()
  if (size.includes('70b') || size.includes('65b')) return 3
  if (size.includes('34b') || size.includes('33b')) return 2.5
  if (size.includes('13b') || size.includes('12b')) return 2
  if (size.includes('8b') || size.includes('7b')) return 1.5
  if (size.includes('3b') || size.includes('1b')) return 1
  
  return 1
}

export function isLargeModelType(modelName: string): boolean {
  const name = modelName.toLowerCase()
  
  // Known large model families
  const largeModelPatterns = [
    /llama.*70b/,
    /llama.*65b/, 
    /llama.*34b/,
    /llama.*33b/,
    /mixtral.*8x7b/,
    /mixtral.*8x22b/,
    /qwen.*72b/,
    /codellama.*34b/,
    /codellama.*70b/,
    /yi.*34b/,
    /yi.*65b/,
  ]
  
  return largeModelPatterns.some(pattern => pattern.test(name))
}

export function getContextAdjustedTimeouts(
  contextLength: number,
  baseTimeouts: TimeoutConfig = DEFAULT_TIMEOUTS
): TimeoutConfig {
  // Adjust timeouts based on context length
  const contextMultiplier = getContextMultiplier(contextLength)
  
  return {
    ...baseTimeouts,
    firstTokenTimeoutMs: baseTimeouts.firstTokenTimeoutMs * contextMultiplier,
    totalTimeoutMs: baseTimeouts.totalTimeoutMs * contextMultiplier,
  }
}

export function getContextMultiplier(contextLength: number): number {
  if (contextLength <= 4096) return 1
  if (contextLength <= 8192) return 1.2
  if (contextLength <= 16384) return 1.5
  if (contextLength <= 32768) return 2
  if (contextLength <= 65536) return 3
  return 4
}

export class TimeoutController {
  private timeouts: TimeoutConfig
  private abortController?: AbortController
  private firstTokenTimer?: ReturnType<typeof setTimeout>
  private totalTimer?: ReturnType<typeof setTimeout>
  private connectionTimer?: ReturnType<typeof setTimeout>

  constructor(timeouts: TimeoutConfig) {
    this.timeouts = timeouts
  }

  createSignal(): AbortSignal {
    this.abortController = new AbortController()
    return this.abortController.signal
  }

  startConnectionTimer(onTimeout: () => void): void {
    this.clearConnectionTimer()
    
    this.connectionTimer = setTimeout(() => {
      onTimeout()
      this.abort()
    }, this.timeouts.connectionTimeoutMs)
  }

  startFirstTokenTimer(onTimeout: () => void): void {
    this.clearFirstTokenTimer()
    
    this.firstTokenTimer = setTimeout(() => {
      onTimeout()
    }, this.timeouts.firstTokenTimeoutMs)
  }

  startTotalTimer(onTimeout: () => void): void {
    this.clearTotalTimer()
    
    this.totalTimer = setTimeout(() => {
      onTimeout()
      this.abort()
    }, this.timeouts.totalTimeoutMs)
  }

  clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer)
      this.connectionTimer = undefined as any
    }
  }

  clearFirstTokenTimer(): void {
    if (this.firstTokenTimer) {
      clearTimeout(this.firstTokenTimer)
      this.firstTokenTimer = undefined as any
    }
  }

  clearTotalTimer(): void {
    if (this.totalTimer) {
      clearTimeout(this.totalTimer)
      this.totalTimer = undefined as any
    }
  }

  clearAllTimers(): void {
    this.clearConnectionTimer()
    this.clearFirstTokenTimer()
    this.clearTotalTimer()
  }

  abort(): void {
    this.clearAllTimers()
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = undefined as any
    }
  }

  isAborted(): boolean {
    return this.abortController?.signal.aborted ?? false
  }

  updateTimeouts(newTimeouts: Partial<TimeoutConfig>): void {
    this.timeouts = { ...this.timeouts, ...newTimeouts }
  }
}

export function createTimeoutController(
  modelName: string,
  modelSize?: string,
  contextLength?: number,
  customTimeouts?: TimeoutOptions
): TimeoutController {
  const baseTimeouts = getTimeouts(customTimeouts)
  const modelTimeouts = getModelSpecificTimeouts(modelName, modelSize, baseTimeouts)
  const finalTimeouts = contextLength 
    ? getContextAdjustedTimeouts(contextLength, modelTimeouts)
    : modelTimeouts
  
  return new TimeoutController(finalTimeouts)
}

export function validateTimeouts(timeouts: Partial<TimeoutConfig>): string[] {
  const errors: string[] = []
  
  if (timeouts.connectionTimeoutMs !== undefined && timeouts.connectionTimeoutMs < 1000) {
    errors.push('Connection timeout must be at least 1000ms')
  }
  
  if (timeouts.firstTokenTimeoutMs !== undefined && timeouts.firstTokenTimeoutMs < 5000) {
    errors.push('First token timeout must be at least 5000ms')
  }
  
  if (timeouts.totalTimeoutMs !== undefined && timeouts.totalTimeoutMs < 10000) {
    errors.push('Total timeout must be at least 10000ms')
  }
  
  if (timeouts.firstTokenTimeoutMs && timeouts.totalTimeoutMs && 
      timeouts.firstTokenTimeoutMs >= timeouts.totalTimeoutMs) {
    errors.push('First token timeout must be less than total timeout')
  }
  
  if (timeouts.modelLoadTimeoutMs !== undefined && timeouts.modelLoadTimeoutMs < 30000) {
    errors.push('Model load timeout must be at least 30000ms')
  }
  
  if (timeouts.modelPullTimeoutMs !== undefined && timeouts.modelPullTimeoutMs < 300000) {
    errors.push('Model pull timeout must be at least 300000ms (5 minutes)')
  }
  
  return errors
}
