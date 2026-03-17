/**
 * Document Ingestion Dropzone Component
 * 
 * Drag-and-drop interface for uploading documents to the RAG system.
 * Supports multiple file types, progress tracking, and job monitoring.
 */

'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Settings,
  Play,
  Pause
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import { uploadFilesAction } from '@/app/actions/ingestion'
import type { UploadFilesActionResult } from '@/app/actions/ingestion'

interface IngestionDropzoneProps {
  onUploadStart?: (jobId: string) => void
  onUploadComplete?: (result: UploadFilesActionResult) => void
  className?: string
}

interface FileUpload {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

interface ChunkingPolicy {
  strategy: 'semantic' | 'fixed_size' | 'recursive' | 'document_structure'
  maxChunkSize: number
  chunkOverlap: number
  minChunkSize?: number
  preserveFormatting: boolean
}

export function IngestionDropzone({ 
  onUploadStart, 
  onUploadComplete,
  className = '' 
}: IngestionDropzoneProps) {
  const [files, setFiles] = useState<FileUpload[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<string>('default-index')
  const [selectedModel, setSelectedModel] = useState<string>('default-embedding')
  const [chunkingPolicy, setChunkingPolicy] = useState<ChunkingPolicy>({
    strategy: 'semantic',
    maxChunkSize: 1000,
    chunkOverlap: 200,
    minChunkSize: 100,
    preserveFormatting: false
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Mock data for indexes and models
  const indexes = [
    { id: 'default-index', name: 'Default Index' },
    { id: 'docs-index', name: 'Documentation' },
    { id: 'code-index', name: 'Code Repository' }
  ]

  const models = [
    { id: 'default-embedding', name: 'Default Embedding' },
    { id: 'text-embedding-ada-002', name: 'OpenAI Ada-002' },
    { id: 'all-MiniLM-L6-v2', name: 'Sentence Transformers MiniLM' }
  ]

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: FileUpload[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending',
      progress: 0
    }))
    
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.txt', '.md', '.csv'],
      'application/json': ['.json'],
      'text/html': ['.html', '.htm'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/javascript': ['.js', '.jsx'],
      'text/typescript': ['.ts', '.tsx'],
      'text/x-python': ['.py'],
      'text/x-java': ['.java'],
      'text/x-c++': ['.cpp', '.c', '.h'],
      'text/x-csharp': ['.cs'],
      'text/x-go': ['.go'],
      'text/x-rust': ['.rs'],
      'text/x-sql': ['.sql']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10
  })

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const clearAllFiles = () => {
    setFiles([])
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload')
      return
    }

    setIsUploading(true)
    
    // Update all files to uploading status
    setFiles(prev => prev.map(f => ({ 
      ...f, 
      status: 'uploading' as const, 
      progress: 0 
    })))

    try {
      const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'uploading')
      
      const result = await uploadFilesAction({
        files: pendingFiles.map(f => f.file),
        indexId: selectedIndex,
        embeddingModel: selectedModel,
        chunkingPolicy
      })

      if (result.success && result.job) {
        onUploadStart?.(result.job.id)
        
        // Update files to success status
        setFiles(prev => prev.map(f => ({ 
          ...f, 
          status: 'success' as const, 
          progress: 100 
        })))

        toast.success(`Upload started! Job ID: ${result.job.id}`)
        onUploadComplete?.(result)
        
        // Clear files after successful upload
        setTimeout(() => {
          setFiles([])
        }, 2000)
      } else {
        // Update files to error status
        setFiles(prev => prev.map(f => ({ 
          ...f, 
          status: 'error' as const, 
          error: result.error || 'Upload failed'
        })))
        
        toast.error(result.error || 'Upload failed')
      }
    } catch (error) {
      // Update files to error status
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error' as const, 
        error: error instanceof Error ? error.message : 'Upload failed'
      })))
      
      toast.error('Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (status: FileUpload['status']) => {
    switch (status) {
      case 'pending':
        return <File className="h-4 w-4 text-gray-400" />
      case 'uploading':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <File className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium text-gray-700">
            {isDragActive 
              ? 'Drop the files here...' 
              : 'Drag & drop documents here, or click to select'
            }
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Supports: TXT, MD, PDF, DOCX, CSV, JSON, HTML, and code files
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Maximum 10 files, 50MB each
          </p>
        </div>

        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="index">Target Index</Label>
            <Select value={selectedIndex} onValueChange={setSelectedIndex}>
              <SelectTrigger>
                <SelectValue placeholder="Select index" />
              </SelectTrigger>
              <SelectContent>
                {indexes.map(index => (
                  <SelectItem key={index.id} value={index.id}>
                    {index.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Embedding Model</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Advanced Settings</span>
          <Dialog open={showAdvanced} onOpenChange={setShowAdvanced}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Chunking Policy</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="strategy">Strategy</Label>
                  <Select 
                    value={chunkingPolicy.strategy} 
                    onValueChange={(value: any) => setChunkingPolicy(prev => ({ ...prev, strategy: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semantic">Semantic</SelectItem>
                      <SelectItem value="fixed_size">Fixed Size</SelectItem>
                      <SelectItem value="recursive">Recursive</SelectItem>
                      <SelectItem value="document_structure">Document Structure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxChunkSize">Max Chunk Size (tokens)</Label>
                  <Input
                    id="maxChunkSize"
                    type="number"
                    value={chunkingPolicy.maxChunkSize}
                    onChange={(e) => setChunkingPolicy(prev => ({ ...prev, maxChunkSize: parseInt(e.target.value) || 1000 }))}
                    min={100}
                    max={8000}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chunkOverlap">Chunk Overlap (tokens)</Label>
                  <Input
                    id="chunkOverlap"
                    type="number"
                    value={chunkingPolicy.chunkOverlap}
                    onChange={(e) => setChunkingPolicy(prev => ({ ...prev, chunkOverlap: parseInt(e.target.value) || 200 }))}
                    min={0}
                    max={500}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minChunkSize">Min Chunk Size (tokens)</Label>
                  <Input
                    id="minChunkSize"
                    type="number"
                    value={chunkingPolicy.minChunkSize || ''}
                    onChange={(e) => setChunkingPolicy(prev => ({ ...prev, minChunkSize: parseInt(e.target.value) || undefined }))}
                    min={50}
                    max={1000}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="preserveFormatting"
                    checked={chunkingPolicy.preserveFormatting}
                    onCheckedChange={(checked) => setChunkingPolicy(prev => ({ ...prev, preserveFormatting: checked }))}
                  />
                  <Label htmlFor="preserveFormatting">Preserve Formatting</Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Files ({files.length})</Label>
              <Button variant="outline" size="sm" onClick={clearAllFiles}>
                Clear All
              </Button>
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-2">
              {files.map((fileUpload) => (
                <div key={fileUpload.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {getFileIcon(fileUpload.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {fileUpload.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(fileUpload.file.size)}
                    </p>
                    {fileUpload.error && (
                      <p className="text-xs text-red-500 mt-1">
                        {fileUpload.error}
                      </p>
                    )}
                  </div>
                  
                  {fileUpload.status === 'uploading' && (
                    <div className="w-24">
                      <Progress value={fileUpload.progress} className="h-2" />
                    </div>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(fileUpload.id)}
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Button */}
        <Button 
          onClick={handleUpload}
          disabled={files.length === 0 || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
