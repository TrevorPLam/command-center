/**
 * Template Editor Component
 * 
 * Form for creating and editing prompt templates with validation.
 * Supports versioning, variables, and metadata management.
 */

'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Eye, Code, FileText } from 'lucide-react'
import { type PromptTemplate } from '@/lib/db/schema'
import { createPromptTemplate, updatePromptTemplate, createPromptVersion } from '@/app/actions/prompts'

// Form validation schema
const templateFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required').max(100, 'Category too long'),
  template: z.string().min(1, 'Template content is required'),
  variables: z.string().optional(),
  isActive: z.boolean().default(true),
  tags: z.string().optional(),
  metadata: z.string().optional(),
  version: z.string().default('1.0.0')
})

type TemplateFormData = z.infer<typeof templateFormSchema>

interface TemplateEditorProps {
  template?: PromptTemplate
  onSave: (template: PromptTemplate) => void
  onCancel: () => void
  mode: 'create' | 'edit' | 'version'
}

const CATEGORIES = [
  'system',
  'user', 
  'shared',
  'chat',
  'rag',
  'agent',
  'evaluation',
  'other'
]

export function TemplateEditor({ template, onSave, onCancel, mode }: TemplateEditorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({})
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      category: template?.category || 'system',
      template: template?.template || '',
      variables: template?.variables || '{}',
      isActive: template?.isActive ?? true,
      tags: template?.tags || '[]',
      metadata: template?.metadata || '{}',
      version: '1.0.0'
    }
  })

  // Initialize tags from template
  useEffect(() => {
    if (template?.tags) {
      try {
        const parsedTags = JSON.parse(template.tags)
        setTags(Array.isArray(parsedTags) ? parsedTags : [])
      } catch (error) {
        console.warn('Failed to parse tags:', error)
      }
    }
  }, [template])

  // Parse variables and set preview values
  useEffect(() => {
    const variablesValue = form.watch('variables')
    try {
      const variables = JSON.parse(variablesValue || '{}')
      const preview: Record<string, string> = {}
      Object.keys(variables).forEach(key => {
        preview[key] = variables[key].default || ''
      })
      setPreviewVariables(preview)
    } catch (error) {
      // Invalid JSON, ignore
    }
  }, [form.watch('variables')])

  const onSubmit = async (data: TemplateFormData) => {
    setIsLoading(true)
    
    try {
      // Update tags in form data
      const formData = {
        ...data,
        tags: JSON.stringify(tags)
      }

      let result
      
      if (mode === 'create') {
        result = await createPromptTemplate(formData)
      } else if (mode === 'edit') {
        result = await updatePromptTemplate(template!.id, formData)
      } else if (mode === 'version') {
        result = await createPromptVersion({
          templateId: template!.id,
          ...formData,
          version: data.version
        })
      }

      if (result.success) {
        onSave(result.data)
      } else {
        console.error('Failed to save template:', result.error)
        // You could show a toast notification here
      }
    } catch (error) {
      console.error('Error saving template:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const renderPreview = () => {
    const templateContent = form.watch('template')
    let preview = templateContent

    // Replace variables with preview values
    Object.entries(previewVariables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      preview = preview.replace(regex, value || `[${key}]`)
    })

    return preview
  }

  const getTitle = () => {
    switch (mode) {
      case 'create':
        return 'Create New Template'
      case 'edit':
        return 'Edit Template'
      case 'version':
        return 'Create New Version'
      default:
        return 'Template Editor'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{getTitle()}</h2>
          <p className="text-muted-foreground">
            {mode === 'version' 
              ? 'Create a new version of an existing template'
              : 'Design your prompt template with variables and metadata'
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={isLoading}>
            {isLoading ? 'Saving...' : mode === 'create' ? 'Create' : mode === 'version' ? 'Create Version' : 'Save'}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>
                  Core details about your prompt template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter template name..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe what this template does..." 
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CATEGORIES.map(category => (
                            <SelectItem key={category} value={category}>
                              {category.charAt(0).toUpperCase() + category.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Template</FormLabel>
                        <FormDescription>
                          Make this the active version (deactivates others)
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {mode === 'version' && (
                  <FormField
                    control={form.control}
                    name="version"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Version</FormLabel>
                        <FormControl>
                          <Input placeholder="1.0.0" {...field} />
                        </FormControl>
                        <FormDescription>
                          Semantic version for this template version
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>
                  Add tags to help organize and find templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  />
                  <Button type="button" onClick={addTag} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Template Content and Variables */}
          <Tabs defaultValue="template" className="space-y-4">
            <TabsList>
              <TabsTrigger value="template" className="gap-2">
                <FileText className="h-4 w-4" />
                Template
              </TabsTrigger>
              <TabsTrigger value="variables" className="gap-2">
                <Code className="h-4 w-4" />
                Variables
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Template Content</CardTitle>
                  <CardDescription>
                    Write your prompt template using {{variable}} syntax
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="template"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            placeholder="You are a helpful AI assistant. {{context}}

{{user_query}}

Please provide a detailed response:"
                            rows={12}
                            className="font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Use double braces to define variables: {{variable_name}}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="variables" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Variables Configuration</CardTitle>
                  <CardDescription>
                    Define variables and their properties as JSON
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="variables"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea 
                            placeholder='{
  "context": {
    "type": "string",
    "description": "Background context for the prompt",
    "required": true,
    "default": ""
  },
  "user_query": {
    "type": "string", 
    "description": "The user's question or request",
    "required": true
  }
}'
                            rows={12}
                            className="font-mono"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          JSON object defining variable types, descriptions, and defaults
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Template Preview</CardTitle>
                  <CardDescription>
                    See how your template looks with sample variable values
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(previewVariables).map(([key, value]) => (
                        <div key={key} className="space-y-2">
                          <Label htmlFor={`preview-${key}`}>{key}</Label>
                          <Input
                            id={`preview-${key}`}
                            value={value}
                            onChange={(e) => setPreviewVariables(prev => ({
                              ...prev,
                              [key]: e.target.value
                            }))}
                            placeholder={`Enter ${key}...`}
                          />
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-6">
                      <Label>Preview Output</Label>
                      <div className="mt-2 p-4 bg-muted rounded-lg">
                        <pre className="whitespace-pre-wrap text-sm font-mono">
                          {renderPreview()}
                        </pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>
      </Form>
    </div>
  )
}
