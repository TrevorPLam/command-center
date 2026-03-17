# Sample Technical Documentation

This is a comprehensive sample markdown document designed to test the ingestion pipeline's ability to handle structured technical content.

## Overview

The Command Center is a locally-operable AI operations console that provides a unified interface for managing multiple AI services and workflows. This document demonstrates various markdown features that the ingestion system should correctly parse and structure.

### Key Features

- **Multi-panel dashboard** with real-time monitoring
- **Streaming chat interface** with conversation history
- **Document ingestion pipeline** with vector search
- **Model management** with routing policies
- **Tool execution sandbox** with approval gates

## Architecture

The system follows a microservices architecture with clear separation of concerns:

### Core Components

#### 1. Runtime Adapter Layer
The runtime adapter provides a unified interface for different AI model providers:

```typescript
export interface RuntimeAdapter {
  id: string
  listModels(): Promise<RuntimeModel[]>
  listRunningModels(): Promise<RuntimeModelState[]>
  chat(req: ChatRequest, signal?: AbortSignal): Promise<ResponseStream>
  embed(req: EmbedRequest, signal?: AbortSignal): Promise<number[][]>
}
```

#### 2. Persistence Layer
SQLite serves as the system of record with the following schema:

- **Conversations** and **Messages** for chat history
- **Documents** and **Chunks** for RAG content
- **Indexes** for vector metadata
- **Jobs** for async operations

#### 3. UI Shell
The React-based interface uses:
- Next.js 15 App Router with parallel routes
- Zustand for state management
- shadcn/ui for components
- Tailwind CSS for styling

## Configuration

### Environment Variables

```bash
# Core Configuration
NODE_ENV=development
OLLAMA_BASE_URL=http://127.0.0.1:11434
DATABASE_URL=./data/command-center.db
LANCEDB_DIR=./data/lancedb
LOG_DIR=./data/logs
```

### Database Schema

The database uses the following core tables:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| conversations | Chat sessions | id, title, modelProfileId |
| messages | Chat messages | id, conversationId, role, content |
| documents | Ingested docs | id, content, metadata, checksum |
| chunks | Text chunks | id, documentId, text, embeddingId |
| indexes | Vector indexes | id, name, type, config, status |

## Usage Examples

### Basic Chat

```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationId: 'conv-123',
    message: 'Hello, AI assistant!',
    modelProfileId: 'gpt-4'
  })
})
```

### Document Upload

```javascript
const formData = new FormData()
formData.append('files', fileInput.files[0])
formData.append('indexId', 'docs-index')
formData.append('chunkingPolicy', JSON.stringify({
  strategy: 'semantic',
  maxChunkSize: 1000,
  chunkOverlap: 200
}))

const response = await fetch('/api/rag/ingest', {
  method: 'POST',
  body: formData
})
```

## Advanced Features

### Context Budgeting

The system implements intelligent context budgeting to manage token limits:

1. **Pinned Instructions** - System prompts and user preferences
2. **Rolling Summary** - Compressed conversation history  
3. **Recent Turns** - Last N messages with full detail
4. **Completion Reserve** - Tokens reserved for response generation

### Model Routing

Automatic model selection based on task requirements:

```typescript
const modelProfile = selectModelProfile({
  task: 'code',
  requiresTools: true,
  outputShape: 'json',
  latencyBudget: 'fast'
})
```

### Structured Output

Enforce JSON schema compliance with automatic retry:

```typescript
const result = await runStructuredTask(modelProfile, schema, prompt)
```

## Troubleshooting

### Common Issues

#### Problem: "Ollama connection failed"
**Solution**: Ensure Ollama is running and accessible at the configured URL.

#### Problem: "Database locked"
**Solution**: Check for other processes using the database file.

#### Problem: "Embedding generation timeout"
**Solution**: Increase timeout values or check model availability.

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug pnpm dev
```

## API Reference

### Chat API

**POST** `/api/chat`

Request body:
```json
{
  "conversationId": "string",
  "message": "string",
  "modelProfileId": "string",
  "stream": true
}
```

### Ingestion API

**POST** `/api/rag/ingest`

Content-Type: `multipart/form-data`

Fields:
- `files`: Document files to upload
- `indexId`: Target index identifier
- `chunkingPolicy`: JSON chunking configuration
- `embeddingModel`: Model for embedding generation

## Performance Considerations

### Memory Usage

- **Large Documents**: Process in chunks to avoid memory spikes
- **Embeddings**: Batch generation for efficiency
- **Vector Search**: Use appropriate index configurations

### Scaling

- **Horizontal**: Multiple worker processes for job processing
- **Vertical**: Increase memory limits for large document sets
- **Storage**: Monitor disk space for vector database growth

## Security Notes

### Data Protection

- All data stored locally by default
- No external API calls without explicit configuration
- File access restricted to configured directories

### Input Validation

- All user inputs validated with Zod schemas
- File uploads scanned for malicious content
- SQL injection protection through parameterized queries

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Run preflight: `pnpm preflight`
4. Start development: `pnpm dev`

### Code Style

- TypeScript strict mode enabled
- ESLint and Prettier configured
- Conventional commits required

### Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# Coverage report
pnpm test:coverage
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Changelog

### v1.0.0 (2024-01-01)

- Initial release
- Core chat functionality
- Document ingestion pipeline
- Model management system
- Basic UI shell

---

*This document serves as a comprehensive test case for the ingestion pipeline, demonstrating proper markdown parsing, section extraction, metadata enrichment, and content structuring capabilities.*
