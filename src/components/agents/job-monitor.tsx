'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Trash2, 
  MoreHorizontal,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { 
  listJobs, 
  cancelJob, 
  retryJob, 
  deleteJob,
  getQueueStats 
} from '@/app/actions/jobs'
import type { Job } from '@/lib/db/schema'

interface QueueStats {
  pending: number
  running: number
  completed: number
  failed: number
  cancelled: number
  retrying: number
  overdue: number
}

export function JobMonitor() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Load data
  useEffect(() => {
    loadData()
    
    if (autoRefresh) {
      const interval = setInterval(loadData, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const loadData = async () => {
    try {
      setLoading(true)
      
      const [jobsResult, statsResult] = await Promise.all([
        listJobs({ limit: 50 }),
        getQueueStats()
      ])

      if (jobsResult.success) {
        setJobs(jobsResult.jobs || [])
      }

      if (statsResult.success) {
        setStats(statsResult.stats)
      }
    } catch (error) {
      console.error('Failed to load job data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelJob = async (jobId: string) => {
    try {
      await cancelJob(jobId)
      await loadData()
    } catch (error) {
      console.error('Failed to cancel job:', error)
    }
  }

  const handleRetryJob = async (jobId: string) => {
    try {
      await retryJob(jobId)
      await loadData()
    } catch (error) {
      console.error('Failed to retry job:', error)
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this job?')) {
      return
    }

    try {
      await deleteJob(jobId)
      await loadData()
    } catch (error) {
      console.error('Failed to delete job:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-500" />
      case 'retrying':
        return <RotateCcw className="h-4 w-4 text-orange-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'running':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'retrying':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getJobTypeColor = (type: string) => {
    switch (type) {
      case 'agent_run':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'rag_index':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'model_sync':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200'
      case 'batch_process':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'export':
        return 'bg-pink-100 text-pink-800 border-pink-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDuration = (startTime?: Date, endTime?: Date) => {
    if (!startTime) return 'N/A'
    
    const end = endTime || new Date()
    const duration = end.getTime() - startTime.getTime()
    
    if (duration < 1000) {
      return `${duration}ms`
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`
    } else {
      return `${(duration / 60000).toFixed(1)}m`
    }
  }

  const formatTime = (date?: Date) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleString()
  }

  const isActionable = (job: Job) => {
    return ['pending', 'failed', 'running'].includes(job.status)
  }

  return (
    <div className="space-y-4">
      {/* Queue Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          <Card className="p-3">
            <div className="text-lg font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </Card>
          <Card className="p-3">
            <div className="text-lg font-bold text-blue-600">{stats.running}</div>
            <div className="text-xs text-muted-foreground">Running</div>
          </Card>
          <Card className="p-3">
            <div className="text-lg font-bold text-green-600">{stats.completed}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </Card>
          <Card className="p-3">
            <div className="text-lg font-bold text-red-600">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </Card>
          <Card className="p-3">
            <div className="text-lg font-bold text-orange-600">{stats.retrying}</div>
            <div className="text-xs text-muted-foreground">Retrying</div>
          </Card>
          <Card className="p-3">
            <div className="text-lg font-bold text-gray-600">{stats.cancelled}</div>
            <div className="text-xs text-muted-foreground">Cancelled</div>
          </Card>
          {stats.overdue > 0 && (
            <Card className="p-3 border-red-200">
              <div className="text-lg font-bold text-red-600">{stats.overdue}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </Card>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={loadData}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Refresh
          </Button>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh
            </label>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {jobs.length} jobs total
        </div>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-muted-foreground">No jobs in queue</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">
                        {job.id.slice(0, 8)}...
                      </TableCell>
                      
                      <TableCell>
                        <Badge className={getJobTypeColor(job.type)}>
                          {job.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          <Badge className={getStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="w-24">
                          <Progress value={job.progress * 100} className="h-2" />
                          <div className="text-xs text-muted-foreground mt-1">
                            {Math.round(job.progress * 100)}%
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-xs">
                        {formatDuration(job.startedAt, job.completedAt)}
                      </TableCell>
                      
                      <TableCell className="text-xs">
                        {formatTime(job.createdAt)}
                      </TableCell>
                      
                      <TableCell>
                        {isActionable(job) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {job.status === 'running' && (
                                <DropdownMenuItem onClick={() => handleCancelJob(job.id)}>
                                  <Square className="h-4 w-4 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                              
                              {job.status === 'failed' && (
                                <DropdownMenuItem onClick={() => handleRetryJob(job.id)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Retry
                                </DropdownMenuItem>
                              )}
                              
                              {job.status === 'pending' && (
                                <DropdownMenuItem onClick={() => handleCancelJob(job.id)}>
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuSeparator />
                              
                              <DropdownMenuItem 
                                onClick={() => handleDeleteJob(job.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
