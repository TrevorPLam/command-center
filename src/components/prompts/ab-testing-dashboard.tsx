/**
 * A/B Testing Dashboard Component
 * 
 * Advanced A/B testing interface with statistical significance, confidence intervals,
 * and winner declaration based on evaluation metrics.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
  ScatterChart,
  Scatter,
  Legend,
  ReferenceLine,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts'
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target,
  Calculator,
  Eye,
  GitCompare,
  Play,
  Pause,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'

import type { EvalReport } from './eval-report'
import { EvalReport } from './eval-report'
import { RegressionComparison } from './regression-comparison'

interface ABTestConfig {
  name: string
  description: string
  promptAId: string
  promptBId: string
  trafficSplit: number // 0-100, percentage for prompt A
  sampleSize: number
  confidenceLevel: 95 | 99
  metrics: string[]
  status: 'draft' | 'running' | 'completed' | 'paused'
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

interface ABTestResult {
  testId: string
  promptA: {
    id: string
    name: string
    impressions: number
    conversions: number
    conversionRate: number
    avgLatency: number
    avgScore: number
    confidenceInterval: [number, number]
  }
  promptB: {
    id: string
    name: string
    impressions: number
    conversions: number
    conversionRate: number
    avgLatency: number
    avgScore: number
    confidenceInterval: [number, number]
  }
  statisticalSignificance: {
    pValue: number
    isSignificant: boolean
    confidence: number
    winner: 'A' | 'B' | 'tie' | 'inconclusive'
  }
  relativeImprovement: number
  absoluteImprovement: number
  power: number
  status: 'running' | 'completed'
}

interface ABTestingDashboardProps {
  tests: ABTestConfig[]
  results: ABTestResult[]
  evalReports: EvalReport[]
  onCreateTest?: () => void
  onRunTest?: (testId: string) => void
  onPauseTest?: (testId: string) => void
  onViewDetails?: (testId: string) => void
}

export function ABTestingDashboard({ 
  tests, 
  results, 
  evalReports,
  onCreateTest,
  onRunTest,
  onPauseTest,
  onViewDetails
}: ABTestingDashboardProps) {
  const [selectedTest, setSelectedTest] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<string>('conversionRate')
  const [showStatisticalDetails, setShowStatisticalDetails] = useState(false)

  const activeTest = tests.find(t => t.id === selectedTest)
  const testResult = results.find(r => r.testId === selectedTest)

  const getTestStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'secondary' as const, label: 'Draft', icon: <Target className="h-3 w-3" /> },
      running: { variant: 'default' as const, label: 'Running', icon: <Play className="h-3 w-3" /> },
      completed: { variant: 'default' as const, label: 'Completed', icon: <CheckCircle className="h-3 w-3" /> },
      paused: { variant: 'outline' as const, label: 'Paused', icon: <Pause className="h-3 w-3" /> }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    )
  }

  const getWinnerBadge = (winner: string) => {
    const winnerConfig = {
      A: { variant: 'default' as const, label: 'Prompt A Wins', color: 'text-blue-600' },
      B: { variant: 'default' as const, label: 'Prompt B Wins', color: 'text-green-600' },
      tie: { variant: 'secondary' as const, label: 'Tie', color: 'text-gray-600' },
      inconclusive: { variant: 'outline' as const, label: 'Inconclusive', color: 'text-orange-600' }
    }

    const config = winnerConfig[winner as keyof typeof winnerConfig] || winnerConfig.inconclusive
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>
  }

  const calculateSampleSizeProgress = (test: ABTestConfig, result?: ABTestResult) => {
    const totalImpressions = result ? result.promptA.impressions + result.promptB.impressions : 0
    return Math.min((totalImpressions / test.sampleSize) * 100, 100)
  }

  const renderTestList = () => (
    <div className="space-y-4">
      {tests.map(test => {
        const result = results.find(r => r.testId === test.id)
        const progress = calculateSampleSizeProgress(test, result)
        
        return (
          <Card key={test.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm">{test.name}</CardTitle>
                  <CardDescription className="text-xs">{test.description}</CardDescription>
                  <div className="flex items-center gap-2">
                    {getTestStatusBadge(test.status)}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(test.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {test.status === 'draft' && onRunTest && (
                    <Button size="sm" onClick={() => onRunTest(test.id)}>
                      <Play className="h-3 w-3 mr-1" />
                      Start
                    </Button>
                  )}
                  {test.status === 'running' && onPauseTest && (
                    <Button size="sm" variant="outline" onClick={() => onPauseTest(test.id)}>
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  {onViewDetails && (
                    <Button size="sm" variant="outline" onClick={() => onViewDetails(test.id)}>
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {/* Sample Size Progress */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Sample Size Progress</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{result ? result.promptA.impressions + result.promptB.impressions : 0}</span>
                    <span>{test.sampleSize}</span>
                  </div>
                </div>

                {/* Results Summary */}
                {result && (
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="font-medium">Prompt A</div>
                      <div>Conversion: {(result.promptA.conversionRate * 100).toFixed(1)}%</div>
                      <div>Latency: {result.promptA.avgLatency.toFixed(0)}ms</div>
                    </div>
                    <div>
                      <div className="font-medium">Prompt B</div>
                      <div>Conversion: {(result.promptB.conversionRate * 100).toFixed(1)}%</div>
                      <div>Latency: {result.promptB.avgLatency.toFixed(0)}ms</div>
                    </div>
                  </div>
                )}

                {/* Winner Declaration */}
                {result && result.statisticalSignificance.isSignificant && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Result:</span>
                    {getWinnerBadge(result.statisticalSignificance.winner)}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  const renderTestDetails = () => {
    if (!activeTest || !testResult) return null

    const chartData = [
      {
        name: 'Conversion Rate',
        promptA: testResult.promptA.conversionRate * 100,
        promptB: testResult.promptB.conversionRate * 100,
        improvement: testResult.relativeImprovement
      },
      {
        name: 'Avg Score',
        promptA: testResult.promptA.avgScore,
        promptB: testResult.promptB.avgScore,
        improvement: ((testResult.promptB.avgScore - testResult.promptA.avgScore) / testResult.promptA.avgScore) * 100
      },
      {
        name: 'Avg Latency (ms)',
        promptA: testResult.promptA.avgLatency,
        promptB: testResult.promptB.avgLatency,
        improvement: ((testResult.promptB.avgLatency - testResult.promptA.avgLatency) / testResult.promptA.avgLatency) * 100
      }
    ]

    const timeSeriesData = [
      // This would come from actual time series data
      { time: 'Day 1', promptA: 0.12, promptB: 0.11 },
      { time: 'Day 2', promptA: 0.13, promptB: 0.14 },
      { time: 'Day 3', promptA: 0.12, promptB: 0.15 },
      { time: 'Day 4', promptA: 0.14, promptB: 0.16 },
      { time: 'Day 5', promptA: 0.13, promptB: 0.17 }
    ]

    return (
      <div className="space-y-6">
        {/* Test Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Test Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Traffic Split:</span>
                  <span>{activeTest.trafficSplit}% / {100 - activeTest.trafficSplit}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Sample Size:</span>
                  <span>{activeTest.sampleSize.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence Level:</span>
                  <span>{activeTest.confidenceLevel}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Statistical Significance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>P-Value:</span>
                  <span className={testResult.statisticalSignificance.pValue < 0.05 ? 'text-green-600' : 'text-red-600'}>
                    {testResult.statisticalSignificance.pValue.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Power:</span>
                  <span>{(testResult.power * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  {getWinnerBadge(testResult.statisticalSignificance.winner)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Improvement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Relative:</span>
                  <span className={testResult.relativeImprovement > 0 ? 'text-green-600' : 'text-red-600'}>
                    {testResult.relativeImprovement > 0 ? '+' : ''}{testResult.relativeImprovement.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Absolute:</span>
                  <span className={testResult.absoluteImprovement > 0 ? 'text-green-600' : 'text-red-600'}>
                    {testResult.absoluteImprovement > 0 ? '+' : ''}{(testResult.absoluteImprovement * 100).toFixed(2)}pp
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Comparison</CardTitle>
            <CardDescription>
              Side-by-side comparison of key metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="promptA" fill="#8884d8" name="Prompt A" />
                  <Bar dataKey="promptB" fill="#82ca9d" name="Prompt B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Time Series */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Rate Over Time</CardTitle>
            <CardDescription>
              Daily conversion rates for both variants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="promptA" stroke="#8884d8" strokeWidth={2} name="Prompt A" />
                  <Line type="monotone" dataKey="promptB" stroke="#82ca9d" strokeWidth={2} name="Prompt B" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Confidence Intervals */}
        {showStatisticalDetails && (
          <Card>
            <CardHeader>
              <CardTitle>Confidence Intervals</CardTitle>
              <CardDescription>
                {activeTest.confidenceLevel}% confidence intervals for key metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {chartData.map(metric => (
                  <div key={metric.name} className="space-y-2">
                    <div className="font-medium">{metric.name}</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Prompt A</div>
                        <div>{metric.promptA.toFixed(3)} ± {((testResult.promptA.confidenceInterval[1] - testResult.promptA.confidenceInterval[0]) / 2).toFixed(3)}</div>
                        <div className="text-xs text-muted-foreground">
                          [{testResult.promptA.confidenceInterval[0].toFixed(3)}, {testResult.promptA.confidenceInterval[1].toFixed(3)}]
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">Prompt B</div>
                        <div>{metric.promptB.toFixed(3)} ± {((testResult.promptB.confidenceInterval[1] - testResult.promptB.confidenceInterval[0]) / 2).toFixed(3)}</div>
                        <div className="text-xs text-muted-foreground">
                          [{testResult.promptB.confidenceInterval[0].toFixed(3)}, {testResult.promptB.confidenceInterval[1].toFixed(3)}]
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch 
              checked={showStatisticalDetails}
              onCheckedChange={setShowStatisticalDetails}
            />
            <span className="text-sm">Show Statistical Details</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Results
            </Button>
            <Button variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Test
            </Button>
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
          <h2 className="text-2xl font-bold">A/B Testing Dashboard</h2>
          <p className="text-muted-foreground">
            Design, run, and analyze A/B tests for prompt optimization
          </p>
        </div>
        <div className="flex gap-2">
          {onCreateTest && (
            <Button onClick={onCreateTest}>
              <Target className="h-4 w-4 mr-2" />
              New Test
            </Button>
          )}
        </div>
      </div>

      {/* Test Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Test List */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Active Tests</h3>
          {renderTestList()}
        </div>

        {/* Test Details */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Test Details</h3>
          {selectedTest ? (
            renderTestDetails()
          ) : (
            <Alert>
              <Target className="h-4 w-4" />
              <AlertTitle>Select a Test</AlertTitle>
              <AlertDescription>
                Choose a test from the list to view detailed results and analysis.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
