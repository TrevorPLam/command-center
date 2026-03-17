/**
 * RAG Types and Interfaces
 * 
 * Core type definitions for the Document Ingestion Pipeline and Index Lifecycle.
 * Follows the canonical architecture from the master guide.
 */

export type DocumentContentType = 
  | 'text/plain'
  | 'text/markdown'
  | 'text/csv'
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/json'
  | 'text/html'
  | 'text/javascript'
  | 'text/typescript'
  | 'text/python'
  | 'text/java'
  | 'text/cpp'
  | 'text/csharp'
  | 'text/go'
  | 'text/rust'
  | 'text/sql'

export type DocumentStatus = 
  | 'pending'
  | 'parsing'
  | 'parsed'
  | 'chunking'
  | 'chunked'
  | 'embedding'
  | 'indexed'
  | 'failed'
  | 'deleted'

export type ChunkStrategy = 
  | 'semantic'
  | 'fixed_size'
  | 'recursive'
  | 'document_structure'

export type IndexType = 
  | 'vector'
  | 'keyword'
  | 'hybrid'

export type IndexStatus = 
  | 'building'
  | 'ready'
  | 'error'
  | 'updating'

// ============================================================================
// DOCUMENT MODELS
// ============================================================================

export interface DocumentSection {
  path: string[]           // Section path in document hierarchy
  text: string            // Section text content
  metadata: Record<string, unknown>  // Section-level metadata
  level?: number           // Heading level for structured docs
  title?: string          // Section title if available
}

export interface NormalizedDocument {
  id: string
  sourcePath: string
  contentType: DocumentContentType
  title?: string
  sections: DocumentSection[]
  metadata: Record<string, unknown>
  checksum: string
  size: number
  createdAt: Date
  updatedAt: Date
}

export interface DocumentChunk {
  chunkId: string
  documentId: string
  sectionPath: string[]
  text: string
  metadata: Record<string, unknown>
  chunkIndex: number
  tokenCount: number
  embeddingId?: string
  createdAt: Date
}

export interface IndexedChunk extends DocumentChunk {
  score?: number
  rerankScore?: number
  sourceLabel: string
  citationLabel: string
}

// ============================================================================
// INGESTION MODELS
// ============================================================================

export interface IngestJobConfig {
  sourceType: 'upload' | 'directory_watch' | 'api_import'
  sourcePath: string
  indexingOptions: IndexingOptions
  chunkingPolicy: ChunkingPolicy
  embeddingModel: string
  indexId: string
}

export interface IndexingOptions {
  indexType: IndexType
  vectorIndexConfig?: VectorIndexConfig
  keywordIndexConfig?: KeywordIndexConfig
  metadataFilters?: Record<string, any>
}

export interface VectorIndexConfig {
  metric: 'cosine' | 'euclidean' | 'dotproduct'
  ivfLists?: number
  pq?: number
}

export interface KeywordIndexConfig {
  analyzer: 'standard' | 'keyword' | 'whitespace'
  stopwords?: boolean
}

export interface ChunkingPolicy {
  strategy: ChunkStrategy
  maxChunkSize: number
  chunkOverlap: number
  minChunkSize?: number
  separators?: string[]      // For recursive splitting
  preserveFormatting?: boolean
}

// ============================================================================
// INDEX MODELS
// ============================================================================

export interface IndexVersion {
  version: string
  embeddingModel: string
  chunkingPolicy: ChunkingPolicy
  indexingOptions: IndexingOptions
  createdAt: Date
  chunkCount: number
  status: IndexStatus
  metadata: Record<string, unknown>
}

export interface VectorIndex {
  id: string
  name: string
  type: IndexType
  config: IndexingOptions
  currentVersion: IndexVersion
  versions: IndexVersion[]
  status: IndexStatus
  chunkCount: number
  sizeBytes: number
  createdAt: Date
  updatedAt: Date
  metadata: Record<string, unknown>
}

// ============================================================================
// JOB MODELS
// ============================================================================

export interface IngestJob {
  id: string
  type: 'rag_ingest'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  config: IngestJobConfig
  result?: IngestJobResult
  error?: string
  progress: number           // 0.0 to 1.0
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface IngestJobResult {
  documentsProcessed: number
  documentsSucceeded: number
  documentsFailed: number
  chunksGenerated: number
  embeddingsGenerated: number
  indexVersion: string
  processingTimeMs: number
  errors: string[]
}

// ============================================================================
// RETRIEVAL MODELS
// ============================================================================

export interface RetrievalQuery {
  query: string
  topK: number
  similarityThreshold?: number
  filters?: Record<string, any>
  rerank?: boolean
  includeMetadata?: boolean
}

export interface RetrievalResult {
  chunks: IndexedChunk[]
  queryTime: number
  totalResults: number
  indexVersion: string
  metadata: Record<string, unknown>
}

export interface EvidencePack {
  chunks: IndexedChunk[]
  totalTokens: number
  query: string
  indexVersion: string
  packedAt: Date
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type FileUpload = {
  file: File
  path: string
  checksum: string
}

export type DirectoryWatchConfig = {
  path: string
  patterns: string[]        // Glob patterns for file matching
  ignorePatterns: string[]  // Glob patterns for exclusion
  recursive: boolean
  autoIndex: boolean
}

export type EmbeddingVector = number[]

export interface ParsedDocument {
  content: string
  metadata: Record<string, unknown>
  sections?: DocumentSection[]
  structure?: DocumentStructure
}

export interface DocumentStructure {
  type: 'hierarchical' | 'flat' | 'code'
  elements: DocumentElement[]
}

export interface DocumentElement {
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'table' | 'other'
  content: string
  level?: number           // For headings
  language?: string        // For code blocks
  metadata?: Record<string, unknown>
}
