/**
 * Runtime Error Types
 * 
 * Normalized error handling for runtime operations with actionable messages
 * and proper error taxonomy for monitoring and debugging.
 */

export enum RuntimeErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'connection_failed',
  CONNECTION_TIMEOUT = 'connection_timeout',
  CONNECTION_REFUSED = 'connection_refused',
  NETWORK_ERROR = 'network_error',
  
  // Model errors
  MODEL_NOT_FOUND = 'model_not_found',
  MODEL_LOAD_FAILED = 'model_load_failed',
  MODEL_UNLOAD_FAILED = 'model_unload_failed',
  MODEL_PULL_FAILED = 'model_pull_failed',
  MODEL_DELETE_FAILED = 'model_delete_failed',
  MODEL_INVALID_FORMAT = 'model_invalid_format',
  
  // Request errors
  REQUEST_TIMEOUT = 'request_timeout',
  FIRST_TOKEN_TIMEOUT = 'first_token_timeout',
  TOTAL_TIMEOUT = 'total_timeout',
  REQUEST_INVALID = 'request_invalid',
  REQUEST_TOO_LARGE = 'request_too_large',
  
  // Runtime errors
  RUNTIME_ERROR = 'runtime_error',
  RUNTIME_NOT_AVAILABLE = 'runtime_not_available',
  RUNTIME_VERSION_MISMATCH = 'runtime_version_mismatch',
  RUNTIME_RESOURCE_EXHAUSTED = 'runtime_resource_exhausted',
  
  // Response errors
  RESPONSE_INVALID = 'response_invalid',
  RESPONSE_TRUNCATED = 'response_truncated',
  STREAM_ERROR = 'stream_error',
  STREAM_CLOSED = 'stream_closed',
  
  // Configuration errors
  CONFIG_INVALID = 'config_invalid',
  CONFIG_MISSING = 'config_missing',
  ENV_INVALID = 'env_invalid',
  
  // System errors
  SYSTEM_ERROR = 'system_error',
  MEMORY_ERROR = 'memory_error',
  DISK_ERROR = 'disk_error',
  PERMISSION_ERROR = 'permission_error',
  
  // Unknown/unexpected
  UNKNOWN_ERROR = 'unknown_error'
}

export interface RuntimeErrorContext {
  model?: string
  request?: string
  endpoint?: string
  statusCode?: number
  duration?: number
  retryCount?: number
  timestamp?: string
  stack?: string
}

export class RuntimeError extends Error {
  public readonly code: RuntimeErrorCode
  public readonly context: RuntimeErrorContext
  public readonly retryable: boolean
  public readonly userActionable: boolean

  constructor(
    code: RuntimeErrorCode,
    message: string,
    context: RuntimeErrorContext = {},
    retryable = false,
    userActionable = true
  ) {
    super(message)
    this.name = 'RuntimeError'
    this.code = code
    this.context = {
      timestamp: new Date().toISOString(),
      ...context
    }
    this.retryable = retryable
    this.userActionable = userActionable
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RuntimeError)
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      retryable: this.retryable,
      userActionable: this.userActionable,
      stack: this.stack
    }
  }

  static isRuntimeError(error: unknown): error is RuntimeError {
    return error instanceof RuntimeError
  }

  static fromHttpError(
    statusCode: number,
    message: string,
    context: RuntimeErrorContext = {}
  ): RuntimeError {
    switch (statusCode) {
      case 400:
        return new RuntimeError(
          RuntimeErrorCode.REQUEST_INVALID,
          `Invalid request: ${message}`,
          { ...context, statusCode },
          false,
          true
        )
      case 404:
        return new RuntimeError(
          RuntimeErrorCode.MODEL_NOT_FOUND,
          `Model not found: ${message}`,
          { ...context, statusCode },
          false,
          true
        )
      case 429:
        return new RuntimeError(
          RuntimeErrorCode.RUNTIME_RESOURCE_EXHAUSTED,
          `Rate limit exceeded: ${message}`,
          { ...context, statusCode },
          true,
          true
        )
      case 500:
        return new RuntimeError(
          RuntimeErrorCode.RUNTIME_ERROR,
          `Runtime error: ${message}`,
          { ...context, statusCode },
          true,
          false
        )
      case 502:
      case 503:
      case 504:
        return new RuntimeError(
          RuntimeErrorCode.CONNECTION_FAILED,
          `Service unavailable: ${message}`,
          { ...context, statusCode },
          true,
          false
        )
      default:
        return new RuntimeError(
          RuntimeErrorCode.UNKNOWN_ERROR,
          `HTTP ${statusCode}: ${message}`,
          { ...context, statusCode },
          statusCode >= 500,
          statusCode < 500
        )
    }
  }

  static fromNetworkError(
    error: Error,
    context: RuntimeErrorContext = {}
  ): RuntimeError {
    if (error.name === 'AbortError') {
      return new RuntimeError(
        RuntimeErrorCode.REQUEST_TIMEOUT,
        'Request was aborted',
        context,
        false,
        true
      )
    }
    
    if (error.message.includes('ECONNREFUSED')) {
      return new RuntimeError(
        RuntimeErrorCode.CONNECTION_REFUSED,
        'Connection refused - is the runtime running?',
        context,
        true,
        true
      )
    }
    
    if (error.message.includes('ETIMEDOUT')) {
      return new RuntimeError(
        RuntimeErrorCode.CONNECTION_TIMEOUT,
        'Connection timed out',
        context,
        true,
        true
      )
    }
    
    return new RuntimeError(
      RuntimeErrorCode.NETWORK_ERROR,
      `Network error: ${error.message}`,
      { ...context, stack: error.stack },
      true,
      false
    )
  }

  static fromTimeout(
    type: 'first_token' | 'total',
    duration: number,
    context: RuntimeErrorContext = {}
  ): RuntimeError {
    const code = type === 'first_token' 
      ? RuntimeErrorCode.FIRST_TOKEN_TIMEOUT 
      : RuntimeErrorCode.TOTAL_TIMEOUT
    
    return new RuntimeError(
      code,
      `${type.replace('_', ' ')} timeout after ${duration}ms`,
      { ...context, duration },
      false,
      true
    )
  }

  static fromValidationError(
    field: string,
    value: unknown,
    expected: string,
    context: RuntimeErrorContext = {}
  ): RuntimeError {
    return new RuntimeError(
      RuntimeErrorCode.REQUEST_INVALID,
      `Invalid ${field}: expected ${expected}, got ${typeof value}`,
      { ...context, request: `${field}=${JSON.stringify(value)}` },
      false,
      true
    )
  }
}

export interface ErrorRecoveryStrategy {
  canRetry: boolean
  maxRetries: number
  backoffMs: number
  userAction?: string
  automaticAction?: string
}

export function getErrorRecoveryStrategy(error: RuntimeError): ErrorRecoveryStrategy {
  switch (error.code) {
    case RuntimeErrorCode.CONNECTION_FAILED:
    case RuntimeErrorCode.CONNECTION_TIMEOUT:
    case RuntimeErrorCode.NETWORK_ERROR:
      return {
        canRetry: true,
        maxRetries: 3,
        backoffMs: 1000,
        userAction: 'Check if Ollama is running and accessible',
        automaticAction: 'Retry connection with exponential backoff'
      }
    
    case RuntimeErrorCode.MODEL_LOAD_FAILED:
      return {
        canRetry: true,
        maxRetries: 2,
        backoffMs: 2000,
        userAction: 'Check available memory and disk space',
        automaticAction: 'Retry model loading'
      }
    
    case RuntimeErrorCode.FIRST_TOKEN_TIMEOUT:
      return {
        canRetry: true,
        maxRetries: 1,
        backoffMs: 500,
        userAction: 'Try a smaller model or increase timeout',
        automaticAction: 'Retry with longer timeout'
      }
    
    case RuntimeErrorCode.TOTAL_TIMEOUT:
      return {
        canRetry: false,
        maxRetries: 0,
        backoffMs: 0,
        userAction: 'Reduce context length or use smaller model',
        automaticAction: undefined
      }
    
    case RuntimeErrorCode.MODEL_NOT_FOUND:
      return {
        canRetry: false,
        maxRetries: 0,
        backoffMs: 0,
        userAction: 'Pull the model first using ollama pull',
        automaticAction: undefined
      }
    
    case RuntimeErrorCode.REQUEST_INVALID:
      return {
        canRetry: false,
        maxRetries: 0,
        backoffMs: 0,
        userAction: 'Check request format and parameters',
        automaticAction: undefined
      }
    
    case RuntimeErrorCode.RUNTIME_RESOURCE_EXHAUSTED:
      return {
        canRetry: true,
        maxRetries: 2,
        backoffMs: 5000,
        userAction: 'Free up system resources or use smaller model',
        automaticAction: 'Wait and retry'
      }
    
    default:
      return {
        canRetry: error.retryable,
        maxRetries: error.retryable ? 1 : 0,
        backoffMs: 1000,
        userAction: error.userActionable ? 'Check runtime logs and configuration' : 'Contact support',
        automaticAction: error.retryable ? 'Retry once' : undefined
      }
  }
}

export function formatErrorForUser(error: RuntimeError): string {
  const strategy = getErrorRecoveryStrategy(error)
  
  let message = error.message
  
  if (strategy.userAction) {
    message += `\n\nSuggested action: ${strategy.userAction}`
  }
  
  if (strategy.canRetry && strategy.maxRetries > 0) {
    message += `\n\nThis error can be retried automatically (${strategy.maxRetries} attempts remaining).`
  }
  
  return message
}

export function isRetryableError(error: unknown): boolean {
  if (!RuntimeError.isRuntimeError(error)) {
    return false
  }
  
  return getErrorRecoveryStrategy(error).canRetry
}

export function shouldLogError(error: RuntimeError): boolean {
  // Don't log expected user errors
  const userErrors = [
    RuntimeErrorCode.REQUEST_INVALID,
    RuntimeErrorCode.MODEL_NOT_FOUND,
    RuntimeErrorCode.FIRST_TOKEN_TIMEOUT,
    RuntimeErrorCode.TOTAL_TIMEOUT
  ]
  
  return !userErrors.includes(error.code)
}
