/**
 * Runtime Adapter Types
 * 
 * Defines the contracts for interacting with AI runtime services (Ollama, etc.)
 * following the canonical architecture from the master guide.
 */

export interface RuntimeModel {
  name: string
  model: string
  modified_at: string
  size: number
  digest: string
  details?: {
    parent_model?: string
    format?: string
    family?: string
    families?: string[]
    parameter_size?: string
    quantization_level?: string
    num_ctx?: number
  }
}

export interface RuntimeModelState {
  name: string
  model: string
  size: number
  digest: string
  details?: {
    parent_model?: string
    format?: string
    family?: string
    families?: string[]
    parameter_size?: string
    quantization_level?: string
    num_ctx?: number
  }
  status: 'running' | 'loading' | 'error'
  expires_at?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
  images?: string[]
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  format?: 'json' | object
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
    repeat_penalty?: number
    repeat_last_n?: number
    num_predict?: number
    num_ctx?: number
    seed?: number
    stop?: string[]
  }
  stream?: boolean
  firstTokenTimeoutMs?: number
  totalTimeoutMs?: number
}

export interface ChatResponse {
  model: string
  created_at: string
  message: ChatMessage
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface EmbedRequest {
  model: string
  input: string | string[]
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
    repeat_penalty?: number
    repeat_last_n?: number
    num_predict?: number
    num_ctx?: number
    seed?: number
    stop?: string[]
  }
  truncate?: boolean
  firstTokenTimeoutMs?: number
  totalTimeoutMs?: number
}

export interface EmbedResponse {
  model: string
  embeddings: number[][]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface GenerateRequest {
  model: string
  prompt: string
  format?: 'json' | object
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
    repeat_penalty?: number
    repeat_last_n?: number
    num_predict?: number
    num_ctx?: number
    seed?: number
    stop?: string[]
  }
  stream?: boolean
  firstTokenTimeoutMs?: number
  totalTimeoutMs?: number
}

export interface GenerateResponse {
  model: string
  created_at: string
  response: string
  done: boolean
  context?: number[]
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export type StreamEvent = 
  | { type: 'token'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool_call'; name: string; input: unknown }
  | { type: 'metrics'; latencyMs: number }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string }

export type ResponseStream = ReadableStream<StreamEvent>

export interface RuntimeAdapter {
  /**
   * List all installed models
   */
  listModels(): Promise<RuntimeModel[]>
  
  /**
   * List currently running models and their states
   */
  listRunningModels(): Promise<RuntimeModelState[]>
  
  /**
   * Stream chat completion
   */
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ResponseStream>
  
  /**
   * Generate embeddings
   */
  embed(req: EmbedRequest, signal?: AbortSignal): Promise<number[][]>
  
  /**
   * Text generation (non-chat)
   */
  generate(req: GenerateRequest, signal?: AbortSignal): Promise<ResponseStream>
  
  /**
   * Pull a model from registry
   */
  pullModel(name: string, signal?: AbortSignal): Promise<ResponseStream>
  
  /**
   * Delete a local model
   */
  deleteModel(name: string): Promise<void>
  
  /**
   * Get detailed model information
   */
  showModel(name: string): Promise<RuntimeModel>
  
  /**
   * Get runtime capabilities
   */
  getCapabilities(): Promise<RuntimeCapabilities>
  
  /**
   * Get runtime health status
   */
  getHealth(): Promise<RuntimeHealth>
}

export interface RuntimeCapabilities {
  supportsChat: boolean
  supportsEmbeddings: boolean
  supportsStreaming: boolean
  supportsJsonFormat: boolean
  supportsToolCalling: boolean
  supportsVision: boolean
  maxContextLength?: number
  supportedFormats?: string[]
}

export interface RuntimeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  latency: number
  uptime: number
  memoryUsage?: number
  modelCount: number
  runningModelCount: number
  lastCheck: string
  errors: string[]
}

export interface RuntimeSnapshot {
  id: string
  timestamp: string
  health: RuntimeHealth
  models: RuntimeModel[]
  runningModels: RuntimeModelState[]
  capabilities: RuntimeCapabilities
  version: string
}

export interface RuntimeMetrics {
  requestCount: number
  errorCount: number
  averageLatency: number
  tokensGenerated: number
  tokensProcessed: number
  modelUsage: Record<string, number>
  errorTypes: Record<string, number>
  timestamp: string
}
