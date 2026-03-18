'use client'

import { useState, useEffect } from 'react'
import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { TemplateList } from '@/components/prompts/template-list'
import { TemplateEditor } from '@/components/prompts/template-editor'
import { promptTemplateRepository } from '@/lib/app/persistence/prompt-repository'
import { type PromptTemplate } from '@/lib/db/schema'
import { type PromptVersion } from '@/lib/app/persistence/prompt-repository'

type ViewMode = 'list' | 'create' | 'edit' | 'version' | 'versions'

export default function PromptsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [versions, setVersions] = useState<Record<string, PromptVersion[]>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load templates and versions
  useEffect(() => {
    const loadData = async () => {
      try {
        const [templatesList, categories] = await Promise.all([
          promptTemplateRepository.list({ limit: 100 }),
          promptTemplateRepository.getCategories()
        ])

        setTemplates(templatesList)

        // Load versions for each template
        const versionsData: Record<string, PromptVersion[]> = {}
        for (const template of templatesList) {
          const templateVersions = await promptTemplateRepository.getVersions(template.name)
          versionsData[template.name] = templateVersions
        }
        setVersions(versionsData)
      } catch (error) {
        console.error('Failed to load templates:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const handleCreateNew = () => {
    setSelectedTemplate(null)
    setViewMode('create')
  }

  const handleEdit = (template: PromptTemplate) => {
    setSelectedTemplate(template)
    setViewMode('edit')
  }

  const handleDuplicate = async (template: PromptTemplate) => {
    try {
      const duplicated = await promptTemplateRepository.create({
        name: `${template.name} (Copy)`,
        description: template.description,
        category: template.category,
        template: template.template,
        variables: template.variables,
        isActive: false, // Don't activate duplicates by default
        tags: template.tags,
        usageCount: 0,
        metadata: template.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Refresh the list
      const updatedTemplates = await promptTemplateRepository.list({ limit: 100 })
      setTemplates(updatedTemplates)

      // Edit the new template
      setSelectedTemplate(duplicated)
      setViewMode('edit')
    } catch (error) {
      console.error('Failed to duplicate template:', error)
    }
  }

  const handleActivate = async (templateId: string) => {
    try {
      await promptTemplateRepository.activateVersion(templateId)
      
      // Refresh data
      const updatedTemplates = await promptTemplateRepository.list({ limit: 100 })
      setTemplates(updatedTemplates)

      // Update versions
      const template = templates.find(t => t.id === templateId)
      if (template) {
        const templateVersions = await promptTemplateRepository.getVersions(template.name)
        setVersions(prev => ({
          ...prev,
          [template.name]: templateVersions
        }))
      }
    } catch (error) {
      console.error('Failed to activate template:', error)
    }
  }

  const handleDeprecate = async (templateId: string) => {
    try {
      await promptTemplateRepository.deprecateVersion(templateId)
      
      // Refresh data
      const updatedTemplates = await promptTemplateRepository.list({ limit: 100 })
      setTemplates(updatedTemplates)
    } catch (error) {
      console.error('Failed to deprecate template:', error)
    }
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
      return
    }

    try {
      await promptTemplateRepository.delete(templateId)
      
      // Refresh the list
      const updatedTemplates = await promptTemplateRepository.list({ limit: 100 })
      setTemplates(updatedTemplates)
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  const handleViewVersions = (templateName: string) => {
    console.log('View versions for:', templateName)
    // TODO: Implement versions view
  }

  const handleCompare = (templateId1: string, templateId2: string) => {
    console.log('Compare templates:', templateId1, templateId2)
    // TODO: Implement comparison view
  }

  const handleSave = (template: PromptTemplate) => {
    // Refresh the list and go back to list view
    const refreshData = async () => {
      const updatedTemplates = await promptTemplateRepository.list({ limit: 100 })
      setTemplates(updatedTemplates)

      // Update versions if needed
      const templateVersions = await promptTemplateRepository.getVersions(template.name)
      setVersions(prev => ({
        ...prev,
        [template.name]: templateVersions
      }))
    }

    refreshData()
    setViewMode('list')
  }

  const handleCancel = () => {
    setViewMode('list')
    setSelectedTemplate(null)
  }

  if (isLoading) {
    return (
      <Panel>
        <PanelHeader>
          <PanelTitle>Prompts</PanelTitle>
        </PanelHeader>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading templates...</p>
          </div>
        </div>
      </Panel>
    )
  }

  // Render different views
  if (viewMode === 'create' || viewMode === 'edit' || viewMode === 'version') {
    return (
      <Panel>
        <TemplateEditor
          template={selectedTemplate || undefined}
          onSave={handleSave}
          onCancel={handleCancel}
          mode={viewMode}
        />
      </Panel>
    )
  }

  // Main list view
  return (
    <Panel>
      <TemplateList
        templates={templates}
        versions={versions}
        onCreateNew={handleCreateNew}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onActivate={handleActivate}
        onDeprecate={handleDeprecate}
        onDelete={handleDelete}
        onViewVersions={handleViewVersions}
        onCompare={handleCompare}
      />
    </Panel>
  )
}
