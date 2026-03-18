/**
 * Template List Component
 * 
 * Displays a list of prompt templates with filtering, search, and actions.
 * Supports version management and status controls.
 */

'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { 
  Copy, 
  Edit, 
  MoreHorizontal, 
  Plus, 
  Search, 
  Star, 
  TrendingUp,
  Version,
  Eye,
  GitCompare
} from 'lucide-react'
import { type PromptTemplate } from '@/lib/db/schema'
import { type PromptVersion } from '@/lib/app/persistence/prompt-repository'

interface TemplateListProps {
  templates: PromptTemplate[]
  versions?: Record<string, PromptVersion[]>
  onCreateNew: () => void
  onEdit: (template: PromptTemplate) => void
  onDuplicate: (template: PromptTemplate) => void
  onActivate: (templateId: string) => void
  onDeprecate: (templateId: string) => void
  onDelete: (templateId: string) => void
  onViewVersions: (templateName: string) => void
  onCompare: (templateId1: string, templateId2: string) => void
}

export function TemplateList({
  templates,
  versions = {},
  onCreateNew,
  onEdit,
  onDuplicate,
  onActivate,
  onDeprecate,
  onDelete,
  onViewVersions,
  onCompare
}: TemplateListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('usage')

  // Get unique categories
  const categories = Array.from(new Set(templates.map(t => t.category).filter(Boolean)))

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        template.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory
    const matchesStatus = selectedStatus === 'all' || 
                        (selectedStatus === 'active' && template.isActive) ||
                        (selectedStatus === 'inactive' && !template.isActive)

    return matchesSearch && matchesCategory && matchesStatus
  })

  // Sort templates
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name)
      case 'usage':
        return b.usageCount - a.usageCount
      case 'updated':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'category':
        return a.category.localeCompare(b.category)
      default:
        return 0
    }
  })

  const getStatusBadge = (template: PromptTemplate) => {
    const templateVersions = versions[template.name] || []
    const activeVersion = templateVersions.find(v => v.isActive)
    
    if (activeVersion?.template.id === template.id) {
      return <Badge variant="default" className="bg-green-500">Active</Badge>
    }
    
    const metadata = template.metadata ? JSON.parse(template.metadata) : {}
    if (metadata.deprecated) {
      return <Badge variant="secondary" className="bg-orange-500">Deprecated</Badge>
    }
    
    return <Badge variant="outline">Inactive</Badge>
  }

  const getLastUsed = (template: PromptTemplate) => {
    const templateVersions = versions[template.name] || []
    const version = templateVersions.find(v => v.template.id === template.id)
    
    if (version?.lastUsedAt) {
      return formatDistanceToNow(new Date(version.lastUsedAt), { addSuffix: true })
    }
    
    return 'Never'
  }

  const getVersion = (template: PromptTemplate) => {
    const metadata = template.metadata ? JSON.parse(template.metadata) : {}
    return metadata.version || '1.0.0'
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prompt Templates</h2>
          <p className="text-muted-foreground">
            Manage and version your prompt templates
          </p>
        </div>
        <Button onClick={onCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usage">Usage</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="category">Category</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template Grid */}
      {sortedTemplates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
              <h3 className="text-lg font-semibold">No templates found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first prompt template'
                }
              </p>
              {!searchTerm && selectedCategory === 'all' && selectedStatus === 'all' && (
                <Button onClick={onCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedTemplates.map(template => (
            <Card key={template.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate" title={template.name}>
                      {template.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(template)}
                      <Badge variant="outline" className="text-xs">
                        <Version className="h-3 w-3 mr-1" />
                        {getVersion(template)}
                      </Badge>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(template)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDuplicate(template)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onViewVersions(template.name)}>
                        <GitCompare className="h-4 w-4 mr-2" />
                        View Versions
                      </DropdownMenuItem>
                      {!template.isActive && (
                        <DropdownMenuItem onClick={() => onActivate(template.id)}>
                          <Star className="h-4 w-4 mr-2" />
                          Activate
                        </DropdownMenuItem>
                      )}
                      {template.isActive && (
                        <DropdownMenuItem onClick={() => onDeprecate(template.id)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Deactivate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => onDelete(template.id)}
                        className="text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <CardDescription className="line-clamp-2 mb-3">
                  {template.description || 'No description provided'}
                </CardDescription>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="secondary" className="text-xs">
                      {template.category}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Usage:</span>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      <span className="font-medium">{template.usageCount}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Last used:</span>
                    <span className="text-xs">{getLastUsed(template)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
