/**
 * Eval Report Component
 * 
 * Comprehensive evaluation report visualization with regression tracking.
 * Implements 2026 best practices: blockers, guardrails, and targets categories.
 */

'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
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
  ScatterChart,
  Scatter,
  Cell,
  Legend,
  ReferenceLine
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Download,
  RefreshCw,
  Eye,
  GitCompare,
  Shield,
  Target,
  Zap,
  Clock,
  DollarSign
} from 'lucide-react'

// Types based on 2026 best practices
export interface EvalMetric {
  name: string
  value: number
  baseline?: number
  status: 'pass' | 'fail' | 'warn'
  category: 'blocker' | 'guardrail' | 'target'
  description: string
}

export interface RegressionResult {
  category: 'blocker' | 'guardrail' | 'target'
  status: 'passed' | 'failed' | 'warning'
  message: string
  metrics: {
    current: number
    baseline: number
    threshold: number
  }
}

export interface EvalReport {
  id: string
  name: string
  description: string
  createdAt: Date
  promptVersion: string
  modelProfile: string
  status: 'running' | 'completed' | 'failed'
  totalTests: number
  passedTests: number
  failedTests: number
  duration: number
  metrics: EvalMetric[]
  regressions: RegressionResult[]
  summary: {
    overallScore: number
    blockerStatus: 'passed' | 'failed'
    guardrailStatus: 'passed' | 'warning' | 'failed'
    targetStatus: 'improved' | 'maintained' | 'regressed'
  }
}

interface EvalReportProps {
  report: EvalReport
  baselineReport?: EvalReport
  onRerun?: () => void
  onExport?: () => void
  onViewDetails?: (metricName: string) => void
}

const CATEGORY_COLORS = {
  blocker: '#ef4444',    // red
  guardrail: '#f59e0b', // amber  
  target: '#10b981'     // green
}

const STATUS_COLORS = {
  pass: '#10b981',      // green
  fail: '#ef4444',      // red
  warn: '#f59e0b'       // amber
}

export function EvalReport({ 
  report, 
  baselineReport,
  onRerun,
  onExport,
  onViewDetails 
}: EvalReportProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'blocker' | 'guardrail' | 'target'>('all')
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)

  const filteredMetrics = selectedCategory === 'all' 
    ? report.metrics 
    : report.metrics.filter(m => m.category === selectedCategory)

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'blocker': return <XCircle className="h-4 w-4" />
      case 'guardrail': return <Shield className="h-4 w-4" />
      case 'target': return <Target className="h-4 w-4" />
      default: return <Zap className="h-4 w-4" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'fail': return <XCircle className="h-4 w-4 text-red-500" />
      case 'warn': return <AlertTriangle className="h-4 w-4 text-amber-500" />
      default: return <Zap className="h-4 w-4" />
    }
  }

  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{report.summary.overallScore.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground">
            {report.summary.overallScore >= 90 ? 'Excellent' : 
             report.summary.overallScore >= 75 ? 'Good' : 
             report.summary.overallScore >= 60 ? 'Fair' : 'Poor'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Blockers</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {report.metrics.filter(m => m.category === 'blocker' && m.status === 'pass').length}/
            {report.metrics.filter(m => m.category === 'blocker').length}
          </div>
          <Badge variant={report.summary.blockerStatus === 'passed' ? 'default' : 'destructive'}>
            {report.summary.blockerStatus}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Guardrails</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {report.metrics.filter(m => m.category === 'guardrail' && m.status !== 'fail').length}/
            {report.metrics.filter(m => m.category === 'guardrail').length}
          </div>
          <Badge variant={
            report.summary.guardrailStatus === 'passed' ? 'default' :
            report.summary.guardrailStatus === 'warning' ? 'secondary' : 'destructive'
          }>
            {report.summary.guardrailStatus}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Targets</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {report.metrics.filter(m => m.category === 'target' && m.status === 'pass').length}/
            {report.metrics.filter(m => m.category === 'target').length}
          </div>
          <Badge variant={
            report.summary.targetStatus === 'improved' ? 'default' :
            report.summary.targetStatus === 'maintained' ? 'secondary' : 'destructive'
          }>
            {report.summary.targetStatus}
          </Badge>
        </CardContent>
      </Card>
    </div>
  )

  const renderRegressionAlerts = () => {
    const failedRegressions = report.regressions.filter(r => r.status === 'failed')
    const warningRegressions = report.regressions.filter(r => r.status === 'warning')

    if (failedRegressions.length === 0 && warningRegressions.length === 0) {
      return (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>All Regression Checks Passed</AlertTitle>
          <AlertDescription>
            No regressions detected. All blockers, guardrails, and targets are within acceptable thresholds.
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <div className="space-y-4">
        {failedRegressions.map((regression, index) => (
          <Alert key={index} variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Blocker Regression: {regression.category}</AlertTitle>
            <AlertDescription>
              {regression.message}
              <div className="mt-2 text-sm">
                Current: {regression.metrics.current} | 
                Baseline: {regression.metrics.baseline} | 
                Threshold: {regression.metrics.threshold}
              </div>
            </AlertDescription>
          </Alert>
        ))}

        {warningRegressions.map((regression, index) => (
          <Alert key={index} variant="default">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Guardrail Warning: {regression.category}</AlertTitle>
            <AlertDescription>
              {regression.message}
              <div className="mt-2 text-sm">
                Current: {regression.metrics.current} | 
                Baseline: {regression.metrics.baseline} | 
                Threshold: {regression.metrics.threshold}
              </div>
            </AlertDescription>
          </Alert>
        ))}
      </div>
    )
  }

  const renderMetricsChart = () => {
    const chartData = filteredMetrics.map(metric => ({
      name: metric.name,
      value: metric.value,
      baseline: metric.baseline || 0,
      status: metric.status,
      category: metric.category
    }))

    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip 
              formatter={(value: number, name: string) => [
                `${value.toFixed(2)}`, 
                name === 'value' ? 'Current' : 'Baseline'
              ]}
              labelFormatter={(label) => `Metric: ${label}`}
            />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" name="Current">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category]} />
              ))}
            </Bar>
            {baselineReport && (
              <Bar dataKey="baseline" fill="#82ca9d" name="Baseline" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const renderMetricsTable = () => (
    <div className="rounded-md border">
      <div className="grid grid-cols-5 gap-4 p-4 font-medium border-b bg-muted/50">
        <div>Metric</div>
        <div>Category</div>
        <div>Value</div>
        <div>Baseline</div>
        <div>Status</div>
      </div>
      {filteredMetrics.map((metric) => (
        <div 
          key={metric.name}
          className="grid grid-cols-5 gap-4 p-4 border-b hover:bg-muted/50 cursor-pointer"
          onClick={() => setExpandedMetric(expandedMetric === metric.name ? null : metric.name)}
        >
          <div className="font-medium">{metric.name}</div>
          <div>
            <Badge variant="outline" className="gap-1">
              {getCategoryIcon(metric.category)}
              {metric.category}
            </Badge>
          </div>
          <div>{metric.value.toFixed(2)}</div>
          <div>{metric.baseline?.toFixed(2) || 'N/A'}</div>
          <div>
            <Badge 
              variant={metric.status === 'pass' ? 'default' : metric.status === 'fail' ? 'destructive' : 'secondary'}
              className="gap-1"
            >
              {getStatusIcon(metric.status)}
              {metric.status}
            </Badge>
          </div>
          {expandedMetric === metric.name && (
            <div className="col-span-5 p-4 bg-muted/50 border-t">
              <p className="text-sm text-muted-foreground">{metric.description}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{report.name}</h3>
          <p className="text-sm text-muted-foreground">{report.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline">{report.promptVersion}</Badge>
            <Badge variant="outline">{report.modelProfile}</Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(report.createdAt, { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onRerun}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Rerun
          </Button>
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {renderSummaryCards()}

      {/* Regression Alerts */}
      <div>
        <h4 className="text-md font-semibold mb-4">Regression Analysis</h4>
        {renderRegressionAlerts()}
      </div>

      {/* Detailed Metrics */}
      <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as any)}>
        <TabsList>
          <TabsTrigger value="all">All Metrics ({report.metrics.length})</TabsTrigger>
          <TabsTrigger value="blocker">
            Blockers ({report.metrics.filter(m => m.category === 'blocker').length})
          </TabsTrigger>
          <TabsTrigger value="guardrail">
            Guardrails ({report.metrics.filter(m => m.category === 'guardrail').length})
          </TabsTrigger>
          <TabsTrigger value="target">
            Targets ({report.metrics.filter(m => m.category === 'target').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div>
            <h4 className="text-md font-semibold mb-4">Performance Overview</h4>
            {renderMetricsChart()}
          </div>
          <div>
            <h4 className="text-md font-semibold mb-4">Detailed Metrics</h4>
            {renderMetricsTable()}
          </div>
        </TabsContent>

        {['blocker', 'guardrail', 'target'].map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div>
              <h4 className="text-md font-semibold mb-4 capitalize">{category} Metrics</h4>
              {renderMetricsChart()}
            </div>
            <div>
              <h4 className="text-md font-semibold mb-4">Detailed Analysis</h4>
              {renderMetricsTable()}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
