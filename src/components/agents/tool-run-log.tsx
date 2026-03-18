/**
 * Tool Run Log Component
 * 
 * Displays audit trail and execution history for tools with filtering,
 * search, and detailed inspection capabilities.
 */

'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Download,
  Calendar
} from 'lucide-react'
import { 
  ToolAuditLog, 
  ToolExecutionResult,
  SecurityEvent,
  ToolCapability,
  ToolRiskLevel
} from '@/lib/app/tools/types'

// Mock data for development - would be replaced with real API calls
const mockAuditLogs: ToolAuditLog[] = [
  {
    id: '1',
    toolName: 'read-file',
    toolVersion: '1.0.0',
    context: {
      executionId: 'exec-1',
      sessionId: 'session-1',
      workspaceDir: '/workspace',
      startTime: new Date('2024-01-15T10:30:00Z'),
      conversationId: 'conv-1'
    },
    inputSanitized: { path: '/workspace/README.md' },
    result: {
      success: true,
      output: { content: 'README content here...' },
      metrics: { executionTimeMs: 150, capabilitiesUsed: ['filesystem-read'] }
    },
    approval: {
      required: false,
      granted: true,
      grantedAt: new Date('2024-01-15T10:30:00Z')
    },
    securityEvents: [],
    timestamp: new Date('2024-01-15T10:30:00Z')
  },
  {
    id: '2',
    toolName: 'index-file',
    toolVersion: '1.0.0',
    context: {
      executionId: 'exec-2',
      sessionId: 'session-1',
      workspaceDir: '/workspace',
      startTime: new Date('2024-01-15T10:35:00Z'),
      conversationId: 'conv-1'
    },
    inputSanitized: { 
      filePath: '/workspace/document.pdf',
      indexName: 'main-index'
    },
    result: {
      success: true,
      output: { chunksCreated: 45, indexedAt: '2024-01-15T10:36:00Z' },
      metrics: { executionTimeMs: 1200, capabilitiesUsed: ['filesystem-read', 'database-write'] }
    },
    approval: {
      required: true,
      granted: true,
      grantedAt: new Date('2024-01-15T10:34:00Z'),
      token: 'approval-token-123'
    },
    securityEvents: [],
    timestamp: new Date('2024-01-15T10:35:00Z')
  },
  {
    id: '3',
    toolName: 'shell-command',
    toolVersion: '1.0.0',
    context: {
      executionId: 'exec-3',
      sessionId: 'session-2',
      workspaceDir: '/workspace',
      startTime: new Date('2024-01-15T10:40:00Z')
    },
    inputSanitized: { command: 'ls -la /workspace' },
    result: {
      success: false,
      error: { code: 'PERMISSION_DENIED', message: 'Command not allowed' },
      metrics: { executionTimeMs: 50, capabilitiesUsed: [] }
    },
    approval: {
      required: true,
      granted: false,
      grantedAt: new Date('2024-01-15T10:39:00Z')
    },
    securityEvents: [
      {
        type: 'permission_denied',
        severity: 'high',
        description: 'Attempted to execute unauthorized shell command',
        timestamp: new Date('2024-01-15T10:40:00Z'),
        details: { command: 'ls -la /workspace', reason: 'process-exec capability not granted' }
      }
    ],
    timestamp: new Date('2024-01-15T10:40:00Z')
  }
]

interface ToolRunLogProps {
  logs?: ToolAuditLog[]
  loading?: boolean
  onRefresh?: () => void
}

export function ToolRunLog({ 
  logs = mockAuditLogs, 
  loading = false, 
  onRefresh 
}: ToolRunLogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [toolFilter, setToolFilter] = useState<string>('all')
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  // Get unique tool names for filter
  const toolNames = useMemo(() => {
    const names = new Set(logs.map(log => log.toolName))
    return Array.from(names).sort()
  }, [logs])

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search filter
      if (searchQuery && !log.toolName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        const success = log.result.success
        if (statusFilter === 'success' && !success) return false
        if (statusFilter === 'failed' && success) return false
      }

      // Tool filter
      if (toolFilter !== 'all' && log.toolName !== toolFilter) {
        return false
      }

      return true
    })
  }, [logs, searchQuery, statusFilter, toolFilter])

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedLogs)
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId)
    } else {
      newExpanded.add(logId)
    }
    setExpandedLogs(newExpanded)
  }

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    } else {
      return <XCircle className="h-4 w-4 text-red-600" />
    }
  }

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge variant={success ? 'default' : 'destructive'} className="gap-1">
        {getStatusIcon(success)}
        {success ? 'Success' : 'Failed'}
      </Badge>
    )
  }

  const getApprovalBadge = (approval: ToolAuditLog['approval']) => {
    if (!approval.required) {
      return <Badge variant="outline">No Approval</Badge>
    }
    
    return (
      <Badge variant={approval.granted ? 'default' : 'destructive'} className="gap-1">
        {approval.granted ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {approval.granted ? 'Approved' : 'Denied'}
      </Badge>
    )
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  const exportLogs = () => {
    const data = JSON.stringify(filteredLogs, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tool-audit-logs-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Tool Execution Log
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportLogs}
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="gap-1"
              >
                <Calendar className="h-4 w-4" />
                Refresh
              </Button>
            )}
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by tool name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={toolFilter} onValueChange={setToolFilter}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Tool" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tools</SelectItem>
              {toolNames.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No tool execution logs found</p>
                {searchQuery && (
                  <p className="text-sm">Try adjusting your search or filters</p>
                )}
              </div>
            ) : (
              filteredLogs.map((log) => (
                <Card key={log.id} className="border-l-4 border-l-muted">
                  <Collapsible
                    open={expandedLogs.has(log.id)}
                    onOpenChange={() => toggleExpanded(log.id)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1 h-auto"
                            >
                              {expandedLogs.has(log.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                            
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{log.toolName}</span>
                              <Badge variant="outline" className="text-xs">
                                v{log.toolVersion}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {getStatusBadge(log.result.success)}
                            {getApprovalBadge(log.approval)}
                            <span className="text-sm text-muted-foreground">
                              {formatDate(log.timestamp)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Execution ID: {log.context.executionId.slice(0, 8)}...</span>
                          <span>Duration: {formatDuration(log.result.metrics.executionTimeMs)}</span>
                          {log.result.metrics.capabilitiesUsed.length > 0 && (
                            <span>Capabilities: {log.result.metrics.capabilitiesUsed.join(', ')}</span>
                          )}
                        </div>

                        {log.securityEvents.length > 0 && (
                          <div className="mt-2">
                            <AlertTriangle className="h-4 w-4 text-orange-600 inline mr-1" />
                            <span className="text-sm text-orange-600">
                              {log.securityEvents.length} security event(s)
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <Separator />
                      <CardContent className="p-4 space-y-4">
                        {/* Context Information */}
                        <div>
                          <h4 className="font-medium mb-2">Context</h4>
                          <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                            <div><strong>Session:</strong> {log.context.sessionId.slice(0, 8)}...</div>
                            <div><strong>Workspace:</strong> {log.context.workspaceDir}</div>
                            <div><strong>Started:</strong> {log.context.startTime.toLocaleString()}</div>
                            {log.context.conversationId && (
                              <div><strong>Conversation:</strong> {log.context.conversationId.slice(0, 8)}...</div>
                            )}
                          </div>
                        </div>

                        {/* Input */}
                        <div>
                          <h4 className="font-medium mb-2">Input</h4>
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <pre className="text-xs whitespace-pre-wrap font-mono max-h-32 overflow-auto">
                              {JSON.stringify(log.inputSanitized, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* Result */}
                        <div>
                          <h4 className="font-medium mb-2">Result</h4>
                          <div className="bg-muted/50 p-3 rounded-lg">
                            {log.result.success ? (
                              <div>
                                <div className="text-sm space-y-2">
                                  <div><strong>Output:</strong></div>
                                  <pre className="text-xs whitespace-pre-wrap font-mono max-h-32 overflow-auto bg-background p-2 rounded">
                                    {JSON.stringify(log.result.output, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm text-destructive">
                                <div><strong>Error:</strong> {log.result.error?.code}</div>
                                <div>{log.result.error?.message}</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Approval Details */}
                        {log.approval.required && (
                          <div>
                            <h4 className="font-medium mb-2">Approval Details</h4>
                            <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                              <div><strong>Required:</strong> Yes</div>
                              <div><strong>Granted:</strong> {log.approval.granted ? 'Yes' : 'No'}</div>
                              <div><strong>Granted At:</strong> {log.approval.grantedAt.toLocaleString()}</div>
                              {log.approval.token && (
                                <div><strong>Token:</strong> {log.approval.token.slice(0, 8)}...</div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Security Events */}
                        {log.securityEvents.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Security Events</h4>
                            <div className="space-y-2">
                              {log.securityEvents.map((event, index) => (
                                <div key={index} className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
                                  <div className="flex items-center gap-2 mb-1">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    <span className="font-medium text-orange-800">{event.type}</span>
                                    <Badge variant={event.severity === 'high' ? 'destructive' : 'secondary'}>
                                      {event.severity}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-orange-700">{event.description}</div>
                                  <div className="text-xs text-orange-600 mt-1">
                                    {event.timestamp.toLocaleString()}
                                  </div>
                                  {event.details && (
                                    <pre className="text-xs mt-2 bg-orange-100 p-2 rounded overflow-auto">
                                      {JSON.stringify(event.details, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
