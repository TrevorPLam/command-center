/**
 * Context Usage Indicator Component
 * 
 * Displays context window usage, warnings, and optimization recommendations
 * for the current conversation. Integrates with the context budgeting service.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { 
  AlertTriangle, 
  BarChart3, 
  Cpu, 
  Zap, 
  Info,
  TrendingUp,
  Clock,
  MessageSquare
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { 
  BudgetPlan,
  contextBudgetService 
} from '@/lib/app/services/context-budget-service'
import { 
  ModelSwitchPlan,
  modelSwitchCompressionService 
} from '@/lib/app/services/model-switch-compression-service'
import { useCurrentConversation } from '@/stores/use-chat-store'
import { toast } from 'sonner'

interface ContextUsageIndicatorProps {
  className?: string
  model: string
  conversationId?: string
  showDetails?: boolean
  onModelSwitch?: (newModel: string) => void
}

export function ContextUsageIndicator({ 
  className, 
  model, 
  conversationId,
  showDetails = false,
  onModelSwitch 
}: ContextUsageIndicatorProps) {
  const currentConversation = useCurrentConversation()
  const targetConversationId = conversationId || currentConversation?.id
  
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(null)
  const [modelSwitchPlan, setModelSwitchPlan] = useState<ModelSwitchPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load context information
  useEffect(() => {
    if (!targetConversationId || !model) return

    loadContextInfo()
  }, [targetConversationId, model])

  const loadContextInfo = async () => {
    if (!targetConversationId || !model) return

    setLoading(true)
    setError(null)

    try {
      // Load budget plan
      const budget = await contextBudgetService.getContextBudgetInfo(targetConversationId, model)
      setBudgetPlan(budget)

      // Load model switch recommendation
      const switchPlan = await contextBudgetService.getModelSwitchRecommendation(targetConversationId, model)
      setModelSwitchPlan(switchPlan)
    } catch (err) {
      console.error('Failed to load context info:', err)
      setError(err instanceof Error ? err.message : 'Failed to load context information')
    } finally {
      setLoading(false)
    }
  }

  const getUsageColor = (usageRatio: number) => {
    if (usageRatio >= 0.9) return 'text-red-600'
    if (usageRatio >= 0.8) return 'text-orange-600'
    if (usageRatio >= 0.6) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getProgressColor = (usageRatio: number) => {
    if (usageRatio >= 0.9) return 'bg-red-500'
    if (usageRatio >= 0.8) return 'bg-orange-500'
    if (usageRatio >= 0.6) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const handleModelSwitch = (newModel: string) => {
    if (onModelSwitch) {
      onModelSwitch(newModel)
      toast.success(`Switching to ${newModel} for better context handling`)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <Cpu className="h-4 w-4 animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading context info...</span>
      </div>
    )
  }

  if (error || !budgetPlan) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-500">Context info unavailable</span>
      </div>
    )
  }

  const usageRatio = budgetPlan.contextWindow.totalTokenCount / budgetPlan.budget.maxTokens
  const usageColor = getUsageColor(usageRatio)
  const progressColor = getProgressColor(usageRatio)

  return (
    <TooltipProvider>
      <div className={`space-y-2 ${className}`}>
        {/* Main usage indicator */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <BarChart3 className={`h-4 w-4 ${usageColor}`} />
            <span className="text-sm font-medium">Context</span>
          </div>
          
          <div className="flex-1 max-w-32">
            <Progress 
              value={usageRatio * 100} 
              className="h-2"
              // @ts-ignore - dynamic className
              indicatorClassName={progressColor}
            />
          </div>
          
          <Tooltip>
            <TooltipTrigger>
              <span className={`text-sm font-mono ${usageColor}`}>
                {Math.round(usageRatio * 100)}%
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <div>Used: {budgetPlan.contextWindow.totalTokenCount.toLocaleString()} tokens</div>
                <div>Limit: {budgetPlan.budget.maxTokens.toLocaleString()} tokens</div>
                <div>Available: {budgetPlan.budget.availableTokens.toLocaleString()} tokens</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Warnings and recommendations */}
        {budgetPlan.warnings.length > 0 && (
          <Alert className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {budgetPlan.warnings[0]}
            </AlertDescription>
          </Alert>
        )}

        {/* Model switch recommendation */}
        {modelSwitchPlan && modelSwitchPlan.recommendedModel !== model && (
          <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <div className="text-xs">
                <div className="font-medium">Switch to {modelSwitchPlan.recommendedModel}</div>
                <div className="text-muted-foreground">{modelSwitchPlan.reason}</div>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleModelSwitch(modelSwitchPlan.recommendedModel)}
            >
              Switch
            </Button>
          </div>
        )}

        {/* Detailed information */}
        {showDetails && (
          <div className="space-y-3 p-3 bg-muted rounded-lg">
            {/* Token breakdown */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4" />
                <span className="text-sm font-medium">Token Breakdown</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>System:</span>
                  <span>{budgetPlan.budget.currentUsage.system.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>User:</span>
                  <span>{budgetPlan.budget.currentUsage.user.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Assistant:</span>
                  <span>{budgetPlan.budget.currentUsage.assistant.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Metadata:</span>
                  <span>{budgetPlan.budget.currentUsage.metadata.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Context window info */}
            {budgetPlan.contextWindow.summary && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Info className="h-4 w-4" />
                  <span className="text-sm font-medium">Summary</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <div>Messages summarized: {budgetPlan.contextWindow.messages.length}</div>
                  <div>Summary tokens: {budgetPlan.contextWindow.summaryTokenCount.toLocaleString()}</div>
                  <div>Compression: {budgetPlan.contextWindow.compressionStrategy}</div>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {budgetPlan.recommendations.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Recommendations</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {budgetPlan.recommendations.map((rec, index) => (
                    <li key={index}>• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Performance impact */}
            {modelSwitchPlan && modelSwitchPlan.recommendedModel !== model && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Cpu className="h-4 w-4" />
                  <span className="text-sm font-medium">Performance Impact</span>
                </div>
                <div className="flex items-center space-x-4 text-xs">
                  <Badge variant={modelSwitchPlan.performanceImpact.speed === 'faster' ? 'default' : 'secondary'}>
                    Speed: {modelSwitchPlan.performanceImpact.speed}
                  </Badge>
                  <Badge variant={modelSwitchPlan.performanceImpact.quality === 'higher' ? 'default' : 'secondary'}>
                    Quality: {modelSwitchPlan.performanceImpact.quality}
                  </Badge>
                  <Badge variant={modelSwitchPlan.performanceImpact.reliability === 'higher' ? 'default' : 'secondary'}>
                    Reliability: {modelSwitchPlan.performanceImpact.reliability}
                  </Badge>
                </div>
                {modelSwitchPlan.costComparison.savings > 0 && (
                  <div className="text-xs text-green-600">
                    Cost savings: {Math.round(modelSwitchPlan.costComparison.savings * 100)}%
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

// Compact version for use in headers
export function CompactContextUsage({ 
  model, 
  conversationId 
}: Pick<ContextUsageIndicatorProps, 'model' | 'conversationId'>) {
  const currentConversation = useCurrentConversation()
  const targetConversationId = conversationId || currentConversation?.id
  
  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!targetConversationId || !model) return

    const loadQuickInfo = async () => {
      setLoading(true)
      try {
        const budget = await contextBudgetService.getContextBudgetInfo(targetConversationId, model)
        setBudgetPlan(budget)
      } catch (error) {
        console.error('Failed to load quick context info:', error)
      } finally {
        setLoading(false)
      }
    }

    loadQuickInfo()
  }, [targetConversationId, model])

  if (loading || !budgetPlan) {
    return <Cpu className="h-4 w-4 animate-pulse text-muted-foreground" />
  }

  const usageRatio = budgetPlan.contextWindow.totalTokenCount / budgetPlan.budget.maxTokens
  
  if (usageRatio >= 0.8) {
    return <AlertTriangle className="h-4 w-4 text-orange-500" />
  }
  
  if (usageRatio >= 0.6) {
    return <BarChart3 className="h-4 w-4 text-yellow-500" />
  }

  return <BarChart3 className="h-4 w-4 text-green-500" />
}
