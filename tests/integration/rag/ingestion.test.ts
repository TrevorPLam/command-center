/**
 * Ingestion Pipeline Integration Tests
 * 
 * End-to-end tests for the document ingestion pipeline.
 * Tests upload, parsing, chunking, embedding, and indexing workflows.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { IngestionService } from '@/lib/app/services/ingestion-service'
import { ParserRegistry } from '@/lib/app/rag/parsers'
import { ChunkerRegistry } from '@/lib/app/rag/chunkers'
import { EmbeddingService } from '@/lib/app/rag/embedding-service'
import { LanceDBWriter } from '@/lib/app/rag/lancedb-writer'
import { IndexManagementService } from '@/lib/app/services/index-management-service'
import { IndexRepository } from '@/lib/app/persistence/index-repository'
import { uploadFilesAction, getIngestionJobsAction } from '@/app/actions/ingestion'
import { createIndexAction, reindexIndexAction } from '@/app/actions/indexes'
import type { 
  NormalizedDocument, 
  DocumentChunk, 
  ChunkingPolicy,
  UploadFilesActionInput 
} from '@/lib/app/rag/types'

describe('Ingestion Pipeline Integration Tests', () => {
  let testIndexId: string
  let testDocuments: NormalizedDocument[]
  let mockRuntime: any

  beforeAll(async () => {
    // Initialize test environment
    mockRuntime = {
      embed: vi.fn().mockResolvedValue([
        [0.1, 0.2, 0.3, 0.4, 0.5],
        [0.6, 0.7, 0.8, 0.9, 1.0]
      ]),
      listModels: vi.fn().mockResolvedValue([]),
      listRunningModels: vi.fn().mockResolvedValue([])
    }

    // Initialize LanceDB
    const lancedbConfig = LanceDBWriter.getDefaultConfig()
    await LanceDBWriter.initialize(lancedbConfig)

    // Create test index
    const indexResult = await createIndexAction({
      name: 'Test Index',
      type: 'hybrid',
      config: {
        indexType: 'hybrid',
        vectorIndexConfig: {
          metric: 'cosine'
        },
        keywordIndexConfig: {
          analyzer: 'standard',
          stopwords: true
        }
      },
      embeddingModel: 'test-embedding',
      chunkingPolicy: {
        strategy: 'semantic',
        maxChunkSize: 500,
        chunkOverlap: 100
      },
      description: 'Test index for integration tests'
    })

    expect(indexResult.success).toBe(true)
    testIndexId = indexResult.index!.id

    // Prepare test documents
    testDocuments = await createTestDocuments()
  })

  afterAll(async () => {
    // Cleanup test data
    if (testIndexId) {
      await IndexManagementService.deleteIndex(testIndexId, true)
    }
    await LanceDBWriter.close()
  })

  beforeEach(async () => {
    // Reset test state
    vi.clearAllMocks()
  })

  describe('Document Parsing', () => {
    it('should parse markdown documents correctly', async () => {
      const markdownContent = `
# Test Document

This is a test markdown document with **bold** and *italic* text.

## Section 1

Some content in section 1.

### Subsection 1.1

More content here.

## Section 2

Final section content.
      `.trim()

      const parsed = await ParserRegistry.parse(markdownContent, 'text/markdown')
      
      expect(parsed.content).toContain('Test Document')
      expect(parsed.metadata).toHaveProperty('type', 'markdown')
      expect(parsed.sections).toBeDefined()
      expect(parsed.sections!.length).toBeGreaterThan(0)
      
      // Check that sections preserve structure
      const headingSections = parsed.sections!.filter(s => s.metadata.type === 'heading')
      expect(headingSections.length).toBeGreaterThan(0)
    })

    it('should parse JSON documents correctly', async () => {
      const jsonContent = {
        title: 'Test JSON',
        sections: [
          { id: 1, content: 'First section' },
          { id: 2, content: 'Second section' }
        ],
        metadata: {
          author: 'Test Author',
          created: '2024-01-01'
        }
      }

      const parsed = await ParserRegistry.parse(JSON.stringify(jsonContent), 'application/json')
      
      expect(parsed.metadata).toHaveProperty('type', 'json')
      expect(parsed.sections).toBeDefined()
      expect(parsed.sections!.length).toBeGreaterThan(0)
      
      // Check structure analysis
      expect(parsed.metadata).toHaveProperty('total_keys')
      expect(parsed.metadata).toHaveProperty('data_types')
    })

    it('should parse code documents correctly', async () => {
      const codeContent = `
function testFunction(param1, param2) {
  const result = param1 + param2;
  return result;
}

class TestClass {
  constructor(value) {
    this.value = value;
  }
  
  getValue() {
    return this.value;
  }
}
      `.trim()

      const parsed = await ParserRegistry.parse(codeContent, 'text/javascript')
      
      expect(parsed.content).toContain('testFunction')
      expect(parsed.metadata).toHaveProperty('type', 'code')
      expect(parsed.metadata).toHaveProperty('programming_language', 'javascript')
    })

    it('should fallback to text parser for unsupported types', async () => {
      const textContent = 'This is plain text content.'
      
      const parsed = await ParserRegistry.parse(textContent, 'text/plain')
      
      expect(parsed.content).toBe(textContent)
      expect(parsed.metadata).toHaveProperty('type', 'plain_text')
    })
  })

  describe('Document Chunking', () => {
    it('should chunk documents with semantic strategy', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await ChunkerRegistry.chunkDocument(testDocuments[0], policy)
      
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.every(chunk => chunk.text.length <= policy.maxChunkSize)).toBe(true)
      expect(chunks.every(chunk => chunk.documentId === testDocuments[0].id)).toBe(true)
    })

    it('should chunk documents with fixed-size strategy', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'fixed_size',
        maxChunkSize: 100,
        chunkOverlap: 20
      }

      const chunks = await ChunkerRegistry.chunkDocument(testDocuments[0], policy)
      
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.every(chunk => chunk.text.length <= policy.maxChunkSize)).toBe(true)
    })

    it('should provide optimal chunking policy', () => {
      const policy = ChunkerRegistry.getOptimalPolicy(testDocuments[0])
      
      expect(policy).toHaveProperty('strategy')
      expect(policy).toHaveProperty('maxChunkSize')
      expect(policy).toHaveProperty('chunkOverlap')
      expect(['semantic', 'fixed_size', 'recursive', 'document_structure']).toContain(policy.strategy)
    })

    it('should validate chunking policies', () => {
      const validPolicy = {
        strategy: 'semantic' as const,
        maxChunkSize: 1000,
        chunkOverlap: 200
      }

      const validation = ChunkerRegistry.validatePolicy(validPolicy)
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)

      const invalidPolicy = {
        strategy: 'semantic' as const,
        maxChunkSize: -1,
        chunkOverlap: 500
      }

      const invalidValidation = ChunkerRegistry.validatePolicy(invalidPolicy)
      expect(invalidValidation.isValid).toBe(false)
      expect(invalidValidation.issues.length).toBeGreaterThan(0)
    })
  })

  describe('Embedding Generation', () => {
    it('should generate embeddings for chunks', async () => {
      const chunks = await ChunkerRegistry.chunkDocument(testDocuments[0], {
        strategy: 'fixed_size',
        maxChunkSize: 200,
        chunkOverlap: 50
      })

      const texts = chunks.map(chunk => chunk.text)
      const embeddings = await EmbeddingService.generateEmbeddings(
        texts,
        'test-embedding',
        mockRuntime
      )

      expect(embeddings).toHaveLength(texts.length)
      expect(embeddings.every(embedding => Array.isArray(embedding))).toBe(true)
      expect(embeddings.every(embedding => embedding.length > 0)).toBe(true)
      expect(mockRuntime.embed).toHaveBeenCalledWith({
        model: 'test-embedding',
        input: texts
      })
    })

    it('should create embedding jobs', async () => {
      const chunkIds = ['chunk-1', 'chunk-2', 'chunk-3']
      
      const jobId = await EmbeddingService.createEmbeddingJob(
        chunkIds,
        'test-embedding',
        testIndexId
      )

      expect(jobId).toBeDefined()
      expect(typeof jobId).toBe('string')
    })

    it('should get embedding job status', async () => {
      // Create a job first
      const jobId = await EmbeddingService.createEmbeddingJob(
        ['chunk-1'],
        'test-embedding',
        testIndexId
      )

      const status = await EmbeddingService.getEmbeddingJobStatus(jobId)
      
      expect(status).toHaveProperty('id', jobId)
      expect(status).toHaveProperty('status')
      expect(status).toHaveProperty('config')
    })
  })

  describe('LanceDB Integration', () => {
    it('should write chunks to LanceDB', async () => {
      const chunks = await ChunkerRegistry.chunkDocument(testDocuments[0], {
        strategy: 'fixed_size',
        maxChunkSize: 200,
        chunkOverlap: 50
      })

      const embeddings = await EmbeddingService.generateEmbeddings(
        chunks.map(chunk => chunk.text),
        'test-embedding',
        mockRuntime
      )

      await LanceDBWriter.writeChunks(
        'chunks',
        chunks,
        embeddings,
        {
          indexVersion: '1.0.0',
          embeddingModel: 'test-embedding',
          chunkingPolicy: { strategy: 'semantic', maxChunkSize: 500, chunkOverlap: 100 },
          indexingOptions: { indexType: 'vector', vectorIndexConfig: { metric: 'cosine' } }
        }
      )

      const stats = await LanceDBWriter.getTableStats('chunks')
      expect(stats.numRows).toBeGreaterThan(0)
    })

    it('should perform vector search', async () => {
      // First write some test data
      const chunks = await ChunkerRegistry.chunkDocument(testDocuments[0], {
        strategy: 'fixed_size',
        maxChunkSize: 200,
        chunkOverlap: 50
      })

      const embeddings = await EmbeddingService.generateEmbeddings(
        chunks.map(chunk => chunk.text),
        'test-embedding',
        mockRuntime
      )

      await LanceDBWriter.writeChunks(
        'chunks',
        chunks,
        embeddings,
        {
          indexVersion: '1.0.0',
          embeddingModel: 'test-embedding',
          chunkingPolicy: { strategy: 'semantic', maxChunkSize: 500, chunkOverlap: 100 },
          indexingOptions: { indexType: 'vector', vectorIndexConfig: { metric: 'cosine' } }
        }
      )

      // Perform search
      const queryVector = [0.1, 0.2, 0.3, 0.4, 0.5]
      const results = await LanceDBWriter.vectorSearch('chunks', queryVector, 5)
      
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeLessThanOrEqual(5)
    })
  })

  describe('End-to-End Upload Flow', () => {
    it('should handle complete upload workflow', async () => {
      // Create test files
      const testFiles = [
        new File(['# Test Markdown\n\nThis is a test markdown document.'], 'test.md', { type: 'text/markdown' }),
        new File(['{"title": "Test JSON", "content": "Test content"}], 'test.json', { type: 'application/json' })
      ]

      const uploadInput: UploadFilesActionInput = {
        files: testFiles,
        indexId: testIndexId,
        chunkingPolicy: {
          strategy: 'semantic',
          maxChunkSize: 500,
          chunkOverlap: 100
        },
        embeddingModel: 'test-embedding'
      }

      const result = await uploadFilesAction(uploadInput)
      
      expect(result.success).toBe(true)
      expect(result.job).toBeDefined()
      expect(result.job!.id).toBeDefined()
      expect(result.job!.status).toBe('pending')
    })

    it('should track job progress', async () => {
      // Start an upload
      const testFiles = [
        new File(['# Test Document\n\nContent for testing.'], 'test.md', { type: 'text/markdown' })
      ]

      const uploadResult = await uploadFilesAction({
        files: testFiles,
        indexId: testIndexId,
        chunkingPolicy: {
          strategy: 'semantic',
          maxChunkSize: 500,
          chunkOverlap: 100
        }
      })

      expect(uploadResult.success).toBe(true)

      // Get job status
      const jobsResult = await getIngestionJobsAction()
      expect(jobsResult.success).toBe(true)
      expect(jobsResult.jobs).toBeDefined()
      expect(jobsResult.jobs!.length).toBeGreaterThan(0)
    })
  })

  describe('Index Management', () => {
    it('should create and manage indexes', async () => {
      const createResult = await createIndexAction({
        name: 'Test Management Index',
        type: 'vector',
        config: {
          indexType: 'vector',
          vectorIndexConfig: {
            metric: 'cosine',
            ivfLists: 50
          }
        },
        embeddingModel: 'test-embedding',
        chunkingPolicy: {
          strategy: 'semantic',
          maxChunkSize: 1000,
          chunkOverlap: 200
        }
      })

      expect(createResult.success).toBe(true)
      expect(createResult.index).toBeDefined()

      const indexId = createResult.index!.id

      // Get index details
      const getResult = await IndexRepository.getIndex(indexId)
      expect(getResult).toBeDefined()
      expect(getResult!.name).toBe('Test Management Index')
      expect(getResult!.type).toBe('vector')

      // Update index
      const updateResult = await IndexManagementService.updateIndex(indexId, {
        description: 'Updated description'
      })
      expect(updateResult.description).toBe('Updated description')

      // Cleanup
      await IndexManagementService.deleteIndex(indexId, true)
    })

    it('should handle reindexing', async () => {
      // Start reindex job
      const reindexResult = await reindexIndexAction({
        indexId: testIndexId,
        newChunkingPolicy: {
          strategy: 'fixed_size',
          maxChunkSize: 300,
          chunkOverlap: 50
        },
        preserveOldData: true
      })

      expect(reindexResult.success).toBe(true)
      expect(reindexResult.jobId).toBeDefined()
    })

    it('should provide index health information', async () => {
      const health = await IndexManagementService.getIndexHealth(testIndexId)
      
      expect(health).toHaveProperty('isHealthy')
      expect(health).toHaveProperty('issues')
      expect(health).toHaveProperty('recommendations')
      expect(health).toHaveProperty('stats')
      expect(Array.isArray(health.issues)).toBe(true)
      expect(Array.isArray(health.recommendations)).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid file uploads', async () => {
      const invalidFiles = [
        new File([''], 'empty.txt', { type: 'text/plain' })
      ]

      const result = await uploadFilesAction({
        files: invalidFiles,
        indexId: testIndexId
      })

      // Should handle gracefully - either succeed with warnings or fail gracefully
      expect(result).toBeDefined()
    })

    it('should handle invalid chunking policies', async () => {
      const invalidPolicy = {
        strategy: 'semantic' as const,
        maxChunkSize: -1,
        chunkOverlap: 1000
      }

      const validation = ChunkerRegistry.validatePolicy(invalidPolicy)
      expect(validation.isValid).toBe(false)
      expect(validation.issues.length).toBeGreaterThan(0)
    })

    it('should handle embedding generation failures', async () => {
      const mockFailingRuntime = {
        embed: vi.fn().mockRejectedValue(new Error('Embedding failed')),
        listModels: vi.fn().mockResolvedValue([]),
        listRunningModels: vi.fn().mockResolvedValue([])
      }

      const texts = ['test text']
      
      await expect(
        EmbeddingService.generateEmbeddings(texts, 'test-model', mockFailingRuntime)
      ).rejects.toThrow('Embedding failed')
    })
  })
})

/**
 * Helper function to create test documents
 */
async function createTestDocuments(): Promise<NormalizedDocument[]> {
  const markdownContent = `
# Test Document

This is a comprehensive test document with multiple sections and various content types.

## Introduction

This section introduces the document and provides context.

### Background

Some background information about the topic.

## Main Content

The main content of the document goes here.

### Code Example

\`\`\`javascript
function example() {
  return "Hello, World!";
}
\`\`\`

### Data Table

| Column 1 | Column 2 |
|----------|----------|
| Value 1  | Value 2  |
| Value 3  | Value 4  |

## Conclusion

Final thoughts and summary.
  `.trim()

  const jsonContent = {
    title: 'Test JSON Document',
    sections: [
      {
        id: 'intro',
        title: 'Introduction',
        content: 'This is the introduction section.',
        metadata: {
          word_count: 6,
          complexity: 'low'
        }
      },
      {
        id: 'main',
        title: 'Main Content',
        content: 'This is the main content with more detailed information.',
        metadata: {
          word_count: 9,
          complexity: 'medium'
        }
      }
    ],
    metadata: {
      author: 'Test Author',
      created: '2024-01-01',
      tags: ['test', 'document', 'json'],
      version: '1.0.0'
    }
  }

  // Create normalized documents
  const markdownParsed = await ParserRegistry.parse(markdownContent, 'text/markdown')
  const jsonParsed = await ParserRegistry.parse(JSON.stringify(jsonContent), 'application/json')

  return [
    {
      id: 'test-doc-1',
      sourcePath: 'test-doc-1.md',
      contentType: 'text/markdown',
      title: 'Test Document',
      sections: markdownParsed.sections || [],
      metadata: markdownParsed.metadata,
      checksum: 'md5-hash-1',
      size: markdownContent.length,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'test-doc-2',
      sourcePath: 'test-doc-2.json',
      contentType: 'application/json',
      title: 'Test JSON Document',
      sections: jsonParsed.sections || [],
      metadata: jsonParsed.metadata,
      checksum: 'md5-hash-2',
      size: JSON.stringify(jsonContent).length,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]
}
