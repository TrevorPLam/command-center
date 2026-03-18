'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { 
  Play, 
  Settings, 
  Zap, 
  Shield, 
  Clock,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { createAgentJob } from '@/app/actions/jobs'
import { listModels } from '@/app/actions/models'

export function AgentExecution() {
  const [isRunning, setIsRunning] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [modelProfileId, setModelProfileId] = useState('')
  const [maxSteps, setMaxSteps] = useState(50)
  const [selectedTools, setSelectedTools] = useState<string[]>([])
  const [requireApproval, setRequireApproval] = useState(false)
  const [enableThinking, setEnableThinking] = useState(true)
  const [models, setModels] = useState<any[]>([])
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  // Load available models
  useState(() => {
    listModels().then(res => {
      if (res.success) {
        setModels(res.models || [])
      }
    })
  })

  const availableTools = [
    { id: 'read-file', name: 'Read File', description: 'Read file contents' },
    { id: 'list-models', name: 'List Models', description: 'List available models' },
    { id: 'query-settings', name: 'Query Settings', description: 'Query system settings' },
    { id: 'get-metrics', name: 'Get Metrics', description: 'Get system metrics' },
    { id: 'index-file', name: 'Index File', description: 'Index a file for search' },
    { id: 'summarize-file', name: 'Summarize File', description: 'Summarize file contents' }
  ]

  const handleExecuteAgent = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    try {
      setIsRunning(true)
      setError(null)
      setResult(null)

      const jobResult = await createAgentJob({
        prompt: prompt.trim(),
        modelProfileId: modelProfileId || undefined,
        maxSteps,
        tools: selectedTools,
        metadata: {
          requireApproval,
          enableThinking,
          tools: selectedTools,
          executedAt: new Date().toISOString()
        }
      })

      if (jobResult.success) {
        setResult({
          jobId: jobResult.job?.id,
          status: 'queued',
          message: 'Agent job queued successfully'
        })
      } else {
        setError(jobResult.error || 'Failed to create agent job')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsRunning(false)
    }
  }

  const toggleTool = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Agent Execution
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Task Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="What would you like the agent to do? For example: 'Read the README.md file and summarize the key points'..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={isRunning}
            />
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Model (Optional)</Label>
            <Select value={modelProfileId} onValueChange={setModelProfileId} disabled={isRunning}>
              <SelectTrigger>
                <SelectValue placeholder="Select a model or use default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Use Default Model</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name} ({model.family})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-steps">Maximum Steps</Label>
              <Input
                id="max-steps"
                type="number"
                min="1"
                max="100"
                value={maxSteps}
                onChange={(e) => setMaxSteps(parseInt(e.target.value) || 50)}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label>Security Settings</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="approval"
                    checked={requireApproval}
                    onCheckedChange={setRequireApproval}
                    disabled={isRunning}
                  />
                  <Label htmlFor="approval" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Require tool approval
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="thinking"
                    checked={enableThinking}
                    onCheckedChange={setEnableThinking}
                    disabled={isRunning}
                  />
                  <Label htmlFor="thinking" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Enable thinking traces
                  </Label>
                </div>
              </div>
            </div>
          </div>

          {/* Tool Selection */}
          <div className="space-y-2">
            <Label>Available Tools</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {availableTools.map((tool) => (
                <div
                  key={tool.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTools.includes(tool.id)
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-accent/50'
                  }`}
                  onClick={() => toggleTool(tool.id)}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`tool-${tool.id}`}
                      checked={selectedTools.includes(tool.id)}
                      onChange={() => {}}
                      className="rounded"
                      aria-label={`Toggle ${tool.name}`}
                    />
                    <Label htmlFor={`tool-${tool.id}`} className="font-medium text-sm cursor-pointer">
                      {tool.name}
                    </Label>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {tool.description}
                  </div>
                </div>
              ))}
            </div>
            {selectedTools.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No tools selected. Agent will have access to all available tools.
              </p>
            )}
          </div>

          {/* Execute Button */}
          <Button 
            onClick={handleExecuteAgent}
            disabled={isRunning || !prompt.trim()}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting Agent...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Agent
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">Error</span>
                </div>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Result Display */}
          {result && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Success</span>
                </div>
                <p className="text-sm text-green-700 mt-1">{result.message}</p>
                {result.jobId && (
                  <div className="mt-2">
                    <Badge variant="outline">
                      Job ID: {result.jobId.slice(0, 8)}...
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Quick Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Examples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrompt('Read the README.md file and summarize the key points')}
              disabled={isRunning}
            >
              File Analysis
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrompt('List all available models and their capabilities')}
              disabled={isRunning}
            >
              Model Inventory
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrompt('Check system settings and metrics, then provide a status report')}
              disabled={isRunning}
            >
              System Status
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrompt('Index the current directory files and create a searchable summary')}
              disabled={isRunning}
            >
              Index Files
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
