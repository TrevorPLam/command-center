# Ollama Runtime Integration

This document provides comprehensive information about the Ollama runtime integration in Command Center, including supported model capabilities, failure modes, and troubleshooting guidance.

## Overview

Command Center integrates with Ollama as the primary AI runtime, providing a unified interface for model management, chat completions, embeddings, and diagnostics. The integration follows Ollama's native API endpoints and includes comprehensive error handling, timeout management, and performance monitoring.

## Supported Features

### Core Capabilities

| Feature | Status | Details |
|---------|--------|---------|
| **Model Listing** | ✅ Full | List all installed models with detailed metadata |
| **Model Management** | ✅ Full | Pull, delete, and inspect models |
| **Chat Completions** | ✅ Full | Streaming chat with conversation history |
| **Text Generation** | ✅ Full | Non-chat text generation with streaming |
| **Embeddings** | ✅ Full | Generate embeddings for text inputs |
| **Runtime Health** | ✅ Full | Health checks and diagnostics |
| **Performance Metrics** | ✅ Full | Request tracking and performance monitoring |

### Advanced Features

| Feature | Status | Details |
|---------|--------|---------|
| **JSON Format** | ✅ Full | Structured output with JSON schema |
| **Vision Models** | ✅ Full | Multi-modal models (LLaVA, etc.) |
| **Tool Calling** | ❌ Not Supported | Ollama doesn't support native tool calling |
| **Fine-tuning** | ❌ Not Supported | Requires external tooling |
| **Model Quantization** | ❌ Not Supported | Requires external tooling |

## Model Families and Capabilities

### Supported Model Families

| Family | Chat | Embeddings | Vision | JSON Format | Notes |
|--------|------|------------|--------|-------------|-------|
| **Llama** | ✅ | ❌ | ❌ | ✅ | General purpose, excellent reasoning |
| **Llama 3.1** | ✅ | ❌ | ❌ | ✅ | Latest Llama with improved performance |
| **Code Llama** | ✅ | ❌ | ❌ | ✅ | Specialized for code generation |
| **Qwen** | ✅ | ❌ | ❌ | ✅ | Strong multilingual capabilities |
| **Mixtral** | ✅ | ❌ | ❌ | ✅ | Mixture of experts architecture |
| **Mistral** | ✅ | ❌ | ❌ | ✅ | Efficient and fast |
| **LLaVA** | ✅ | ❌ | ✅ | ✅ | Vision-language model |
| **Embedding Models** | ❌ | ✅ | ❌ | ❌ | Specialized for embeddings |

### Model Size Recommendations

| Parameter Size | RAM Required | Use Case | Performance |
|---------------|-------------|----------|------------|
| **1B-3B** | 2-4GB | Simple tasks, prototyping | Fast, lower quality |
| **7B-8B** | 8-16GB | General purpose, good balance | Good performance |
| **13B-34B** | 16-32GB | Complex reasoning, coding | High quality |
| **65B-70B** | 32-48GB | Maximum quality, complex tasks | Best quality |

## API Endpoints

### Native Ollama Endpoints Used

| Endpoint | Method | Purpose | Timeout |
|----------|--------|---------|---------|
| `/api/tags` | GET | List installed models | 5s |
| `/api/ps` | GET | List running models | 5s |
| `/api/show` | POST | Get model details | 5s |
| `/api/chat` | POST | Chat completion | 30s first token, 5m total |
| `/api/generate` | POST | Text generation | 30s first token, 5m total |
| `/api/embed` | POST | Generate embeddings | 30s |
| `/api/pull` | POST | Pull model | 10m |
| `/api/delete` | DELETE | Delete model | 30s |
| `/api/version` | GET | Get Ollama version | 5s |

### Command Center API Routes

| Route | Method | Purpose | Description |
|-------|--------|---------|-------------|
| `/api/runtime/health` | GET/POST | Runtime health status | Health checks and diagnostics |
| `/api/runtime/models` | GET/POST | Model management | List, pull, delete models |
| `/api/runtime/diagnostics` | GET/POST | Comprehensive diagnostics | System tests and metrics |
| `/api/runtime/snapshots` | GET/POST | Runtime snapshots | Historical data and trends |

## Configuration

### Environment Variables

```bash
# Required
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Optional
NEXT_PUBLIC_BASE_URL=http://localhost:3001
VERBOSE=true  # Enable verbose logging
```

### Timeout Configuration

Default timeouts can be customized per operation:

```typescript
{
  connectionTimeoutMs: 5000,      // Connection establishment
  firstTokenTimeoutMs: 30000,    // First token in chat/generation
  totalTimeoutMs: 300000,        // Total request duration
  modelLoadTimeoutMs: 120000,    // Model loading
  modelPullTimeoutMs: 600000,    // Model pulling
  embeddingTimeoutMs: 30000,      // Embedding generation
  healthCheckTimeoutMs: 10000,   // Health checks
}
```

### Model-Specific Timeouts

Timeouts are automatically adjusted based on model characteristics:

- **Large models (70B+)**: 2x longer timeouts
- **Medium models (13B-34B)**: 1.5x longer timeouts  
- **Small models (1B-8B)**: Standard timeouts
- **Context length**: Additional scaling based on context size

## Error Handling

### Error Taxonomy

| Error Code | Category | Description | Recovery |
|------------|----------|-------------|----------|
| `CONNECTION_FAILED` | Connection | Cannot connect to Ollama | Retry, check Ollama status |
| `CONNECTION_TIMEOUT` | Connection | Connection timed out | Retry with longer timeout |
| `MODEL_NOT_FOUND` | Model | Model doesn't exist | Pull model first |
| `MODEL_LOAD_FAILED` | Model | Failed to load model | Check memory, restart Ollama |
| `REQUEST_TIMEOUT` | Request | Request timed out | Increase timeout, reduce context |
| `FIRST_TOKEN_TIMEOUT` | Request | First token too slow | Use smaller model |
| `TOTAL_TIMEOUT` | Request | Total time exceeded | Reduce context length |
| `RUNTIME_ERROR` | Runtime | Ollama internal error | Check Ollama logs |
| `REQUEST_INVALID` | Request | Invalid parameters | Fix request format |

### Error Recovery Strategies

#### Connection Errors
```typescript
// Automatic retry with exponential backoff
{
  canRetry: true,
  maxRetries: 3,
  backoffMs: 1000,
  userAction: 'Check if Ollama is running and accessible'
}
```

#### Model Errors
```typescript
// Model-specific actions
{
  canRetry: false,
  userAction: 'Pull the model first using ollama pull <model>'
}
```

#### Timeout Errors
```typescript
// Timeout-specific guidance
{
  canRetry: true,
  maxRetries: 1,
  userAction: 'Try a smaller model or increase timeout'
}
```

## Performance Optimization

### Request Optimization

1. **Use Appropriate Models**
   - Small models for simple tasks
   - Large models only when necessary
   - Consider quantization for memory efficiency

2. **Context Management**
   - Keep context length reasonable
   - Use conversation summarization for long chats
   - Clear context when switching topics

3. **Batch Operations**
   - Batch embedding requests when possible
   - Reuse model instances for multiple requests

### Caching Strategy

- **Model Lists**: Cached for 30 seconds
- **Running Models**: Cached for 15 seconds  
- **Capabilities**: Cached for 5 minutes
- **Health Status**: Cached for 10 seconds

### Monitoring Metrics

The system tracks:

- Request count and error rates
- Average latency and response times
- Model usage statistics
- Error type distribution
- Token generation metrics

## Troubleshooting

### Common Issues

#### 1. Connection Refused
**Symptoms**: `ECONNREFUSED` errors, health check failures

**Causes**:
- Ollama not running
- Wrong port or host
- Firewall blocking connection

**Solutions**:
```bash
# Start Ollama
ollama serve

# Check if running
curl http://127.0.0.1:11434/api/tags

# Verify configuration
echo $OLLAMA_BASE_URL
```

#### 2. Model Not Found
**Symptoms**: `MODEL_NOT_FOUND` errors

**Causes**:
- Model not installed
- Incorrect model name
- Model corrupted

**Solutions**:
```bash
# List available models
ollama list

# Pull required model
ollama pull llama3.1:8b

# Verify model name
ollama show llama3.1:8b
```

#### 3. Memory Issues
**Symptoms**: `MODEL_LOAD_FAILED`, system slowdown

**Causes**:
- Insufficient RAM for model
- Too many models running
- Memory fragmentation

**Solutions**:
```bash
# Check running models
ollama ps

# Stop unused models
ollama stop <model>

# Monitor memory usage
free -h
```

#### 4. Timeout Issues
**Symptoms**: `FIRST_TOKEN_TIMEOUT`, `TOTAL_TIMEOUT`

**Causes**:
- Model too large for hardware
- Context length too large
- System under load

**Solutions**:
- Use smaller model
- Reduce context length
- Increase timeout values
- Check system resources

#### 5. Slow Performance
**Symptoms**: High latency, slow responses

**Causes**:
- Insufficient CPU/RAM
- Model loading overhead
- Network latency

**Solutions**:
- Use appropriate model size
- Keep models loaded for frequent use
- Monitor system resources
- Consider model quantization

### Debugging Tools

#### Health Check Script
```bash
# Quick health check
npm run run check-ollama.ts

# Verbose health check  
VERBOSE=true npm run run check-ollama.ts

# Comprehensive smoke tests
npm run run smoke/runtime-smoke.ts
```

#### Diagnostic API
```bash
# Basic diagnostics
curl http://localhost:3001/api/runtime/diagnostics

# Include metrics
curl "http://localhost:3001/api/runtime/diagnostics?metrics=true"

# Run specific test
curl -X POST http://localhost:3001/api/runtime/diagnostics \
  -H "Content-Type: application/json" \
  -d '{"test": "connectivity"}'
```

#### Log Analysis
```bash
# Check Ollama logs
journalctl -u ollama -f

# Check application logs
tail -f logs/command-center.log

# Enable debug logging
DEBUG=* npm run dev
```

## Best Practices

### Model Management

1. **Regular Maintenance**
   - Periodically update models
   - Remove unused models
   - Monitor disk usage

2. **Model Selection**
   - Choose models based on task complexity
   - Consider hardware constraints
   - Test with sample inputs first

3. **Resource Planning**
   - Estimate RAM requirements
   - Plan for concurrent users
   - Monitor system resources

### Application Design

1. **Error Handling**
   - Implement proper error boundaries
   - Provide user-friendly error messages
   - Include recovery suggestions

2. **Performance**
   - Implement request queuing
   - Use appropriate timeouts
   - Monitor and alert on issues

3. **Security**
   - Keep Ollama bound to localhost
   - Validate all inputs
   - Use environment variables for configuration

### Operations

1. **Monitoring**
   - Set up health check alerts
   - Monitor resource usage
   - Track error rates

2. **Backup**
   - Backup model configurations
   - Document custom setups
   - Version control configurations

3. **Scaling**
   - Plan for increased load
   - Consider multiple Ollama instances
   - Implement load balancing

## Version Compatibility

### Ollama Versions

| Version | Status | Notes |
|---------|--------|-------|
| **0.1.x** | ✅ Supported | Basic functionality |
| **0.2.x** | ✅ Supported | Enhanced features |
| **0.3.x** | ✅ Recommended | Latest stable |

### Breaking Changes

- **0.2.0**: Added JSON format support
- **0.3.0**: Improved streaming performance
- **0.4.0**: Enhanced error reporting (upcoming)

## Migration Guide

### From Previous Runtime

If migrating from a different runtime:

1. **Update Configuration**
   ```typescript
   // Old runtime
   const adapter = new OldRuntimeAdapter(config)
   
   // New Ollama runtime
   const adapter = createOllamaAdapter({
     baseUrl: 'http://127.0.0.1:11434'
   })
   ```

2. **Update Model Names**
   ```bash
   # Check available models
   ollama list
   
   # Update model references in code
   ```

3. **Test Integration**
   ```bash
   # Run health check
   npm run check-ollama.ts
   
   # Run smoke tests
   npm run runtime-smoke.ts
   ```

## Support and Resources

### Documentation
- [Ollama Official Documentation](https://github.com/ollama/ollama)
- [Ollama API Reference](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Command Center Runtime Guide](./runtime.md)

### Community
- [Ollama Discord](https://discord.gg/ollama)
- [GitHub Issues](https://github.com/ollama/ollama/issues)
- [Command Center Discussions](https://github.com/your-org/command-center/discussions)

### Troubleshooting
- Check logs for detailed error information
- Use diagnostic tools for systematic testing
- Review configuration and environment setup
- Consult community forums for common issues
