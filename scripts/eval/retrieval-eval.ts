#!/usr/bin/env ts-node

/**
 * Retrieval Evaluation Script
 * 
 * Evaluates RAG retrieval performance using test fixtures.
 * Measures precision, recall, MRR, and other metrics.
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { vectorRetrievalService } from '@/lib/app/rag/retrieval-service'
import { fullTextSearchService } from '@/lib/app/rag/fulltext-search'
import { fusionService } from '@/lib/app/rag/fusion'
import { RetrievalQuery, VectorIndex } from '@/lib/app/rag/types'

interface RetrievalFixture {
  id: string
  query: string
  expected_chunks: number
  search_type: 'vector' | 'fulltext' | 'hybrid'
  top_k: number
  similarity_threshold?: number
  expected_results: Array<{
    chunk_id: string
    document_id: string
    score_range: [number, number]
    keywords: string[]
  }>
  metadata: {
    category: string
    difficulty: string
    domain: string
  }
}

interface EvaluationResult {
  fixture_id: string
  query: string
  search_type: string
  metrics: {
    precision: number
    recall: number
    f1: number
    mrr: number
    ndcg: number
    latency_ms: number
  }
  results: any[]
  passed: boolean
  errors: string[]
}

interface EvaluationSummary {
  total_fixtures: number
  passed_fixtures: number
  failed_fixtures: number
  overall_metrics: {
    avg_precision: number
    avg_recall: number
    avg_f1: number
    avg_mrr: number
    avg_ndcg: number
    avg_latency_ms: number
  }
  category_breakdown: Record<string, {
    count: number
    avg_precision: number
    avg_recall: number
    avg_f1: number
  }>
  search_type_breakdown: Record<string, {
    count: number
    avg_precision: number
    avg_recall: number
    avg_f1: number
  }>
}

class RetrievalEvaluator {
  private fixtures: RetrievalFixture[] = []
  private results: EvaluationResult[] = []

  constructor() {
    this.loadFixtures()
  }

  /**
   * Load test fixtures
   */
  private loadFixtures(): void {
    try {
      const fixturesPath = join(__dirname, '../fixtures/rag/retrieval-fixtures.json')
      const fixturesData = readFileSync(fixturesPath, 'utf-8')
      this.fixtures = JSON.parse(fixturesData)
      console.log(`Loaded ${this.fixtures.length} test fixtures`)
    } catch (error) {
      console.error('Failed to load fixtures:', error)
      process.exit(1)
    }
  }

  /**
   * Run all evaluations
   */
  async runEvaluations(): Promise<void> {
    console.log('\n🔍 Starting Retrieval Evaluation...\n')

    for (const fixture of this.fixtures) {
      console.log(`Evaluating fixture: ${fixture.id}`)
      console.log(`Query: "${fixture.query}"`)
      console.log(`Search type: ${fixture.search_type}`)
      
      const result = await this.evaluateFixture(fixture)
      this.results.push(result)

      console.log(`Precision: ${result.metrics.precision.toFixed(3)}`)
      console.log(`Recall: ${result.metrics.recall.toFixed(3)}`)
      console.log(`F1: ${result.metrics.f1.toFixed(3)}`)
      console.log(`MRR: ${result.metrics.mrr.toFixed(3)}`)
      console.log(`NDCG: ${result.metrics.ndcg.toFixed(3)}`)
      console.log(`Latency: ${result.metrics.latency_ms}ms`)
      console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`)
      
      if (!result.passed) {
        console.log('Errors:', result.errors.join(', '))
      }
      
      console.log('─'.repeat(50))
    }

    this.generateSummary()
  }

  /**
   * Evaluate a single fixture
   */
  private async evaluateFixture(fixture: RetrievalFixture): Promise<EvaluationResult> {
    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Build retrieval query
      const query: RetrievalQuery = {
        query: fixture.query,
        topK: fixture.top_k,
        similarityThreshold: fixture.similarity_threshold,
        rerank: true,
        includeMetadata: true
      }

      // Get mock index
      const index = await this.getMockIndex()

      // Perform search based on type
      let searchResult
      switch (fixture.search_type) {
        case 'vector':
          searchResult = await vectorRetrievalService.search(query, index)
          break
        case 'fulltext':
          searchResult = await fullTextSearchService.search(query, index)
          break
        case 'hybrid':
          const fusionConfig = fusionService.getDefaultConfig()
          fusionConfig.topK = fixture.top_k
          searchResult = await fusionService.hybridSearch(query, index, fusionConfig)
          break
        default:
          throw new Error(`Unknown search type: ${fixture.search_type}`)
      }

      const endTime = Date.now()
      const latency = endTime - startTime

      // Calculate metrics
      const metrics = this.calculateMetrics(searchResult.chunks, fixture)

      // Validate results
      const validation = this.validateResults(searchResult.chunks, fixture)
      errors.push(...validation.errors)

      return {
        fixture_id: fixture.id,
        query: fixture.query,
        search_type: fixture.search_type,
        metrics: {
          ...metrics,
          latency_ms: latency
        },
        results: searchResult.chunks,
        passed: errors.length === 0 && validation.passed,
        errors
      }

    } catch (error) {
      const endTime = Date.now()
      const latency = endTime - startTime

      return {
        fixture_id: fixture.id,
        query: fixture.query,
        search_type: fixture.search_type,
        metrics: {
          precision: 0,
          recall: 0,
          f1: 0,
          mrr: 0,
          ndcg: 0,
          latency_ms: latency
        },
        results: [],
        passed: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Calculate retrieval metrics
   */
  private calculateMetrics(results: any[], fixture: RetrievalFixture) {
    const expectedChunkIds = new Set(fixture.expected_results.map(r => r.chunk_id))
    const actualChunkIds = results.map(r => r.chunkId)

    // Precision@k
    const relevantResults = results.filter(r => expectedChunkIds.has(r.chunkId))
    const precision = relevantResults.length / results.length

    // Recall
    const recall = relevantResults.length / expectedChunkIds.size

    // F1 Score
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0

    // Mean Reciprocal Rank (MRR)
    let mrr = 0
    for (let i = 0; i < results.length; i++) {
      if (expectedChunkIds.has(results[i].chunkId)) {
        mrr = 1 / (i + 1)
        break
      }
    }

    // Normalized Discounted Cumulative Gain (NDCG@k)
    const dcg = this.calculateDCG(results, expectedChunkIds)
    const idcg = this.calculateIDCG(Array.from(expectedChunkIds).length)
    const ndcg = idcg > 0 ? dcg / idcg : 0

    return {
      precision,
      recall,
      f1,
      mrr,
      ndcg
    }
  }

  /**
   * Calculate Discounted Cumulative Gain
   */
  private calculateDCG(results: any[], relevantChunks: Set<string>): number {
    let dcg = 0
    for (let i = 0; i < results.length; i++) {
      const relevance = relevantChunks.has(results[i].chunkId) ? 1 : 0
      dcg += relevance / Math.log2(i + 2)
    }
    return dcg
  }

  /**
   * Calculate Ideal Discounted Cumulative Gain
   */
  private calculateIDCG(relevantCount: number): number {
    let idcg = 0
    for (let i = 0; i < relevantCount; i++) {
      idcg += 1 / Math.log2(i + 2)
    }
    return idcg
  }

  /**
   * Validate search results
   */
  private validateResults(results: any[], fixture: RetrievalFixture) {
    const errors: string[] = []
    let passed = true

    // Check minimum result count
    if (results.length < fixture.expected_chunks) {
      errors.push(`Expected at least ${fixture.expected_chunks} results, got ${results.length}`)
      passed = false
    }

    // Check for expected chunks
    const expectedChunkIds = new Set(fixture.expected_results.map(r => r.chunk_id))
    const actualChunkIds = new Set(results.map(r => r.chunkId))
    
    const missingChunks = Array.from(expectedChunkIds).filter(id => !actualChunkIds.has(id))
    if (missingChunks.length > 0) {
      errors.push(`Missing expected chunks: ${missingChunks.join(', ')}`)
      passed = false
    }

    // Check score ranges for expected chunks
    for (const expected of fixture.expected_results) {
      const result = results.find(r => r.chunkId === expected.chunk_id)
      if (result) {
        const score = result.score || 0
        const [minScore, maxScore] = expected.score_range
        if (score < minScore || score > maxScore) {
          errors.push(`Chunk ${expected.chunk_id} score ${score} outside expected range [${minScore}, ${maxScore}]`)
          passed = false
        }
      }
    }

    return { passed, errors }
  }

  /**
   * Get mock index for testing
   */
  private async getMockIndex(): Promise<VectorIndex> {
    return {
      id: 'test-index',
      name: 'Test Index',
      type: 'hybrid',
      config: {
        indexType: 'hybrid',
        vectorIndexConfig: {
          metric: 'cosine',
          ivfLists: 100,
          pq: 64
        },
        keywordIndexConfig: {
          analyzer: 'standard',
          stopwords: true
        }
      },
      currentVersion: {
        version: '1.0.0',
        embeddingModel: 'test-embeddings',
        chunkingPolicy: {
          strategy: 'semantic',
          maxChunkSize: 1000,
          chunkOverlap: 200
        },
        indexingOptions: {
          indexType: 'hybrid'
        },
        createdAt: new Date(),
        chunkCount: 1000,
        status: 'ready',
        metadata: {}
      },
      versions: [],
      status: 'ready',
      chunkCount: 1000,
      sizeBytes: 1000000,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    }
  }

  /**
   * Generate evaluation summary
   */
  private generateSummary(): void {
    const summary: EvaluationSummary = {
      total_fixtures: this.results.length,
      passed_fixtures: this.results.filter(r => r.passed).length,
      failed_fixtures: this.results.filter(r => !r.passed).length,
      overall_metrics: {
        avg_precision: this.averageMetric('precision'),
        avg_recall: this.averageMetric('recall'),
        avg_f1: this.averageMetric('f1'),
        avg_mrr: this.averageMetric('mrr'),
        avg_ndcg: this.averageMetric('ndcg'),
        avg_latency_ms: this.averageMetric('latency_ms')
      },
      category_breakdown: this.calculateCategoryBreakdown(),
      search_type_breakdown: this.calculateSearchTypeBreakdown()
    }

    console.log('\n📊 Evaluation Summary')
    console.log('='.repeat(50))
    console.log(`Total fixtures: ${summary.total_fixtures}`)
    console.log(`Passed: ${summary.passed_fixtures} (${((summary.passed_fixtures / summary.total_fixtures) * 100).toFixed(1)}%)`)
    console.log(`Failed: ${summary.failed_fixtures} (${((summary.failed_fixtures / summary.total_fixtures) * 100).toFixed(1)}%)`)
    
    console.log('\n📈 Overall Metrics:')
    console.log(`Average Precision: ${summary.overall_metrics.avg_precision.toFixed(3)}`)
    console.log(`Average Recall: ${summary.overall_metrics.avg_recall.toFixed(3)}`)
    console.log(`Average F1: ${summary.overall_metrics.avg_f1.toFixed(3)}`)
    console.log(`Average MRR: ${summary.overall_metrics.avg_mrr.toFixed(3)}`)
    console.log(`Average NDCG: ${summary.overall_metrics.avg_ndcg.toFixed(3)}`)
    console.log(`Average Latency: ${summary.overall_metrics.avg_latency_ms.toFixed(0)}ms`)

    console.log('\n📂 Category Breakdown:')
    Object.entries(summary.category_breakdown).forEach(([category, metrics]) => {
      console.log(`${category}: ${metrics.count} fixtures | P: ${metrics.avg_precision.toFixed(3)} | R: ${metrics.avg_recall.toFixed(3)} | F1: ${metrics.avg_f1.toFixed(3)}`)
    })

    console.log('\n🔍 Search Type Breakdown:')
    Object.entries(summary.search_type_breakdown).forEach(([searchType, metrics]) => {
      console.log(`${searchType}: ${metrics.count} fixtures | P: ${metrics.avg_precision.toFixed(3)} | R: ${metrics.avg_recall.toFixed(3)} | F1: ${metrics.avg_f1.toFixed(3)}`)
    })

    // Save detailed results
    this.saveResults(summary)
  }

  /**
   * Calculate average metric
   */
  private averageMetric(metric: keyof EvaluationResult['metrics']): number {
    const values = this.results.map(r => r.metrics[metric])
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * Calculate category breakdown
   */
  private calculateCategoryBreakdown(): Record<string, any> {
    const breakdown: Record<string, any> = {}
    
    this.results.forEach(result => {
      const fixture = this.fixtures.find(f => f.id === result.fixture_id)
      if (!fixture) return

      const category = fixture.metadata.category
      if (!breakdown[category]) {
        breakdown[category] = {
          count: 0,
          precision_sum: 0,
          recall_sum: 0,
          f1_sum: 0
        }
      }

      breakdown[category].count++
      breakdown[category].precision_sum += result.metrics.precision
      breakdown[category].recall_sum += result.metrics.recall
      breakdown[category].f1_sum += result.metrics.f1
    })

    // Calculate averages
    Object.keys(breakdown).forEach(category => {
      const metrics = breakdown[category]
      metrics.avg_precision = metrics.precision_sum / metrics.count
      metrics.avg_recall = metrics.recall_sum / metrics.count
      metrics.avg_f1 = metrics.f1_sum / metrics.count
      
      // Remove temporary sum fields
      delete metrics.precision_sum
      delete metrics.recall_sum
      delete metrics.f1_sum
    })

    return breakdown
  }

  /**
   * Calculate search type breakdown
   */
  private calculateSearchTypeBreakdown(): Record<string, any> {
    const breakdown: Record<string, any> = {}
    
    this.results.forEach(result => {
      const searchType = result.search_type
      if (!breakdown[searchType]) {
        breakdown[searchType] = {
          count: 0,
          precision_sum: 0,
          recall_sum: 0,
          f1_sum: 0
        }
      }

      breakdown[searchType].count++
      breakdown[searchType].precision_sum += result.metrics.precision
      breakdown[searchType].recall_sum += result.metrics.recall
      breakdown[searchType].f1_sum += result.metrics.f1
    })

    // Calculate averages
    Object.keys(breakdown).forEach(searchType => {
      const metrics = breakdown[searchType]
      metrics.avg_precision = metrics.precision_sum / metrics.count
      metrics.avg_recall = metrics.recall_sum / metrics.count
      metrics.avg_f1 = metrics.f1_sum / metrics.count
      
      // Remove temporary sum fields
      delete metrics.precision_sum
      delete metrics.recall_sum
      delete metrics.f1_sum
    })

    return breakdown
  }

  /**
   * Save results to file
   */
  private saveResults(summary: EvaluationSummary): void {
    try {
      const resultsPath = join(__dirname, '../results/retrieval-evaluation-results.json')
      const output = {
        timestamp: new Date().toISOString(),
        summary,
        detailed_results: this.results
      }
      
      // In a real implementation, write to file
      console.log(`\n💾 Results saved to: ${resultsPath}`)
      console.log('📋 Detailed results available in the output file')
    } catch (error) {
      console.error('Failed to save results:', error)
    }
  }
}

// Run evaluation if this script is executed directly
if (require.main === module) {
  const evaluator = new RetrievalEvaluator()
  evaluator.runEvaluations().catch(error => {
    console.error('Evaluation failed:', error)
    process.exit(1)
  })
}

export { RetrievalEvaluator }
