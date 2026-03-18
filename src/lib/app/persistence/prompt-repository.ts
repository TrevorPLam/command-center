/**
 * Prompt Repository
 * 
 * Repository helpers for prompt templates and runs.
 * Provides typed CRUD operations with usage tracking.
 */

import { eq, and, desc, like, count, sql, max } from 'drizzle-orm'
import { db, withTransaction } from '@/lib/db/client'
import { promptTemplates, promptRuns } from '@/lib/db/schema'
import type { 
  PromptTemplate, 
  NewPromptTemplate, 
  PromptRun, 
  NewPromptRun 
} from '@/lib/db/schema'

export type PromptStatus = 'draft' | 'active' | 'deprecated' | 'archived'

export interface PromptVersion {
  template: PromptTemplate
  version: string
  isActive: boolean
  usageCount: number
  lastUsedAt: Date | null
}

export class PromptTemplateRepository {
  /**
   * Create a new prompt template with versioning
   */
  async createWithVersion(data: NewPromptTemplate, version: string = '1.0.0'): Promise<PromptTemplate> {
    return await withTransaction(async (tx) => {
      const database = tx
      
      // If this is marked as active, deactivate other versions of the same template name
      if (data.isActive) {
        await database
          .update(promptTemplates)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(promptTemplates.name, data.name),
            eq(promptTemplates.isActive, true)
          ))
      }

      // Add version to metadata
      const metadata = data.metadata ? JSON.parse(data.metadata) : {}
      metadata.version = version
      
      const [template] = await database
        .insert(promptTemplates)
        .values({
          ...data,
          metadata: JSON.stringify(metadata)
        })
        .returning()

      return template
    })
  }

  /**
   * Create a new version of an existing template
   */
  async createVersion(templateId: string, newData: Partial<NewPromptTemplate>, newVersion: string): Promise<PromptTemplate> {
    return await withTransaction(async (tx) => {
      const database = tx
      
      // Get the original template
      const original = await database
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.id, templateId))
        .limit(1)

      if (!original[0]) {
        throw new Error('Template not found')
      }

      const template = original[0]
      
      // If new version is active, deactivate all other versions
      if (newData.isActive !== false) {
        await database
          .update(promptTemplates)
          .set({ isActive: false, updatedAt: new Date() })
          .where(and(
            eq(promptTemplates.name, template.name),
            eq(promptTemplates.isActive, true)
          ))
      }

      // Create new version
      const metadata = template.metadata ? JSON.parse(template.metadata) : {}
      metadata.version = newVersion
      metadata.parentVersion = metadata.version
      metadata.createdAt = new Date().toISOString()

      const [newTemplate] = await database
        .insert(promptTemplates)
        .values({
          name: template.name,
          description: newData.description || template.description,
          category: newData.category || template.category,
          template: newData.template || template.template,
          variables: newData.variables || template.variables,
          isActive: newData.isActive !== false, // Default to true
          usageCount: 0, // Reset usage count for new version
          tags: newData.tags || template.tags,
          metadata: JSON.stringify(metadata),
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()

      return newTemplate
    })
  }

  /**
   * Get all versions of a template by name
   */
  async getVersions(name: string): Promise<PromptVersion[]> {
    const database = await db
    const templates = await database
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.name, name))
      .orderBy(desc(promptTemplates.createdAt))

    // Get usage stats for each version
    const versions: PromptVersion[] = []
    for (const template of templates) {
      const metadata = template.metadata ? JSON.parse(template.metadata) : {}
      const version = metadata.version || '1.0.0'
      
      // Get last run date for this template
      const [lastRun] = await database
        .select({ createdAt: promptRuns.createdAt })
        .from(promptRuns)
        .where(eq(promptRuns.templateId, template.id))
        .orderBy(desc(promptRuns.createdAt))
        .limit(1)

      versions.push({
        template,
        version,
        isActive: template.isActive,
        usageCount: template.usageCount,
        lastUsedAt: lastRun?.createdAt ? new Date(lastRun.createdAt) : null
      })
    }

    return versions
  }

  /**
   * Get the active version of a template
   */
  async getActiveVersion(name: string): Promise<PromptTemplate | null> {
    const database = await db
    const [template] = await database
      .select()
      .from(promptTemplates)
      .where(and(
        eq(promptTemplates.name, name),
        eq(promptTemplates.isActive, true)
      ))
      .limit(1)

    return template || null
  }

  /**
   * Activate a specific version and deactivate others
   */
  async activateVersion(templateId: string): Promise<PromptTemplate> {
    return await withTransaction(async (tx) => {
      const database = tx
      
      // Get the template to activate
      const [template] = await database
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.id, templateId))
        .limit(1)

      if (!template) {
        throw new Error('Template not found')
      }

      // Deactivate all versions of this template name
      await database
        .update(promptTemplates)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(promptTemplates.name, template.name))

      // Activate the specified version
      const [activated] = await database
        .update(promptTemplates)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(promptTemplates.id, templateId))
        .returning()

      return activated
    })
  }

  /**
   * Deprecate a template version
   */
  async deprecateVersion(templateId: string): Promise<PromptTemplate> {
    const database = await db
    const [template] = await database
      .update(promptTemplates)
      .set({ 
        isActive: false, 
        updatedAt: new Date(),
        metadata: sql`json_set(${promptTemplates.metadata}, '$.deprecated', true)`
      })
      .where(eq(promptTemplates.id, templateId))
      .returning()

    return template
  }

  /**
   * Compare two versions of a template
   */
  async compareVersions(templateId1: string, templateId2: string): Promise<{
    version1: PromptTemplate
    version2: PromptTemplate
    diff: {
      template: { added: string[]; removed: string[]; changed: string[] }
      variables: { added: string[]; removed: string[]; changed: string[] }
      metadata: Record<string, any>
    }
  }> {
    const database = await db
    const [template1, template2] = await Promise.all([
      database.select().from(promptTemplates).where(eq(promptTemplates.id, templateId1)).limit(1),
      database.select().from(promptTemplates).where(eq(promptTemplates.id, templateId2)).limit(1)
    ])

    if (!template1[0] || !template2[0]) {
      throw new Error('One or both templates not found')
    }

    const t1 = template1[0]
    const t2 = template2[0]

    // Simple diff implementation
    const diff = {
      template: this._computeTextDiff(t1.template || '', t2.template || ''),
      variables: this._computeVariablesDiff(t1.variables || '', t2.variables || ''),
      metadata: {
        version1: t1.metadata ? JSON.parse(t1.metadata) : {},
        version2: t2.metadata ? JSON.parse(t2.metadata) : {}
      }
    }

    return {
      version1: t1,
      version2: t2,
      diff
    }
  }

  /**
   * Get version history for a template
   */
  async getVersionHistory(name: string, limit: number = 10): Promise<PromptVersion[]> {
    const versions = await this.getVersions(name)
    return versions.slice(0, limit)
  }

  /**
   * Create a new prompt template
   */
  async create(data: NewPromptTemplate): Promise<PromptTemplate> {
    const database = await db
    const [template] = await database
      .insert(promptTemplates)
      .values(data)
      .returning()

    return template
  }

  /**
   * Get a prompt template by ID
   */
  async getById(id: string): Promise<PromptTemplate | null> {
    const database = await db
    const [template] = await database
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.id, id))
      .limit(1)

    return template || null
  }

  /**
   * Get a prompt template by name
   */
  async getByName(name: string): Promise<PromptTemplate | null> {
    const database = await db
    const [template] = await database
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.name, name))
      .limit(1)

    return template || null
  }

  /**
   * List prompt templates with filtering
   */
  async list(options: {
    limit?: number
    offset?: number
    category?: string
    tags?: string[]
    isActive?: boolean
    search?: string
  } = {}): Promise<PromptTemplate[]> {
    const { 
      limit = 50, 
      offset = 0, 
      category, 
      tags, 
      isActive = true, 
      search 
    } = options

    const whereConditions = [eq(promptTemplates.isActive, isActive)]
    
    if (category) {
      whereConditions.push(eq(promptTemplates.category, category))
    }
    
    if (search) {
      whereConditions.push(
        and(
          like(promptTemplates.name, `%${search}%`),
          like(promptTemplates.description, `%${search}%`)
        )
      )
    }

    const whereClause = whereConditions.length > 1 
      ? and(...whereConditions) 
      : whereConditions[0]

    const database = await db
    const templates = await database
      .select()
      .from(promptTemplates)
      .where(whereClause)
      .orderBy(desc(promptTemplates.usageCount), promptTemplates.name)
      .limit(limit)
      .offset(offset)

    // Filter by tags if specified (client-side filtering for now)
    if (tags && tags.length > 0) {
      return templates.filter(template => {
        const templateTags = template.tags ? JSON.parse(template.tags) : []
        return tags.some(tag => templateTags.includes(tag))
      })
    }

    return templates
  }

  /**
   * Update a prompt template
   */
  async update(id: string, data: Partial<NewPromptTemplate>): Promise<PromptTemplate | null> {
    const database = await db
    const [template] = await database
      .update(promptTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(promptTemplates.id, id))
      .returning()

    return template || null
  }

  /**
   * Delete a prompt template (cascades to runs)
   */
  async delete(id: string): Promise<boolean> {
    return await withTransaction(async (tx) => {
      // Delete associated runs first
      const database = await tx
      await database
        .delete(promptRuns)
        .where(eq(promptRuns.templateId, id))

      // Delete template
      const result = await database
        .delete(promptTemplates)
        .where(eq(promptTemplates.id, id))

      return result.changes > 0
    })
  }

  /**
   * Increment usage count for a template
   */
  async incrementUsage(id: string): Promise<boolean> {
    const database = await db
    const result = await database
      .update(promptTemplates)
      .set({ 
        usageCount: sql`${promptTemplates.usageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(promptTemplates.id, id))

    return result.changes > 0
  }

  /**
   * Get popular templates by usage
   */
  async getPopular(limit = 10): Promise<PromptTemplate[]> {
    const database = await db
    return await database
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.isActive, true))
      .orderBy(desc(promptTemplates.usageCount))
      .limit(limit)
  }

  /**
   * Get categories with counts
   */
  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    const database = await db
    const results = await database
      .select({ 
        category: promptTemplates.category, 
        count: count() 
      })
      .from(promptTemplates)
      .where(eq(promptTemplates.isActive, true))
      .groupBy(promptTemplates.category)
      .orderBy(promptTemplates.category)

    return results.map(row => ({
      category: row.category,
      count: Number(row.count)
    }))
  }

  /**
   * Get all tags with usage counts
   */
  async getTags(): Promise<Array<{ tag: string; count: number }>> {
    const database = await db
    const templates = await database
      .select({ tags: promptTemplates.tags })
      .from(promptTemplates)
      .where(eq(promptTemplates.isActive, true))

    const tagCounts = new Map<string, number>()
    
    templates.forEach(template => {
      if (template.tags) {
        try {
          const tags = JSON.parse(template.tags) as string[]
          tags.forEach(tag => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
          })
        } catch (error) {
          console.warn('Failed to parse tags for template:', template.tags)
        }
      }
    })

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  }

  /**
   * Search templates by content
   */
  async search(query: string, limit = 20): Promise<PromptTemplate[]> {
    const database = await db
    return await database
      .select()
      .from(promptTemplates)
      .where(
        and(
          eq(promptTemplates.isActive, true),
          like(promptTemplates.template, `%${query}%`)
        )
      )
      .orderBy(desc(promptTemplates.usageCount))
      .limit(limit)
  }

  /**
   * Helper method to compute text diff
   */
  private _computeTextDiff(text1: string, text2: string): { added: string[]; removed: string[]; changed: string[] } {
    const lines1 = text1.split('\n')
    const lines2 = text2.split('\n')
    
    const added: string[] = []
    const removed: string[] = []
    const changed: string[] = []

    // Simple line-by-line comparison
    for (let i = 0; i < Math.max(lines1.length, lines2.length); i++) {
      const line1 = lines1[i] || ''
      const line2 = lines2[i] || ''

      if (line1 === '' && line2 !== '') {
        added.push(line2)
      } else if (line1 !== '' && line2 === '') {
        removed.push(line1)
      } else if (line1 !== line2) {
        changed.push(`"${line1}" → "${line2}"`)
      }
    }

    return { added, removed, changed }
  }

  /**
   * Helper method to compute variables diff
   */
  private _computeVariablesDiff(vars1: string, vars2: string): { added: string[]; removed: string[]; changed: string[] } {
    try {
      const variables1 = vars1 ? JSON.parse(vars1) : {}
      const variables2 = vars2 ? JSON.parse(vars2) : {}

      const keys1 = new Set(Object.keys(variables1))
      const keys2 = new Set(Object.keys(variables2))

      const added = Array.from(keys2).filter(key => !keys1.has(key))
      const removed = Array.from(keys1).filter(key => !keys2.has(key))
      const changed = Array.from(keys1).filter(key => 
        keys2.has(key) && JSON.stringify(variables1[key]) !== JSON.stringify(variables2[key])
      )

      return { added, removed, changed }
    } catch (error) {
      return { added: [], removed: [], changed: ['Failed to parse variables JSON'] }
    }
  }
}

export class PromptRunRepository {
  /**
   * Create a new prompt run
   */
  async create(data: NewPromptRun): Promise<PromptRun> {
    const [run] = await db
      .insert(promptRuns)
      .values(data)
      .returning()

    // Increment template usage count
    if (data.templateId) {
      await db
        .update(promptTemplates)
        .set({ 
          usageCount: sql`${promptTemplates.usageCount} + 1`,
          updatedAt: new Date()
        })
        .where(eq(promptTemplates.id, data.templateId))
    }

    return run
  }

  /**
   * Get a prompt run by ID
   */
  async getById(id: string): Promise<PromptRun | null> {
    const [run] = await db
      .select()
      .from(promptRuns)
      .where(eq(promptRuns.id, id))
      .limit(1)

    return run || null
  }

  /**
   * List prompt runs with filtering
   */
  async list(options: {
    limit?: number
    offset?: number
    templateId?: string
    status?: PromptRun['status']
  } = {}): Promise<PromptRun[]> {
    const { limit = 50, offset = 0, templateId, status } = options

    const whereConditions = []
    
    if (templateId) {
      whereConditions.push(eq(promptRuns.templateId, templateId))
    }
    
    if (status) {
      whereConditions.push(eq(promptRuns.status, status))
    }

    const whereClause = whereConditions.length > 0 
      ? and(...whereConditions) 
      : undefined

    return await db
      .select()
      .from(promptRuns)
      .where(whereClause)
      .orderBy(desc(promptRuns.createdAt))
      .limit(limit)
      .offset(offset)
  }

  /**
   * Get runs for a template
   */
  async getByTemplateId(templateId: string, limit = 10): Promise<PromptRun[]> {
    return await db
      .select()
      .from(promptRuns)
      .where(eq(promptRuns.templateId, templateId))
      .orderBy(desc(promptRuns.createdAt))
      .limit(limit)
  }

  /**
   * Update a prompt run
   */
  async update(id: string, data: Partial<NewPromptRun>): Promise<PromptRun | null> {
    const [run] = await db
      .update(promptRuns)
      .set(data)
      .where(eq(promptRuns.id, id))
      .returning()

    return run || null
  }

  /**
   * Update run status and result
   */
  async updateStatus(
    id: string,
    status: PromptRun['status'],
    result?: any,
    error?: string,
    durationMs?: number,
    tokenCount?: number
  ): Promise<PromptRun | null> {
    const updateData: Partial<NewPromptRun> = { status }

    if (result !== undefined) {
      updateData.result = typeof result === 'string' ? result : JSON.stringify(result)
    }

    if (error) {
      updateData.error = error
    }

    if (durationMs !== undefined) {
      updateData.durationMs = durationMs
    }

    if (tokenCount !== undefined) {
      updateData.tokenCount = tokenCount
    }

    return await this.update(id, updateData)
  }

  /**
   * Delete a prompt run
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(promptRuns)
      .where(eq(promptRuns.id, id))

    return result.changes > 0
  }

  /**
   * Get run statistics
   */
  async getStats(): Promise<{
    total: number
    byStatus: Record<PromptRun['status'], number>
    averageDuration: number
    averageTokenCount: number
    successRate: number
  }> {
    const [statusCounts, stats] = await Promise.all([
      db.select({ 
        status: promptRuns.status, 
        count: count() 
      }).from(promptRuns).groupBy(promptRuns.status),
      db.select({ 
        avgDuration: promptRuns.durationMs,
        avgTokens: promptRuns.tokenCount 
      }).from(promptRuns).where(eq(promptRuns.status, 'completed'))
    ])

    const byStatus = statusCounts.reduce((acc, row) => {
      acc[row.status as PromptRun['status']] = Number(row.count)
      return acc
    }, {} as Record<PromptRun['status'], number>)

    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)
    const averageDuration = stats[0]?.avgDuration ? Number(stats[0].avgDuration) : 0
    const averageTokenCount = stats[0]?.avgTokens ? Number(stats[0].avgTokens) : 0
    const successRate = total > 0 ? (byStatus.completed || 0) / total : 0

    return {
      total,
      byStatus,
      averageDuration,
      averageTokenCount,
      successRate
    }
  }

  /**
   * Clean up old runs
   */
  async cleanup(olderThan: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThan)
    
    const result = await db
      .delete(promptRuns)
      .where(promptRuns.createdAt.lt(cutoffDate))

    return result.changes
  }
}

// Export singleton instances
export const promptTemplateRepository = new PromptTemplateRepository()
export const promptRunRepository = new PromptRunRepository()
