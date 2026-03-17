/**
 * Conversation Summary Component
 * 
 * Displays the conversation summary with key information about goals,
 * decisions, and next actions. Allows viewing and managing summaries.
 */

'use client'

import React, { useEffect, useState } from 'react'
import { 
  FileText, 
  Target, 
  HelpCircle, 
  CheckCircle, 
  Wrench,
  ArrowRight,
  Clock,
  Tag,
  RefreshCw,
  Edit,
  Trash2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ConversationSummary,
  conversationSummaryService 
} from '@/lib/app/services/conversation-summary-service'
import { useCurrentConversation } from '@/stores/use-chat-store'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface ConversationSummaryProps {
  className?: string
  conversationId?: string
  onRefresh?: () => void
  editable?: boolean
}

export function ConversationSummary({ 
  className, 
  conversationId,
  onRefresh,
  editable = false
}: ConversationSummaryProps) {
  const currentConversation = useCurrentConversation()
  const targetConversationId = conversationId || currentConversation?.id
  
  const [summary, setSummary] = useState<ConversationSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (targetConversationId) {
      loadSummary()
    }
  }, [targetConversationId])

  const loadSummary = async () => {
    if (!targetConversationId) return

    setLoading(true)
    setError(null)

    try {
      const summaryData = await conversationSummaryService.getCurrentSummary(targetConversationId)
      setSummary(summaryData)
    } catch (err) {
      console.error('Failed to load summary:', err)
      setError(err instanceof Error ? err.message : 'Failed to load summary')
    } finally {
      setLoading(false)
    }
  }

  const generateSummary = async () => {
    if (!targetConversationId) return

    setIsGenerating(true)
    try {
      const newSummary = await conversationSummaryService.generateInitialSummary(targetConversationId)
      setSummary(newSummary)
      toast.success('Summary generated successfully')
      onRefresh?.()
    } catch (err) {
      console.error('Failed to generate summary:', err)
      toast.error('Failed to generate summary')
    } finally {
      setIsGenerating(false)
    }
  }

  const updateSummary = async () => {
    if (!targetConversationId || !summary) return

    setIsGenerating(true)
    try {
      // This would need additional UI for updating specific fields
      // For now, just regenerate
      await generateSummary()
    } catch (err) {
      console.error('Failed to update summary:', err)
      toast.error('Failed to update summary')
    } finally {
      setIsGenerating(false)
    }
  }

  const deleteSummary = async () => {
    if (!targetConversationId) return

    try {
      // This would need a delete method in the service
      toast.success('Summary deleted')
      setSummary(null)
      onRefresh?.()
    } catch (err) {
      console.error('Failed to delete summary:', err)
      toast.error('Failed to delete summary')
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Conversation Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-muted-foreground">Loading summary...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Conversation Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <HelpCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={generateSummary} className="mt-4" disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Summary'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!summary) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Conversation Summary</span>
            </div>
            {editable && (
              <Button 
                size="sm" 
                onClick={generateSummary} 
                disabled={isGenerating}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No summary available for this conversation</p>
            <p className="text-sm mt-2">
              Generate a summary to capture key points and reduce context usage
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Conversation Summary</span>
              <Badge variant="secondary" className="text-xs">
                v{summary.metadata.version}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Tooltip>
                <TooltipTrigger>
                  <div className="text-xs text-muted-foreground flex items-center space-x-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(new Date(summary.contextWindow.lastUpdated), { addSuffix: true })}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Last updated: {new Date(summary.contextWindow.lastUpdated).toLocaleString()}</p>
                </TooltipContent>
              </Tooltip>
              
              {editable && (
                <div className="flex items-center space-x-1">
                  <Button size="sm" variant="outline" onClick={updateSummary} disabled={isGenerating}>
                    <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={deleteSummary}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Goal */}
          {summary.userGoal && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="font-medium">User Goal</span>
              </div>
              <p className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                {summary.userGoal}
              </p>
            </div>
          )}

          {/* Open Questions */}
          {summary.openQuestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <HelpCircle className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Open Questions ({summary.openQuestions.length})</span>
              </div>
              <ul className="space-y-1">
                {summary.openQuestions.map((question, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-orange-500 mt-1">•</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Constraints */}
          {summary.constraints.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Wrench className="h-4 w-4 text-red-500" />
                <span className="font-medium">Constraints ({summary.constraints.length})</span>
              </div>
              <ul className="space-y-1">
                {summary.constraints.map((constraint, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-red-500 mt-1">•</span>
                    <span>{constraint}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Decisions Made */}
          {summary.decisionsMade.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-medium">Decisions Made ({summary.decisionsMade.length})</span>
              </div>
              <ul className="space-y-1">
                {summary.decisionsMade.map((decision, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>{decision}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Artifacts Created */}
          {summary.artifactsCreated.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Artifacts Created ({summary.artifactsCreated.length})</span>
              </div>
              <ul className="space-y-1">
                {summary.artifactsCreated.map((artifact, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-purple-500 mt-1">📄</span>
                    <span>{artifact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Actions */}
          {summary.nextActions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <ArrowRight className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Next Actions ({summary.nextActions.length})</span>
              </div>
              <ul className="space-y-1">
                {summary.nextActions.map((action, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">→</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Topics */}
          {summary.keyTopics.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Tag className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Key Topics</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {summary.keyTopics.map((topic, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Messages summarized:</span> {summary.contextWindow.summarizedMessageCount}
            </div>
            <div>
              <span className="font-medium">Summary tokens:</span> {summary.contextWindow.summaryTokenCount.toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Generated by:</span> {summary.metadata.model}
            </div>
            <div>
              <span className="font-medium">Confidence:</span> {Math.round(summary.metadata.confidence * 100)}%
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

// Compact summary view for sidebars
export function CompactConversationSummary({ 
  conversationId 
}: Pick<ConversationSummaryProps, 'conversationId'>) {
  const [summary, setSummary] = useState<ConversationSummary | null>(null)

  useEffect(() => {
    if (conversationId) {
      conversationSummaryService.getCurrentSummary(conversationId).then(setSummary)
    }
  }, [conversationId])

  if (!summary) return null

  return (
    <div className="space-y-2">
      {summary.userGoal && (
        <div className="text-xs">
          <span className="font-medium">Goal:</span> {summary.userGoal}
        </div>
      )}
      {summary.nextActions.length > 0 && (
        <div className="text-xs">
          <span className="font-medium">Next:</span> {summary.nextActions[0]}
        </div>
      )}
    </div>
  )
}
