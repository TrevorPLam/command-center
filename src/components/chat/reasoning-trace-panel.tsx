/**
 * Reasoning Trace Panel
 * 
 * Component for displaying thinking traces and reasoning steps
 * with interactive features for analysis and exploration.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Progress } from '../ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { 
  ChevronDown, 
  ChevronRight, 
  Brain, 
  Clock, 
  Target, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react'
import { ReasoningTrace, ReasoningStep, ReasoningMetadata } from '../../lib/app/persistence/reasoning-trace-repository'

interface ReasoningTracePanelProps {
  trace: ReasoningTrace
  isVisible?: boolean
  onToggleVisibility?: () => void
  compact?: boolean
  showMetadata?: boolean
  showAnalytics?: boolean
}

interface StepTypeIcon {
  type: ReasoningStep['type']
  icon: React.ComponentType<{ className?: string }>
  color: string
  label: string
}

const stepTypeIcons: StepTypeIcon[] = [
  { type: 'thought', icon: Brain, color: 'text-blue-500', label: 'Thought' },
  { type: 'analysis', icon: Target, color: 'text-green-500', label: 'Analysis' },
  { type: 'planning', icon: Clock, color: 'text-purple-500', label: 'Planning' },
  { type: 'reflection', icon: Eye, color: 'text-orange-500', label: 'Reflection' },
  { type: 'correction', icon: AlertTriangle, color: 'text-red-500', label: 'Correction' },
]

export function ReasoningTracePanel({
  trace,
  isVisible = true,
  onToggleVisibility,
  compact = false,
  showMetadata = true,
  showAnalytics = false,
}: ReasoningTracePanelProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [showFullTrace, setShowFullTrace] = useState(false)
  const [selectedStep, setSelectedStep] = useState<string | null>(null)

  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(stepId)) {
        newSet.delete(stepId)
      } else {
        newSet.add(stepId)
      }
      return newSet
    })
  }

  const getStepIcon = (type: ReasoningStep['type']) => {
    const stepType = stepTypeIcons.find(st => st.type === type)
    const Icon = stepType?.icon || Brain
    return { Icon, color: stepType?.color || 'text-gray-500', label: stepType?.label || 'Unknown' }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-100 text-green-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const renderReasoningStep = (step: ReasoningStep, index: number) => {
    const { Icon, color, label } = getStepIcon(step.type)
    const isExpanded = expandedSteps.has(step.id)
    const isSelected = selectedStep === step.id

    return (
      <div
        key={step.id}
        className={`border rounded-lg p-3 mb-2 transition-all cursor-pointer hover:bg-gray-50 ${
          isSelected ? 'ring-2 ring-blue-500' : ''
        }`}
        onClick={() => setSelectedStep(isSelected ? null : step.id)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} />
            <span className="text-sm font-medium">{label}</span>
            <Badge variant="outline" className="text-xs">
              Step {index + 1}
            </Badge>
            {step.type === 'correction' && (
              <Badge variant="destructive" className="text-xs">
                Correction
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${getConfidenceColor(step.confidence)}`}>
              {(step.confidence * 100).toFixed(0)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                toggleStepExpansion(step.id)
              }}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <div className="text-sm text-gray-600 mb-2">
          {isExpanded ? step.content : step.content.substring(0, 100) + (step.content.length > 100 ? '...' : '')}
        </div>

        {step.dependencies && step.dependencies.length > 0 && (
          <div className="text-xs text-gray-500">
            Depends on: {step.dependencies.join(', ')}
          </div>
        )}

        <div className="text-xs text-gray-400 mt-1">
          {step.timestamp.toLocaleTimeString()}
        </div>
      </div>
    )
  }

  const renderMetadata = (metadata: ReasoningMetadata) => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
      <div>
        <span className="text-gray-500">Model:</span>
        <div className="font-medium">{metadata.modelId}</div>
        {metadata.modelVersion && (
          <div className="text-xs text-gray-400">v{metadata.modelVersion}</div>
        )}
      </div>
      <div>
        <span className="text-gray-500">Task:</span>
        <div className="font-medium">{metadata.taskType}</div>
        <Badge className={`text-xs mt-1 ${getComplexityColor(metadata.complexity)}`}>
          {metadata.complexity}
        </Badge>
      </div>
      <div>
        <span className="text-gray-500">Performance:</span>
        <div className="font-medium">{formatDuration(metadata.processingTimeMs)}</div>
        <div className="text-xs text-gray-400">{metadata.tokenCount} tokens</div>
      </div>
      <div>
        <span className="text-gray-500">Quality:</span>
        <div className={`font-medium ${getConfidenceColor(metadata.confidence)}`}>
          {(metadata.confidence * 100).toFixed(0)}% confidence
        </div>
        <div className="flex items-center gap-1 mt-1">
          {metadata.isComplete ? (
            <CheckCircle className="h-3 w-3 text-green-500" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-yellow-500" />
          )}
          <span className="text-xs text-gray-400">
            {metadata.isComplete ? 'Complete' : 'Incomplete'}
          </span>
        </div>
      </div>
    </div>
  )

  const renderAnalytics = () => {
    const stepTypes = trace.reasoningSteps.reduce((acc, step) => {
      acc[step.type] = (acc[step.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const avgConfidence = trace.reasoningSteps.reduce((sum, step) => sum + step.confidence, 0) / trace.reasoningSteps.length

    return (
      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Step Distribution</h4>
          <div className="space-y-2">
            {Object.entries(stepTypes).map(([type, count]) => {
              const { Icon, color, label } = getStepIcon(type as ReasoningStep['type'])
              return (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3 w-3 ${color}`} />
                    <span className="text-sm">{label}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {count}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Quality Metrics</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Average Confidence:</span>
              <span className={getConfidenceColor(avgConfidence)}>
                {(avgConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Corrections:</span>
              <span className={trace.metadata.hasCorrections ? 'text-red-600' : 'text-green-600'}>
                {trace.metadata.hasCorrections ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Completion:</span>
              <span className={trace.metadata.isComplete ? 'text-green-600' : 'text-yellow-600'}>
                {trace.metadata.isComplete ? 'Complete' : 'Partial'}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isVisible) {
    return (
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleVisibility}
          className="w-full"
        >
          <Eye className="h-4 w-4 mr-2" />
          Show Reasoning Trace
        </Button>
      </div>
    )
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            Reasoning Trace
          </CardTitle>
          <div className="flex items-center gap-2">
            {trace.metadata.hasCorrections && (
              <Badge variant="destructive" className="text-xs">
                Has Corrections
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleVisibility}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata Section */}
        {showMetadata && (
          <Collapsible open={showAnalytics}>
            <CollapsibleContent className="space-y-4">
              {renderMetadata(trace.metadata)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Analytics Section */}
        {showAnalytics && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Analytics
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              {renderAnalytics()}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Full Trace Toggle */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {trace.reasoningSteps.length} reasoning steps
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullTrace(!showFullTrace)}
          >
            {showFullTrace ? 'Hide' : 'Show'} Full Trace
          </Button>
        </div>

        {/* Reasoning Steps */}
        {showFullTrace && (
          <div className="space-y-2">
            {trace.reasoningSteps.map((step, index) => renderReasoningStep(step, index))}
          </div>
        )}

        {/* Compact View */}
        {!showFullTrace && !compact && (
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="text-sm text-gray-600 mb-2">
              {trace.traceContent.substring(0, 200) + (trace.traceContent.length > 200 ? '...' : '')}
            </div>
            <div className="flex justify-between items-center text-xs text-gray-400">
              <span>{trace.reasoningSteps.length} steps</span>
              <span>{formatDuration(trace.metadata.processingTimeMs)}</span>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Completion Progress</span>
            <span>{trace.metadata.isComplete ? '100%' : 'In Progress'}</span>
          </div>
          <Progress 
            value={trace.metadata.isComplete ? 100 : 75} 
            className="h-2"
          />
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for inline display
export function ReasoningTraceCompact({ trace }: { trace: ReasoningTrace }) {
  return (
    <ReasoningTracePanel
      trace={trace}
      compact={true}
      showMetadata={false}
      showAnalytics={false}
    />
  )
}
