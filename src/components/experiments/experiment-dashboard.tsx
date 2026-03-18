/**
 * Experiment Dashboard Component
 * 
 * Displays experiment results, A/B testing comparisons, and regression reports.
 * Provides comprehensive analytics for prompt evaluation.
 */

'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Play, 
  Pause, 
  RotateCcw, 
  Download,
  Eye,
  GitCompare,
  AlertTriangle
} from 'lucide-react'
import { experimentRepository } from '@/lib/app/persistence/experiment-repository'
import type { ExperimentSummary } from '@/lib/app/persistence/experiment-repository'

interface ExperimentDashboardProps {
  onRunExperiment?: (experimentId: string) => void
  onViewDetails?: (experimentId: string) => void
  onCompare?: (experimentIds: string[]) => void
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function ExperimentDashboard({ 
  onRunExperiment, 
  onViewDetails, 
  onCompare 
}: ExperimentDashboardProps) {
  const [experiments, setExperiments] = useState<ExperimentSummary[]>([])
  const [selectedExperiments, setSelectedExperiments] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const loadExperiments = async () => {
      try {
        const summaries = await experimentRepository.getSummaries()
        setExperiments(summaries)
      } catch (error) {
        console.error('Failed to load experiments:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadExperiments()
  }, [])

  const handleSelectExperiment = (experimentId: string) => {
    setSelectedExperiments(prev => 
      prev.includes(experimentId)
        ? prev.filter(id => id !== experimentId)
        : [...prev, experimentId]
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'secondary' as const, label: 'Draft' },
      running: { variant: 'default' as const, label: 'Running' },
      completed: { variant: 'default' as const, label: 'Completed' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
      archived: { variant: 'outline' as const, label: 'Archived' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getSuccessRate = (runCount: number, successCount: number) => {
    return runCount > 0 ? (successCount / runCount) * 100 : 0
  }

  // Prepare data for charts
  const performanceData = experiments.map(exp => ({
    name: exp.experiment.name,
    successRate: getSuccessRate(exp.runCount, exp.successCount),
    averageLatency: exp.averageLatency,
    runCount: exp.runCount
  }))

  const statusDistribution = experiments.reduce((acc, exp) => {
    const status = exp.experiment.status
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const statusData = Object.entries(statusDistribution).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count
  }))

  const recentExperiments = experiments
    .sort((a, b) => new Date(b.experiment.updatedAt).getTime() - new Date(a.experiment.updatedAt).getTime())
    .slice(0, 5)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading experiment data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Experiment Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor and analyze your prompt evaluation experiments
          </p>
        </div>
        <div className="flex gap-2">
          {selectedExperiments.length >= 2 && (
            <Button 
              onClick={() => onCompare?.(selectedExperiments)}
              variant="outline"
              className="gap-2"
            >
              <GitCompare className="h-4 w-4" />
              Compare ({selectedExperiments.length})
            </Button>
          )}
          <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Experiments</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{experiments.length}</div>
            <p className="text-xs text-muted-foreground">
              {experiments.filter(e => e.experiment.status === 'running').length} running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {experiments.reduce((sum, e) => sum + e.runCount, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all experiments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {experiments.length > 0 
                ? (experiments.reduce((sum, e) => sum + getSuccessRate(e.runCount, e.successCount), 0) / experiments.length).toFixed(1)
                : '0'
              }%
            </div>
            <p className="text-xs text-muted-foreground">
              Across completed experiments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Pause className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {experiments.length > 0 
                ? (experiments.reduce((sum, e) => sum + e.averageLatency, 0) / experiments.length).toFixed(0)
                : '0'
              }ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="experiments">Experiments</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Experiment Performance</CardTitle>
                <CardDescription>
                  Success rate and latency by experiment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="successRate" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>
                  Current status of all experiments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>
                Average latency across experiments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="averageLatency" stroke="#8884d8" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="experiments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Experiments</CardTitle>
              <CardDescription>
                Complete list of experiments with detailed metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {experiments.map(experiment => (
                  <div
                    key={experiment.experiment.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={selectedExperiments.includes(experiment.experiment.id)}
                        onChange={() => handleSelectExperiment(experiment.experiment.id)}
                        className="rounded"
                      />
                      <div>
                        <h4 className="font-medium">{experiment.experiment.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {experiment.experiment.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(experiment.experiment.status)}
                          <span className="text-xs text-muted-foreground">
                            {experiment.runCount} runs
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {getSuccessRate(experiment.runCount, experiment.successCount).toFixed(1)}% success
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {experiment.averageLatency.toFixed(0)}ms
                        </div>
                        <div className="text-xs text-muted-foreground">
                          avg latency
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewDetails?.(experiment.experiment.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest experiment updates and runs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentExperiments.map(experiment => (
                  <div key={experiment.experiment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{experiment.experiment.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Updated {formatDistanceToNow(new Date(experiment.experiment.updatedAt), { addSuffix: true })}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(experiment.experiment.status)}
                        <Progress value={getSuccessRate(experiment.runCount, experiment.successCount)} className="w-20" />
                        <span className="text-xs text-muted-foreground">
                          {experiment.successCount}/{experiment.runCount} successful
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onViewDetails?.(experiment.experiment.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
