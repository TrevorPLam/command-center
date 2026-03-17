/**
 * Index Repository
 * 
 * Handles persistence and management of vector indexes.
 * Supports versioning, reindexing, and lifecycle management.
 */

import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db/client'
import { indexes, documents, chunks } from '@/lib/db/schema'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { 
  VectorIndex, 
  IndexVersion, 
  IndexingOptions,
  IndexStatus,
  IndexType 
} from '@/lib/app/rag/types'

export interface CreateIndexRequest {
  name: string
  type: IndexType
  config: IndexingOptions
  embeddingModel: string
  chunkingPolicy: any
  description?: string
}

export interface UpdateIndexRequest {
  name?: string
  description?: string
  config?: IndexingOptions
}

export interface ReindexRequest {
  indexId: string
  newEmbeddingModel?: string
  newChunkingPolicy?: any
  newIndexingOptions?: IndexingOptions
  preserveOldData?: boolean
}

/**
 * Index repository for database operations
 */
export class IndexRepository {
  /**
   * Create a new index
   */
  static async createIndex(request: CreateIndexRequest): Promise<VectorIndex> {
    const indexId = uuidv4()
    const versionId = uuidv4()
    const now = new Date()
    
    // Create initial version
    const initialVersion: IndexVersion = {
      version: '1.0.0',
      embeddingModel: request.embeddingModel,
      chunkingPolicy: request.chunkingPolicy,
      indexingOptions: request.config,
      createdAt: now,
      chunkCount: 0,
      status: 'building',
      metadata: {
        description: request.description,
        created_by: 'system'
      }
    }
    
    // Insert index record
    await db.insert(indexes).values({
      id: indexId,
      name: request.name,
      type: request.type,
      config: JSON.stringify(request.config),
      status: 'building',
      chunkCount: 0,
      metadata: JSON.stringify({
        description: request.description,
        current_version: versionId,
        versions: [initialVersion]
      }),
      createdAt: now,
      updatedAt: now
    })
    
    // Return complete index object
    return {
      id: indexId,
      name: request.name,
      type: request.type,
      config: request.config,
      currentVersion: initialVersion,
      versions: [initialVersion],
      status: 'building',
      chunkCount: 0,
      sizeBytes: 0,
      createdAt: now,
      updatedAt: now,
      metadata: {
        description: request.description
      }
    }
  }
  
  /**
   * Get index by ID
   */
  static async getIndex(indexId: string): Promise<VectorIndex | null> {
    const index = await db.query.indexes.findFirst({
      where: eq(indexes.id, indexId)
    })
    
    if (!index) {
      return null
    }
    
    const metadata = JSON.parse(index.metadata || '{}')
    const config = JSON.parse(index.config)
    
    return {
      id: index.id,
      name: index.name,
      type: index.type as IndexType,
      config,
      currentVersion: metadata.current_version || {},
      versions: metadata.versions || [],
      status: index.status as IndexStatus,
      chunkCount: index.chunkCount,
      sizeBytes: 0, // Would be calculated from actual storage
      createdAt: index.createdAt,
      updatedAt: index.updatedAt,
      metadata
    }
  }
  
  /**
   * Get all indexes
   */
  static async getAllIndexes(): Promise<VectorIndex[]> {
    const indexRecords = await db.query.indexes.findMany({
      orderBy: [desc(indexes.updatedAt)]
    })
    
    return indexRecords.map(record => {
      const metadata = JSON.parse(record.metadata || '{}')
      const config = JSON.parse(record.config)
      
      return {
        id: record.id,
        name: record.name,
        type: record.type as IndexType,
        config,
        currentVersion: metadata.current_version || {},
        versions: metadata.versions || [],
        status: record.status as IndexStatus,
        chunkCount: record.chunkCount,
        sizeBytes: 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        metadata
      }
    })
  }
  
  /**
   * Update index
   */
  static async updateIndex(indexId: string, request: UpdateIndexRequest): Promise<VectorIndex> {
    const existingIndex = await this.getIndex(indexId)
    if (!existingIndex) {
      throw new Error('Index not found')
    }
    
    const updates: any = {
      updatedAt: new Date()
    }
    
    if (request.name) {
      updates.name = request.name
    }
    
    if (request.config) {
      updates.config = JSON.stringify(request.config)
    }
    
    // Update metadata
    if (request.description) {
      const metadata = { ...existingIndex.metadata, description: request.description }
      updates.metadata = JSON.stringify(metadata)
    }
    
    await db.update(indexes)
      .set(updates)
      .where(eq(indexes.id, indexId))
    
    return await this.getIndex(indexId) as VectorIndex
  }
  
  /**
   * Delete index
   */
  static async deleteIndex(indexId: string): Promise<void> {
    // Check if index exists
    const index = await this.getIndex(indexId)
    if (!index) {
      throw new Error('Index not found')
    }
    
    // Delete associated chunks
    await db.delete(chunks)
      .where(eq(chunks.embeddingId, indexId))
    
    // Delete index record
    await db.delete(indexes)
      .where(eq(indexes.id, indexId))
  }
  
  /**
   * Create new index version
   */
  static async createVersion(
    indexId: string,
    embeddingModel: string,
    chunkingPolicy: any,
    indexingOptions: IndexingOptions
  ): Promise<IndexVersion> {
    const index = await this.getIndex(indexId)
    if (!index) {
      throw new Error('Index not found')
    }
    
    const versionId = uuidv4()
    const now = new Date()
    
    // Generate version number (increment patch version)
    const lastVersion = index.versions[index.versions.length - 1]
    const versionParts = lastVersion.version.split('.')
    const newVersion = `${versionParts[0]}.${versionParts[1]}.${parseInt(versionParts[2]) + 1}`
    
    const newVersion: IndexVersion = {
      version: newVersion,
      embeddingModel,
      chunkingPolicy,
      indexingOptions,
      createdAt: now,
      chunkCount: 0,
      status: 'building',
      metadata: {
        parent_version: lastVersion.version,
        reindex_reason: 'manual'
      }
    }
    
    // Update index metadata
    const updatedVersions = [...index.versions, newVersion]
    const updatedMetadata = {
      ...index.metadata,
      current_version: newVersion,
      versions: updatedVersions
    }
    
    await db.update(indexes)
      .set({
        config: JSON.stringify(indexingOptions),
        metadata: JSON.stringify(updatedMetadata),
        status: 'building',
        updatedAt: now
      })
      .where(eq(indexes.id, indexId))
    
    return newVersion
  }
  
  /**
   * Update index version status
   */
  static async updateVersionStatus(
    indexId: string,
    version: string,
    status: IndexStatus,
    chunkCount?: number
  ): Promise<void> {
    const index = await this.getIndex(indexId)
    if (!index) {
      throw new Error('Index not found')
    }
    
    // Update specific version
    const updatedVersions = index.versions.map(v => 
      v.version === version 
        ? { ...v, status, ...(chunkCount !== undefined && { chunkCount }) }
        : v
    )
    
    // Update current version if it matches
    const currentVersion = index.currentVersion.version === version
      ? { ...index.currentVersion, status, ...(chunkCount !== undefined && { chunkCount }) }
      : index.currentVersion
    
    // Update metadata
    const updatedMetadata = {
      ...index.metadata,
      current_version: currentVersion,
      versions: updatedVersions
    }
    
    // Update index status if current version is updated
    const indexStatus = currentVersion.status
    const totalChunkCount = updatedVersions.reduce((sum, v) => sum + v.chunkCount, 0)
    
    await db.update(indexes)
      .set({
        status: indexStatus,
        chunkCount: totalChunkCount,
        metadata: JSON.stringify(updatedMetadata),
        updatedAt: new Date()
      })
      .where(eq(indexes.id, indexId))
  }
  
  /**
   * Get index statistics
   */
  static async getIndexStats(indexId: string): Promise<{
    totalDocuments: number
    totalChunks: number
    indexedChunks: number
    failedChunks: number
    versions: number
    sizeBytes: number
    lastUpdated: Date
  }> {
    const index = await this.getIndex(indexId)
    if (!index) {
      throw new Error('Index not found')
    }
    
    // Count documents and chunks for this index
    const documentCount = await db.query.documents.findMany()
      .then(docs => docs.length) // Simplified - would filter by index
    
    const chunkCount = await db.query.chunks.findMany()
      .then(chunks => chunks.length) // Simplified - would filter by index
    
    return {
      totalDocuments: documentCount,
      totalChunks: chunkCount,
      indexedChunks: index.chunkCount,
      failedChunks: 0, // Would track failed chunks
      versions: index.versions.length,
      sizeBytes: index.sizeBytes,
      lastUpdated: index.updatedAt
    }
  }
  
  /**
   * Get indexes by status
   */
  static async getIndexesByStatus(status: IndexStatus): Promise<VectorIndex[]> {
    const indexRecords = await db.query.indexes.findMany({
      where: eq(indexes.status, status),
      orderBy: [desc(indexes.updatedAt)]
    })
    
    return indexRecords.map(record => {
      const metadata = JSON.parse(record.metadata || '{}')
      const config = JSON.parse(record.config)
      
      return {
        id: record.id,
        name: record.name,
        type: record.type as IndexType,
        config,
        currentVersion: metadata.current_version || {},
        versions: metadata.versions || [],
        status: record.status as IndexStatus,
        chunkCount: record.chunkCount,
        sizeBytes: 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        metadata
      }
    })
  }
  
  /**
   * Search indexes by name
   */
  static async searchIndexes(query: string): Promise<VectorIndex[]> {
    const indexRecords = await db.query.indexes.findMany({
      where: and(
        // Simplified search - would use full-text search
        indexes.name.like(`%${query}%`)
      ),
      orderBy: [desc(indexes.updatedAt)]
    })
    
    return indexRecords.map(record => {
      const metadata = JSON.parse(record.metadata || '{}')
      const config = JSON.parse(record.config)
      
      return {
        id: record.id,
        name: record.name,
        type: record.type as IndexType,
        config,
        currentVersion: metadata.current_version || {},
        versions: metadata.versions || [],
        status: record.status as IndexStatus,
        chunkCount: record.chunkCount,
        sizeBytes: 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        metadata
      }
    })
  }
  
  /**
   * Get index health check
   */
  static async getIndexHealth(indexId: string): Promise<{
    isHealthy: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const index = await this.getIndex(indexId)
    if (!index) {
      return {
        isHealthy: false,
        issues: ['Index not found'],
        recommendations: ['Create the index']
      }
    }
    
    const issues: string[] = []
    const recommendations: string[] = []
    
    // Check status
    if (index.status === 'error') {
      issues.push('Index is in error state')
      recommendations.push('Check index logs and rebuild if necessary')
    }
    
    if (index.status === 'building') {
      issues.push('Index is still building')
      recommendations.push('Wait for build to complete or check build progress')
    }
    
    // Check chunk count
    if (index.chunkCount === 0) {
      issues.push('No chunks indexed')
      recommendations.push('Add documents to the index')
    }
    
    // Check version consistency
    const hasFailedVersions = index.versions.some(v => v.status === 'error')
    if (hasFailedVersions) {
      issues.push('Some index versions have failed')
      recommendations.push('Review failed versions and consider reindexing')
    }
    
    return {
      isHealthy: issues.length === 0 && index.status === 'ready',
      issues,
      recommendations
    }
  }
}
