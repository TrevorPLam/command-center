/**
 * Prompt Template Server Actions
 * 
 * Server actions for prompt template CRUD operations with versioning support.
 * Provides type-safe operations with validation and error handling.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { promptTemplateRepository, type PromptStatus } from '@/lib/app/persistence/prompt-repository'
import { experimentRepository } from '@/lib/app/persistence/experiment-repository'
import { promptRunRecorder } from '@/lib/app/services/prompt-run-recorder'
import type { NewPromptTemplate } from '@/lib/db/schema'

// Validation schemas
const createPromptSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  category: z.string().min(1).max(100),
  template: z.string().min(1),
  variables: z.string().optional(), // JSON string
  isActive: z.boolean().default(true),
  tags: z.string().optional(), // JSON array string
  metadata: z.string().optional(), // JSON object string
  version: z.string().default('1.0.0')
})

const updatePromptSchema = z.object({
  description: z.string().optional(),
  category: z.string().min(1).max(100).optional(),
  template: z.string().min(1).optional(),
  variables: z.string().optional(),
  isActive: z.boolean().optional(),
  tags: z.string().optional(),
  metadata: z.string().optional()
})

const createVersionSchema = z.object({
  templateId: z.string().uuid(),
  description: z.string().optional(),
  category: z.string().min(1).max(100).optional(),
  template: z.string().min(1).optional(),
  variables: z.string().optional(),
  isActive: z.boolean().default(true),
  tags: z.string().optional(),
  metadata: z.string().optional(),
  version: z.string().min(1)
})

const createExperimentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  config: z.string().optional(), // JSON string
  metadata: z.string().optional() // JSON string
})

// Type definitions
export type CreatePromptInput = z.infer<typeof createPromptSchema>
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>
export type CreateVersionInput = z.infer<typeof createVersionSchema>
export type CreateExperimentInput = z.infer<typeof createExperimentSchema>

/**
 * Create a new prompt template
 */
export async function createPromptTemplate(input: CreatePromptInput) {
  try {
    const validated = createPromptSchema.parse(input)
    
    const templateData: NewPromptTemplate = {
      name: validated.name,
      description: validated.description || '',
      category: validated.category,
      template: validated.template,
      variables: validated.variables || '{}',
      isActive: validated.isActive,
      tags: validated.tags || '[]',
      usageCount: 0,
      metadata: validated.metadata || '{}',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const template = await promptTemplateRepository.createWithVersion(
      templateData,
      validated.version
    )

    revalidatePath('/prompts')
    revalidatePath('/prompts/templates')
    
    return { success: true, data: template }
  } catch (error) {
    console.error('Failed to create prompt template:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Update an existing prompt template
 */
export async function updatePromptTemplate(id: string, input: UpdatePromptInput) {
  try {
    const validated = updatePromptSchema.parse(input)
    
    const template = await promptTemplateRepository.update(id, validated)
    
    if (!template) {
      return { success: false, error: 'Template not found' }
    }

    revalidatePath('/prompts')
    revalidatePath('/prompts/templates')
    revalidatePath(`/prompts/templates/${id}`)
    
    return { success: true, data: template }
  } catch (error) {
    console.error('Failed to update prompt template:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Delete a prompt template
 */
export async function deletePromptTemplate(id: string) {
  try {
    const success = await promptTemplateRepository.delete(id)
    
    if (!success) {
      return { success: false, error: 'Template not found' }
    }

    revalidatePath('/prompts')
    revalidatePath('/prompts/templates')
    
    return { success: true }
  } catch (error) {
    console.error('Failed to delete prompt template:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Create a new version of an existing template
 */
export async function createPromptVersion(input: CreateVersionInput) {
  try {
    const validated = createVersionSchema.parse(input)
    
    const updateData = {
      description: validated.description,
      category: validated.category,
      template: validated.template,
      variables: validated.variables,
      isActive: validated.isActive,
      tags: validated.tags,
      metadata: validated.metadata
    }

    const newVersion = await promptTemplateRepository.createVersion(
      validated.templateId,
      updateData,
      validated.version
    )

    revalidatePath('/prompts')
    revalidatePath('/prompts/templates')
    revalidatePath(`/prompts/templates/${validated.templateId}`)
    
    return { success: true, data: newVersion }
  } catch (error) {
    console.error('Failed to create prompt version:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Activate a specific template version
 */
export async function activatePromptVersion(templateId: string) {
  try {
    const template = await promptTemplateRepository.activateVersion(templateId)
    
    revalidatePath('/prompts')
    revalidatePath('/prompts/templates')
    
    return { success: true, data: template }
  } catch (error) {
    console.error('Failed to activate prompt version:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Deprecate a template version
 */
export async function deprecatePromptVersion(templateId: string) {
  try {
    const template = await promptTemplateRepository.deprecateVersion(templateId)
    
    revalidatePath('/prompts')
    revalidatePath('/prompts/templates')
    
    return { success: true, data: template }
  } catch (error) {
    console.error('Failed to deprecate prompt version:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get all versions of a template
 */
export async function getPromptVersions(name: string) {
  try {
    const versions = await promptTemplateRepository.getVersions(name)
    return { success: true, data: versions }
  } catch (error) {
    console.error('Failed to get prompt versions:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Compare two template versions
 */
export async function comparePromptVersions(templateId1: string, templateId2: string) {
  try {
    const comparison = await promptTemplateRepository.compareVersions(templateId1, templateId2)
    return { success: true, data: comparison }
  } catch (error) {
    console.error('Failed to compare prompt versions:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Create a new experiment
 */
export async function createExperiment(input: CreateExperimentInput) {
  try {
    const validated = createExperimentSchema.parse(input)
    
    const experiment = await experimentRepository.create({
      name: validated.name,
      description: validated.description || '',
      status: 'draft',
      config: validated.config || '{}',
      metadata: validated.metadata || '{}',
      createdAt: new Date(),
      updatedAt: new Date()
    })

    revalidatePath('/prompts')
    revalidatePath('/prompts/experiments')
    
    return { success: true, data: experiment }
  } catch (error) {
    console.error('Failed to create experiment:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Update an experiment
 */
export async function updateExperiment(id: string, input: Partial<CreateExperimentInput>) {
  try {
    const validated = createExperimentSchema.partial().parse(input)
    
    const experiment = await experimentRepository.update(id, {
      name: validated.name,
      description: validated.description,
      config: validated.config ? JSON.parse(validated.config) : undefined,
      metadata: validated.metadata ? JSON.parse(validated.metadata) : undefined
    })
    
    revalidatePath('/prompts')
    revalidatePath('/prompts/experiments')
    revalidatePath(`/prompts/experiments/${id}`)
    
    return { success: true, data: experiment }
  } catch (error) {
    console.error('Failed to update experiment:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Delete an experiment
 */
export async function deleteExperiment(id: string) {
  try {
    await experimentRepository.delete(id)
    
    revalidatePath('/prompts')
    revalidatePath('/prompts/experiments')
    
    return { success: true }
  } catch (error) {
    console.error('Failed to delete experiment:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get experiment summaries with statistics
 */
export async function getExperimentSummaries() {
  try {
    const summaries = await experimentRepository.getSummaries()
    return { success: true, data: summaries }
  } catch (error) {
    console.error('Failed to get experiment summaries:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get template usage statistics
 */
export async function getTemplateUsageStats(templateName?: string, days: number = 30) {
  try {
    const stats = await promptRunRecorder.getTemplateUsageStats(templateName, days)
    return { success: true, data: stats }
  } catch (error) {
    console.error('Failed to get template usage stats:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get template performance trends
 */
export async function getTemplatePerformanceTrends(templateName: string, days: number = 30) {
  try {
    const trends = await promptRunRecorder.getTemplatePerformanceTrends(templateName, days)
    return { success: true, data: trends }
  } catch (error) {
    console.error('Failed to get template performance trends:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
