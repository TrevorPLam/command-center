'use client'

import { useState, useEffect } from 'react'
import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToolApprovalDialog } from '@/components/agents/tool-approval-dialog'
import { ToolRunLog } from '@/components/agents/tool-run-log'
import { JobMonitor } from '@/components/agents/job-monitor'
import { AgentExecution } from '@/components/agents/agent-execution'
import { 
  getPendingApprovalRequests,
  getApprovalStatistics,
  createApprovalRequest
} from '@/app/actions/tool-approvals'
import { 
  Shield, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Play,
  Settings,
  History,
  Zap,
  List
} from 'lucide-react'

// Types for the enhanced agents page
interface AgentStatus {
  id: string
  name: string
  description: string
  status: 'active' | 'inactive' | 'error'
  capabilities: string[]
  lastRun: string
  totalRuns: number
  successRate: number
  tools: string[]
}

interface ApprovalRequest {
  id: string
  toolName: string
  toolDescription: string
  riskLevel: 'low' | 'medium' | 'high'
  riskScore: number
  riskReasons: string[]
  capabilities: string[]
  requiresApproval: boolean
  requestedAt: string
  expiresAt: string
  sessionId: string
  executionId: string
  inputPreview: string
}

interface ApprovalStats {
  totalRequests: number
  approvedRequests: number
  deniedRequests: number
  expiredRequests: number
  averageDecisionTime: number
  approvalRate: number
  decisionsByRiskLevel: {
    low: number
    medium: number
    high: number
  }
}

export default function AgentsPage() {
  const [activeTab, setActiveTab] = useState('execute')
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([])
  const [approvalStats, setApprovalStats] = useState<ApprovalStats | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [systemStatus, setSystemStatus] = useState<'healthy' | 'warning' | 'error'>('healthy')

  // Load initial data
  useEffect(() => {
    loadData()
    
    // Set up polling for pending requests
    const interval = setInterval(loadPendingRequests, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load mock agents data (would come from real agent service)
      const mockAgents: AgentStatus[] = [
        {
          id: 'code-assistant',
          name: 'Code Assistant',
          description: 'Helps with code review, debugging, and refactoring',
          status: 'active',
          capabilities: ['code-review', 'debugging', 'refactoring'],
          lastRun: new Date(Date.now() - 1800000).toISOString(),
          totalRuns: 1247,
          successRate: 0.94,
          tools: ['read-file', 'write-file', 'shell-command']
        },
        {
          id: 'data-analyst',
          name: 'Data Analyst',
          description: 'Analyzes data and generates insights',
          status: 'inactive',
          capabilities: ['data-analysis', 'visualization', 'reporting'],
          lastRun: new Date(Date.now() - 7200000).toISOString(),
          totalRuns: 856,
          successRate: 0.89,
          tools: ['read-file', 'index-file', 'query-database']
        },
        {
          id: 'research-assistant',
          name: 'Research Assistant',
          description: 'Helps with research and information gathering',
          status: 'active',
          capabilities: ['research', 'summarization', 'fact-checking'],
          lastRun: new Date(Date.now() - 900000).toISOString(),
          totalRuns: 423,
          successRate: 0.91,
          tools: ['read-file', 'index-file', 'web-search']
        }
      ]
      
      setAgents(mockAgents)
      await loadPendingRequests()
      await loadApprovalStats()
      
    } catch (error) {
      console.error('Failed to load agents data:', error)
      setSystemStatus('error')
    } finally {
      setLoading(false)
    }
  }

  const loadPendingRequests = async () => {
    try {
      const result = await getPendingApprovalRequests()
      if (result.success) {
        setPendingRequests(result.requests)
      }
    } catch (error) {
      console.error('Failed to load pending requests:', error)
    }
  }

  const loadApprovalStats = async () => {
    try {
      const result = await getApprovalStatistics()
      if (result.success) {
        setApprovalStats(result.stats)
      }
    } catch (error) {
      console.error('Failed to load approval stats:', error)
    }
  }

  const handleApprovalResponse = async (response: any) => {
    // Reload pending requests and stats
    await loadPendingRequests()
    await loadApprovalStats()
    setSelectedRequest(null)
    setApprovalDialogOpen(false)
  }

  const createTestApprovalRequest = async () => {
    try {
      const result = await createApprovalRequest({
        toolName: 'read-file',
        input: { path: '/workspace/test.txt' },
        sessionId: 'test-session'
      })
      
      if (result.success) {
        await loadPendingRequests()
      }
    } catch (error) {
      console.error('Failed to create test request:', error)
    }
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'online'
      case 'inactive':
        return 'offline'
      case 'error':
        return 'error'
      default:
        return 'offline'
    }
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expires = new Date(expiresAt)
    const remaining = expires.getTime() - now.getTime()
    
    if (remaining <= 0) return 'Expired'
    
    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date()
  }

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>Agents & Tools</PanelTitle>
        <div className="flex items-center gap-2">
          <StatusIndicator status={systemStatus === 'healthy' ? 'online' : 'error'} />
          <span className="text-sm text-muted-foreground capitalize">
            {systemStatus}
          </span>
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {pendingRequests.length} pending
            </Badge>
          )}
        </div>
      </PanelHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="execute" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Execute
          </TabsTrigger>
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="approvals" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Approvals
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1 text-xs">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="execute" className="mt-4 h-full">
          <div className="h-full">
            <AgentExecution />
          </div>
        </TabsContent>

        <TabsContent value="monitor" className="mt-4 h-full">
          <div className="h-full">
            <JobMonitor />
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Pending Approvals</h3>
              <Button size="sm" variant="outline" onClick={createTestApprovalRequest}>
                Create Test Request
              </Button>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50 text-green-600" />
                <p className="text-muted-foreground">No pending approvals</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`rounded-md border p-4 cursor-pointer transition-colors ${
                      isExpired(request.expiresAt) 
                        ? 'border-gray-200 bg-gray-50 opacity-50' 
                        : 'border-border hover:bg-accent/50'
                    }`}
                    onClick={() => {
                      if (!isExpired(request.expiresAt)) {
                        setSelectedRequest(request)
                        setApprovalDialogOpen(true)
                      }
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{request.toolName}</h4>
                          <Badge className={getRiskLevelColor(request.riskLevel)}>
                            {request.riskLevel.toUpperCase()} RISK
                          </Badge>
                          {isExpired(request.expiresAt) ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Expired
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimeRemaining(request.expiresAt)}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {request.toolDescription}
                        </p>

                        <div className="flex flex-wrap gap-1 mb-2">
                          {request.capabilities.map((capability) => (
                            <Badge key={capability} variant="outline" className="text-xs">
                              {capability.replace('-', ' ').toUpperCase()}
                            </Badge>
                          ))}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Requested: {new Date(request.requestedAt).toLocaleString()}
                        </div>

                        {request.riskReasons.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-medium text-orange-600 mb-1">Risk Factors:</div>
                            <ul className="text-xs text-orange-600 space-y-1">
                              {request.riskReasons.map((reason, index) => (
                                <li key={index} className="flex items-start gap-1">
                                  <span>•</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center">
                        {isExpired(request.expiresAt) ? (
                          <XCircle className="h-5 w-5 text-gray-400" />
                        ) : (
                          <Button size="sm" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="mt-4 h-full">
          <div className="h-full">
            <ToolRunLog 
              onRefresh={loadData}
              loading={loading}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      <ToolApprovalDialog
        open={approvalDialogOpen}
        request={selectedRequest}
        onResponse={handleApprovalResponse}
        onClose={() => {
          setApprovalDialogOpen(false)
          setSelectedRequest(null)
        }}
      />
    </Panel>
  )
}
