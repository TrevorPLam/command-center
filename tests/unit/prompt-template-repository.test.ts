/**
 * Unit Tests for Prompt Template Repository
 * 
 * Tests for prompt template CRUD operations, versioning, and comparison.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { promptTemplates } from '@/lib/db/schema'
import { PromptTemplateRepository, type PromptVersion } from '@/lib/app/persistence/prompt-repository'
import type { NewPromptTemplate } from '@/lib/db/schema'

describe('PromptTemplateRepository', () => {
  let repository: PromptTemplateRepository
  let testTemplateIds: string[] = []

  beforeEach(async () => {
    repository = new PromptTemplateRepository()
    // Clean up any existing test data
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  async function cleanupTestData() {
    // Delete test templates
    for (const id of testTemplateIds) {
      try {
        await db.delete(promptTemplates).where(eq(promptTemplates.id, id))
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    testTemplateIds = []
  }

  function createTestTemplate(overrides: Partial<NewPromptTemplate> = {}): NewPromptTemplate {
    return {
      name: `test-template-${Date.now()}`,
      description: 'Test template description',
      category: 'test',
      template: 'Test template content with {{variable}}',
      variables: JSON.stringify({ variable: 'string' }),
      isActive: true,
      tags: JSON.stringify(['test', 'unit']),
      usageCount: 0,
      metadata: JSON.stringify({ version: '1.0.0' }),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    }
  }

  describe('CRUD Operations', () => {
    it('should create a new template', async () => {
      const templateData = createTestTemplate()
      
      const template = await repository.create(templateData)
      
      expect(template).toBeDefined()
      expect(template.id).toBeDefined()
      expect(template.name).toBe(templateData.name)
      expect(template.isActive).toBe(true)
      testTemplateIds.push(template.id)
    })

    it('should create a template with version', async () => {
      const templateData = createTestTemplate()
      const version = '2.1.0'
      
      const template = await repository.createWithVersion(templateData, version)
      
      expect(template).toBeDefined()
      expect(template.metadata).toContain('"version":"2.1.0"')
      testTemplateIds.push(template.id)
    })

    it('should get template by ID', async () => {
      const templateData = createTestTemplate()
      const created = await repository.create(templateData)
      
      const retrieved = await repository.getById(created.id)
      
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.name).toBe(created.name)
      testTemplateIds.push(created.id)
    })

    it('should get template by name', async () => {
      const templateData = createTestTemplate()
      const created = await repository.create(templateData)
      
      const retrieved = await repository.getByName(created.name)
      
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
      testTemplateIds.push(created.id)
    })

    it('should update a template', async () => {
      const templateData = createTestTemplate()
      const created = await repository.create(templateData)
      
      const updated = await repository.update(created.id, {
        description: 'Updated description',
        template: 'Updated template content'
      })
      
      expect(updated).toBeDefined()
      expect(updated?.description).toBe('Updated description')
      expect(updated?.template).toBe('Updated template content')
      testTemplateIds.push(created.id)
    })

    it('should delete a template', async () => {
      const templateData = createTestTemplate()
      const created = await repository.create(templateData)
      
      const deleted = await repository.delete(created.id)
      
      expect(deleted).toBe(true)
      
      const retrieved = await repository.getById(created.id)
      expect(retrieved).toBeNull()
    })

    it('should list templates with filtering', async () => {
      // Create templates with different categories
      const template1 = await repository.create(createTestTemplate({ category: 'chat' }))
      const template2 = await repository.create(createTestTemplate({ category: 'code' }))
      const template3 = await repository.create(createTestTemplate({ category: 'chat', isActive: false }))
      
      testTemplateIds.push(template1.id, template2.id, template3.id)
      
      // Test category filter
      const chatTemplates = await repository.list({ category: 'chat' })
      expect(chatTemplates).toHaveLength(2)
      expect(chatTemplates.every(t => t.category === 'chat')).toBe(true)
      
      // Test active filter
      const activeTemplates = await repository.list({ isActive: true })
      expect(activeTemplates).toHaveLength(2)
      expect(activeTemplates.every(t => t.isActive)).toBe(true)
      
      // Test search
      const searchResults = await repository.list({ search: template1.name })
      expect(searchResults).toHaveLength(1)
      expect(searchResults[0].id).toBe(template1.id)
    })
  })

  describe('Version Management', () => {
    it('should create a new version of existing template', async () => {
      const original = await repository.create(createTestTemplate({
        name: 'version-test-template',
        template: 'Original version content'
      }))
      testTemplateIds.push(original.id)
      
      const newVersion = await repository.createVersion(original.id, {
        template: 'Updated version content',
        description: 'Updated description'
      }, '2.0.0')
      
      expect(newVersion).toBeDefined()
      expect(newVersion.name).toBe(original.name)
      expect(newVersion.template).toBe('Updated version content')
      expect(newVersion.metadata).toContain('"version":"2.0.0"')
      expect(newVersion.metadata).toContain('"parentVersion":"1.0.0"')
      testTemplateIds.push(newVersion.id)
      
      // Original should be deactivated
      const updatedOriginal = await repository.getById(original.id)
      expect(updatedOriginal?.isActive).toBe(false)
    })

    it('should get all versions of a template', async () => {
      const templateName = 'version-list-test'
      
      const v1 = await repository.create(createTestTemplate({
        name: templateName,
        template: 'Version 1 content'
      }))
      const v2 = await repository.createVersion(v1.id, { template: 'Version 2 content' }, '2.0.0')
      const v3 = await repository.createVersion(v2.id, { template: 'Version 3 content' }, '3.0.0')
      
      testTemplateIds.push(v1.id, v2.id, v3.id)
      
      const versions = await repository.getVersions(templateName)
      
      expect(versions).toHaveLength(3)
      expect(versions[0].version).toBe('3.0.0') // Most recent first
      expect(versions[1].version).toBe('2.0.0')
      expect(versions[2].version).toBe('1.0.0')
    })

    it('should get active version of a template', async () => {
      const templateName = 'active-version-test'
      
      const v1 = await repository.create(createTestTemplate({ name: templateName }))
      const v2 = await repository.createVersion(v1.id, { template: 'Version 2 content' }, '2.0.0')
      
      testTemplateIds.push(v1.id, v2.id)
      
      const active = await repository.getActiveVersion(templateName)
      
      expect(active).toBeDefined()
      expect(active?.id).toBe(v2.id)
      expect(active?.isActive).toBe(true)
    })

    it('should activate a specific version', async () => {
      const templateName = 'activate-version-test'
      
      const v1 = await repository.create(createTestTemplate({ name: templateName }))
      const v2 = await repository.createVersion(v1.id, { template: 'Version 2 content' }, '2.0.0')
      const v3 = await repository.createVersion(v2.id, { template: 'Version 3 content' }, '3.0.0')
      
      testTemplateIds.push(v1.id, v2.id, v3.id)
      
      // Activate v1
      const activated = await repository.activateVersion(v1.id)
      
      expect(activated.id).toBe(v1.id)
      expect(activated.isActive).toBe(true)
      
      // Check others are deactivated
      const v1Updated = await repository.getById(v1.id)
      const v2Updated = await repository.getById(v2.id)
      const v3Updated = await repository.getById(v3.id)
      
      expect(v1Updated?.isActive).toBe(true)
      expect(v2Updated?.isActive).toBe(false)
      expect(v3Updated?.isActive).toBe(false)
    })

    it('should deprecate a template version', async () => {
      const template = await repository.create(createTestTemplate())
      testTemplateIds.push(template.id)
      
      const deprecated = await repository.deprecateVersion(template.id)
      
      expect(deprecated.id).toBe(template.id)
      expect(deprecated.isActive).toBe(false)
      
      const metadata = JSON.parse(deprecated.metadata || '{}')
      expect(metadata.deprecated).toBe(true)
    })

    it('should compare two template versions', async () => {
      const templateName = 'compare-test'
      
      const v1 = await repository.create(createTestTemplate({
        name: templateName,
        template: 'Line 1\nLine 2\nLine 3',
        variables: JSON.stringify({ var1: 'string', var2: 'number' })
      }))
      const v2 = await repository.createVersion(v1.id, {
        template: 'Line 1\nLine 2 modified\nLine 3\nLine 4',
        variables: JSON.stringify({ var1: 'string', var3: 'boolean' })
      }, '2.0.0')
      
      testTemplateIds.push(v1.id, v2.id)
      
      const comparison = await repository.compareVersions(v1.id, v2.id)
      
      expect(comparison.version1.id).toBe(v1.id)
      expect(comparison.version2.id).toBe(v2.id)
      
      // Check template diff
      expect(comparison.diff.template.added).toContain('Line 4')
      expect(comparison.diff.template.changed).toHaveLength(1)
      
      // Check variables diff
      expect(comparison.diff.variables.removed).toContain('var2')
      expect(comparison.diff.variables.added).toContain('var3')
    })
  })

  describe('Usage and Analytics', () => {
    it('should increment usage count', async () => {
      const template = await repository.create(createTestTemplate())
      testTemplateIds.push(template.id)
      
      const initialCount = template.usageCount
      
      const success = await repository.incrementUsage(template.id)
      
      expect(success).toBe(true)
      
      const updated = await repository.getById(template.id)
      expect(updated?.usageCount).toBe(initialCount + 1)
    })

    it('should get popular templates', async () => {
      // Create templates with different usage counts
      const template1 = await repository.create(createTestTemplate({ usageCount: 10 }))
      const template2 = await repository.create(createTestTemplate({ usageCount: 25 }))
      const template3 = await repository.create(createTestTemplate({ usageCount: 5 }))
      
      testTemplateIds.push(template1.id, template2.id, template3.id)
      
      const popular = await repository.getPopular(2)
      
      expect(popular).toHaveLength(2)
      expect(popular[0].usageCount).toBe(25) // template2
      expect(popular[1].usageCount).toBe(10) // template1
    })

    it('should get categories with counts', async () => {
      await repository.create(createTestTemplate({ category: 'chat' }))
      await repository.create(createTestTemplate({ category: 'chat' }))
      await repository.create(createTestTemplate({ category: 'code' }))
      
      const categories = await repository.getCategories()
      
      expect(categories).toHaveLength(2)
      expect(categories.find(c => c.category === 'chat')?.count).toBe(2)
      expect(categories.find(c => c.category === 'code')?.count).toBe(1)
    })

    it('should get tags with usage counts', async () => {
      await repository.create(createTestTemplate({
        tags: JSON.stringify(['tag1', 'tag2'])
      }))
      await repository.create(createTestTemplate({
        tags: JSON.stringify(['tag1', 'tag3'])
      }))
      
      const tags = await repository.getTags()
      
      expect(tags.find(t => t.tag === 'tag1')?.count).toBe(2)
      expect(tags.find(t => t.tag === 'tag2')?.count).toBe(1)
      expect(tags.find(t => t.tag === 'tag3')?.count).toBe(1)
    })

    it('should search templates by content', async () => {
      const template1 = await repository.create(createTestTemplate({
        template: 'This contains specific keyword'
      }))
      const template2 = await repository.create(createTestTemplate({
        template: 'This does not contain it'
      }))
      
      testTemplateIds.push(template1.id, template2.id)
      
      const results = await repository.search('specific keyword')
      
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(template1.id)
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent template gracefully', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      
      const template = await repository.getById(nonExistentId)
      expect(template).toBeNull()
      
      const updated = await repository.update(nonExistentId, { description: 'test' })
      expect(updated).toBeNull()
      
      const deleted = await repository.delete(nonExistentId)
      expect(deleted).toBe(false)
    })

    it('should handle version creation for non-existent template', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000'
      
      await expect(
        repository.createVersion(nonExistentId, { template: 'test' }, '2.0.0')
      ).rejects.toThrow('Template not found')
    })

    it('should handle invalid JSON in tags and variables', async () => {
      const template = await repository.create(createTestTemplate({
        tags: 'invalid-json',
        variables: 'also-invalid'
      }))
      testTemplateIds.push(template.id)
      
      // Should not throw when getting tags
      const tags = await repository.getTags()
      expect(tags).toBeDefined()
      
      // Should not throw when getting template
      const retrieved = await repository.getById(template.id)
      expect(retrieved).toBeDefined()
    })
  })
})
