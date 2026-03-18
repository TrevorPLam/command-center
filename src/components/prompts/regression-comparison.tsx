/**
 * Regression Comparison Component
 * 
 * Side-by-side comparison of eval reports with regression analysis.
 * Supports A/B testing and historical trend analysis.
 */

'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ReferenceLine
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  GitCompare,
  Eye,
  Download,
  Filter,
  Calendar
} from 'lucide-react'

import type { EvalReport, EvalMetric, RegressionResult } from './eval-report'

interface RegressionComparisonProps {
  reports: EvalReport[]
  selectedReportIds: string[]
  onSelectionChange: (reportIds: string[]) => void
  onCompare?: (reportIds: string[]) => void
  onExport?: (reportIds: string[]) => void
}

interface MetricComparison {
  name: string
  category: 'blocker' | 'guardrail' | 'target'
  reports: Array<{
    reportId: string
    reportName: string
    value: number
    status: 'pass' | 'fail' | 'warn'
    change?: number
    changePercent?: number
  }>
}

interface TrendData {
  date: string
  [key: string]: string | number
}

export function RegressionComparison({ 
  reports, 
  selectedReportIds, 
  onSelectionChange,
  onCompare,
  onExport
}: RegressionComparisonProps) {
  const [comparisonMode, setComparisonMode] = useState<'side-by-side' | 'trends' | 'radar'>('side-by-side')
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])
  const [showOnlyRegressions, setShowOnlyRegressions] = useState(false)

  const selectedReports = reports.filter(r => selectedReportIds.includes(r.id))

  // Calculate metric comparisons
  const metricComparisons: MetricComparison[] = reports[0]?.metrics.map(metric => {
    const comparison: MetricComparison = {
      name: metric.name,
      category: metric.category,
      reports: []
    }

    selectedReports.forEach(report => {
      const reportMetric = report.metrics.find(m => m.name === metric.name)
      if (reportMetric) {
        const baselineReport = reports.find(r => r.id === report.id && r.metrics.find(m => m.name === metric.name)?.baseline)
        const baselineValue = baselineReport?.metrics.find(m => m.name === metric.name)?.baseline || reportMetric.baseline

        comparison.reports.push({
          reportId: report.id,
          reportName: report.name,
          value: reportMetric.value,
          status: reportMetric.status,
          change: baselineValue ? reportMetric.value - baselineValue : undefined,
          changePercent: baselineValue ? ((reportMetric.value - baselineValue) / baselineValue) * 100 : undefined
        })
      }
    })

    return comparison
  }) || []

  // Filter metrics based on selection and regression filter
  const filteredComparisons = metricComparisons.filter(comparison => {
    const matchesSelection = selectedMetrics.length === 0 || selectedMetrics.includes(comparison.name)
    const hasRegressions = comparison.reports.some(r => r.status === 'fail' || r.status === 'warn')
    
    return matchesSelection && (!showOnlyRegressions || hasRegressions)
  })

  // Generate trend data for line charts
  const generateTrendData = (metricName: string): TrendData[] => {
    return reports
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(report => {
        const metric = report.metrics.find(m => m.name === metricName)
        return {
          date: report.createdAt.toLocaleDateString(),
          [report.name]: metric?.value || 0,
          baseline: metric?.baseline || 0
        }
      })
  }

  // Generate radar data for selected reports
  const generateRadarData = () => {
    const categories = ['blocker', 'guardrail', 'target']
    return categories.map(category => {
      const data: any = { category }
      
      selectedReports.forEach(report => {
        const categoryMetrics = report.metrics.filter(m => m.category === category)
        const avgScore = categoryMetrics.length > 0 
          ? categoryMetrics.reduce((sum, m) => sum + (m.status === 'pass' ? 100 : m.status === 'warn' ? 50 : 0), 0) / categoryMetrics.length
          : 0
        
        data[report.name] = Math.round(avgScore)
      })
      
      return data
    })
  }

  const getRegressionStatus = (comparison: MetricComparison) => {
    const failures = comparison.reports.filter(r => r.status === 'fail').length
    const warnings = comparison.reports.filter(r => r.status === 'warn').length
    
    if (failures > 0) return { status: 'failed', color: '#ef4444' }
    if (warnings > 0) return { status: 'warning', color: '#f59e0b' }
    return { status: 'passed', color: '#10b981' }
  }

  const renderReportSelector = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-md font-semibold">Select Reports to Compare</h4>
        <div className="flex items-center gap-2">
          <Checkbox 
            checked={showOnlyRegressions}
            onCheckedChange={(checked) => setShowOnlyRegressions(checked as boolean)}
          />
          <span className="text-sm">Show only regressions</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(report => (
          <Card key={report.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm">{report.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {formatDistanceToNow(report.createdAt, { addSuffix: true })}
                  </CardDescription>
                </div>
                <Checkbox 
                  checked={selectedReportIds.includes(report.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onSelectionChange([...selectedReportIds, report.id])
                    } else {
                      onSelectionChange(selectedReportIds.filter(id => id !== report.id))
                    }
                  }}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span>Score:</span>
                  <Badge variant={report.summary.overallScore >= 90 ? 'default' : 'secondary'}>
                    {report.summary.overallScore.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={report.summary.blockerStatus === 'passed' ? 'default' : 'destructive'} className="text-xs">
                    Blockers: {report.summary.blockerStatus}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {report.promptVersion}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderSideBySideComparison = () => (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {selectedReports.map(report => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="text-sm">{report.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Overall Score:</span>
                  <span className="font-bold">{report.summary.overallScore.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Tests Passed:</span>
                  <span className="font-bold">{report.passedTests}/{report.totalTests}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Duration:</span>
                  <span className="font-bold">{(report.duration / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Metric Comparison Table */}
      <div className="rounded-md border">
        <div className="grid grid-cols-4 gap-4 p-4 font-medium border-b bg-muted/50">
          <div>Metric</div>
          {selectedReports.map(report => (
            <div key={report.id} className="text-center">{report.name}</div>
          ))}
        </div>
        {filteredComparisons.map(comparison => {
          const regressionStatus = getRegressionStatus(comparison)
          return (
            <div key={comparison.name} className="grid grid-cols-4 gap-4 p-4 border-b hover:bg-muted/50">
              <div className="space-y-1">
                <div className="font-medium">{comparison.name}</div>
                <Badge variant="outline" className="text-xs">
                  {comparison.category}
                </Badge>
                <div className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: regressionStatus.color }}
                  />
                  <span className="text-xs">{regressionStatus.status}</span>
                </div>
              </div>
              {comparison.reports.map(report => (
                <div key={report.reportId} className="text-center space-y-1">
                  <div className="font-bold">{report.value.toFixed(2)}</div>
                  {report.changePercent !== undefined && (
                    <div className={`text-xs flex items-center justify-center gap-1 ${
                      report.changePercent > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {report.changePercent > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {Math.abs(report.changePercent).toFixed(1)}%
                    </div>
                  )}
                  <Badge 
                    variant={report.status === 'pass' ? 'default' : report.status === 'fail' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {report.status}
                  </Badge>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )

  const renderTrendsComparison = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredComparisons.slice(0, 6).map(comparison => (
          <Card key={comparison.name}>
            <CardHeader>
              <CardTitle className="text-sm">{comparison.name}</CardTitle>
              <Badge variant="outline" className="w-fit">
                {comparison.category}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={generateTrendData(comparison.name)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="baseline" 
                      stroke="#8884d8" 
                      strokeDasharray="5 5"
                      name="Baseline"
                    />
                    {selectedReports.map((report, index) => (
                      <Line
                        key={report.id}
                        type="monotone"
                        dataKey={report.name}
                        stroke={['#10b981', '#f59e0b', '#ef4444', '#3b82f6'][index % 4]}
                        strokeWidth={2}
                        name={report.name}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderRadarComparison = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Performance Radar Comparison</CardTitle>
          <CardDescription>
            Overall performance across blocker, guardrail, and target categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={generateRadarData()}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="Blockers"
                  dataKey="blocker"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Guardrails"
                  dataKey="guardrail"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.3}
                />
                <Radar
                  name="Targets"
                  dataKey="target"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.3}
                />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {['blocker', 'guardrail', 'target'].map(category => {
          const categoryMetrics = filteredComparisons.filter(c => c.category === category)
          const avgScores = selectedReports.map(report => {
            const reportMetrics = categoryMetrics.filter(c => 
              c.reports.some(r => r.reportId === report.id && r.status === 'pass')
            )
            return reportMetrics.length > 0 ? (reportMetrics.length / categoryMetrics.length) * 100 : 0
          })

          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-sm capitalize">{category} Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedReports.map((report, index) => (
                    <div key={report.id} className="flex justify-between items-center">
                      <span className="text-sm">{report.name}</span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-20">
                          <Progress value={avgScores[index]} className="h-2" />
                        </div>
                        <span className="text-xs font-bold">{avgScores[index].toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )

  if (selectedReports.length === 0) {
    return (
      <div className="space-y-6">
        {renderReportSelector()}
        <Alert>
          <GitCompare className="h-4 w-4" />
          <AlertTitle>Select Reports to Compare</AlertTitle>
          <AlertDescription>
            Choose at least two evaluation reports to start comparing their performance metrics and regression analysis.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {renderReportSelector()}

      {selectedReports.length > 0 && (
        <>
          {/* Comparison Controls */}
          <div className="flex items-center justify-between">
            <Tabs value={comparisonMode} onValueChange={(value) => setComparisonMode(value as any)}>
              <TabsList>
                <TabsTrigger value="side-by-side">Side by Side</TabsTrigger>
                <TabsTrigger value="trends">Trends Over Time</TabsTrigger>
                <TabsTrigger value="radar">Radar Comparison</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onCompare?.(selectedReportIds)}>
                <GitCompare className="h-4 w-4 mr-2" />
                Compare
              </Button>
              <Button variant="outline" size="sm" onClick={() => onExport?.(selectedReportIds)}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Comparison Views */}
          <Tabs value={comparisonMode}>
            <TabsContent value="side-by-side">
              {renderSideBySideComparison()}
            </TabsContent>
            <TabsContent value="trends">
              {renderTrendsComparison()}
            </TabsContent>
            <TabsContent value="radar">
              {renderRadarComparison()}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
