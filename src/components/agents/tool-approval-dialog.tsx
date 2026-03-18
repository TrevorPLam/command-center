/**
 * Tool Approval Dialog Component
 * 
 * Provides an interactive interface for reviewing and approving tool execution requests
 * with risk assessment, capability review, and decision logging.
 */

'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  AlertTriangle, 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle,
  Info,
  Zap
} from 'lucide-react'
import { 
  ToolApprovalRequest, 
  ToolApprovalResponse,
  ToolRiskLevel,
  ToolCapability,
  ApprovalDecision
} from '@/lib/app/tools/types'

// Form schema for approval decision
const approvalFormSchema = z.object({
  approved: z.boolean(),
  reason: z.string().optional(),
  restrictions: z.array(z.string()).optional(),
  rememberDecision: z.boolean().default(false)
})

type ApprovalFormData = z.infer<typeof approvalFormSchema>

interface ToolApprovalDialogProps {
  open: boolean
  request: ToolApprovalRequest | null
  onResponse: (response: ToolApprovalResponse) => void
  onClose: () => void
}

export function ToolApprovalDialog({
  open,
  request,
  onResponse,
  onClose
}: ToolApprovalDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {
      approved: false,
      reason: '',
      restrictions: [],
      rememberDecision: false
    }
  })

  // Update time remaining
  useEffect(() => {
    if (!request || !open) return

    const updateTimer = () => {
      const remaining = Math.max(0, request.expiresAt.getTime() - Date.now())
      setTimeRemaining(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [request, open])

  // Auto-reject when expired
  useEffect(() => {
    if (timeRemaining === 0 && request && open) {
      handleResponse({
        approved: false,
        reason: 'Request expired automatically'
      })
    }
  }, [timeRemaining, request, open])

  const handleResponse = async (data: ApprovalFormData | ApprovalDecision) => {
    if (!request) return

    setIsSubmitting(true)
    try {
      const response: ToolApprovalResponse = {
        requestId: request.id,
        approved: data.approved,
        token: data.approved ? crypto.randomUUID() : undefined,
        grantedCapabilities: data.approved ? request.tool.capabilities : [],
        respondedAt: new Date(),
        reason: data.reason || (data.approved ? 'Approved by user' : 'Denied by user')
      }

      await onResponse(response)
      onClose()
    } catch (error) {
      console.error('Failed to process approval response:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = form.handleSubmit(handleResponse)

  const getRiskLevelColor = (level: ToolRiskLevel) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high': return 'bg-red-100 text-red-800 border-red-200'
    }
  }

  const getCapabilityIcon = (capability: ToolCapability) => {
    switch (capability) {
      case 'filesystem-read': return <Info className="h-4 w-4" />
      case 'filesystem-write': return <AlertTriangle className="h-4 w-4" />
      case 'network-egress': return <Zap className="h-4 w-4" />
      case 'database-read':
      case 'database-write': return <Info className="h-4 w-4" />
      case 'runtime-query': return <Shield className="h-4 w-4" />
      case 'system-info': return <Info className="h-4 w-4" />
      case 'process-exec': return <AlertTriangle className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const formatTimeRemaining = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  if (!request) return null

  const isExpired = timeRemaining === 0
  const isExpiringSoon = timeRemaining > 0 && timeRemaining < 60000 // Less than 1 minute

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Tool Approval Required
            <Badge className={getRiskLevelColor(request.riskAssessment.level)}>
              {request.riskAssessment.level.toUpperCase()} RISK
            </Badge>
            {isExpiringSoon && !isExpired && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <Clock className="h-3 w-3 mr-1" />
                {formatTimeRemaining(timeRemaining)}
              </Badge>
            )}
            {isExpired && (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                EXPIRED
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Tool Information */}
            <div>
              <h3 className="font-semibold mb-2">Tool Information</h3>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{request.tool.name}</span>
                  <Badge variant="outline">v{request.tool.version}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {request.tool.description}
                </p>
                {request.tool.author && (
                  <p className="text-xs text-muted-foreground">
                    Author: {request.tool.author}
                  </p>
                )}
              </div>
            </div>

            {/* Risk Assessment */}
            <div>
              <h3 className="font-semibold mb-2">Risk Assessment</h3>
              <Alert className={getRiskLevelColor(request.riskAssessment.level)}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Risk Score: {request.riskAssessment.score}/100</p>
                    <ul className="text-sm space-y-1">
                      {request.riskAssessment.reasons.map((reason, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            </div>

            {/* Required Capabilities */}
            <div>
              <h3 className="font-semibold mb-2">Required Capabilities</h3>
              <div className="flex flex-wrap gap-2">
                {request.tool.capabilities.map((capability) => (
                  <Badge 
                    key={capability} 
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    {getCapabilityIcon(capability)}
                    {capability.replace('-', ' ').toUpperCase()}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Execution Scope */}
            <div>
              <h3 className="font-semibold mb-2">Execution Scope</h3>
              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Allowed Paths:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {request.tool.executionScope.allowedPaths.map((path, index) => (
                      <li key={index} className="font-mono text-xs bg-background p-1 rounded">
                        {path}
                      </li>
                    ))}
                  </ul>
                </div>

                {request.tool.executionScope.deniedPaths.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-1 text-destructive">Denied Paths:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {request.tool.executionScope.deniedPaths.map((path, index) => (
                        <li key={index} className="font-mono text-xs bg-destructive/10 p-1 rounded text-destructive">
                          {path}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium mb-1">Resource Limits:</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {request.tool.executionScope.resourceLimits.maxMemoryMB && (
                      <div>Memory: {request.tool.executionScope.resourceLimits.maxMemoryMB}MB</div>
                    )}
                    {request.tool.executionScope.resourceLimits.maxCpuPercent && (
                      <div>CPU: {request.tool.executionScope.resourceLimits.maxCpuPercent}%</div>
                    )}
                    {request.tool.executionScope.resourceLimits.maxExecutionTimeSec && (
                      <div>Time: {request.tool.executionScope.resourceLimits.maxExecutionTimeSec}s</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div>
              <h3 className="font-semibold mb-2">Request Details</h3>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Session ID:</span>
                  <span className="font-mono">{request.sessionId.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Requested:</span>
                  <span>{request.requestedAt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Expires:</span>
                  <span>{request.expiresAt.toLocaleString()}</span>
                </div>
                {request.context.conversationId && (
                  <div className="flex justify-between text-sm">
                    <span>Conversation:</span>
                    <span className="font-mono">{request.context.conversationId.slice(0, 8)}...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Input Preview */}
            <div>
              <h3 className="font-semibold mb-2">Input Preview</h3>
              <div className="bg-muted/50 p-4 rounded-lg">
                <pre className="text-xs whitespace-pre-wrap font-mono max-h-32 overflow-auto">
                  {JSON.stringify(request.inputSanitized, null, 2)}
                </pre>
              </div>
            </div>

            <Separator />

            {/* Approval Form */}
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Decision</h3>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox
                      checked={form.watch('approved')}
                      onCheckedChange={(checked) => form.setValue('approved', !!checked)}
                    />
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Approve
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <Checkbox
                      checked={!form.watch('approved')}
                      onCheckedChange={(checked) => form.setValue('approved', !checked)}
                    />
                    <span className="flex items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Deny
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Reason (optional)
                </label>
                <Textarea
                  placeholder="Provide a reason for this decision..."
                  {...form.register('reason')}
                  rows={3}
                />
              </div>

              {form.watch('approved') && request.tool.capabilities.length > 1 && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Restrict Capabilities (optional)
                  </label>
                  <div className="space-y-2">
                    {request.tool.capabilities.map((capability) => (
                      <label key={capability} className="flex items-center space-x-2 cursor-pointer">
                        <Checkbox
                          value={capability}
                          defaultChecked={true}
                          onCheckedChange={(checked) => {
                            const current = form.getValues('restrictions') || []
                            if (checked) {
                              form.setValue('restrictions', current.filter(c => c !== capability))
                            } else {
                              form.setValue('restrictions', [...current, capability])
                            }
                          }}
                        />
                        <span className="text-sm">{capability.replace('-', ' ').toUpperCase()}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center space-x-2 cursor-pointer">
                <Checkbox {...form.register('rememberDecision')} />
                <span className="text-sm">Remember decision for similar requests</span>
              </label>
            </form>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={onSubmit}
            disabled={isSubmitting || isExpired}
            variant={form.watch('approved') ? 'default' : 'destructive'}
          >
            {isSubmitting ? 'Processing...' : form.watch('approved') ? 'Approve' : 'Deny'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
