/**
 * Runtime Diagnostics API Route
 * 
 * Provides comprehensive diagnostics information for troubleshooting
 * and monitoring the runtime service.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeService } from '@/lib/app/services/runtime-service'
import { getModelSyncService } from '@/lib/app/services/model-sync-service'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeMetrics = searchParams.get('metrics') === 'true'
    const includeSnapshot = searchParams.get('snapshot') === 'true'
    
    const runtimeService = getRuntimeService()
    const modelSyncService = getModelSyncService()
    
    // Gather basic diagnostics
    const [health, capabilities, models, runningModels] = await Promise.all([
      runtimeService.getHealth(true), // Force refresh
      runtimeService.getCapabilities(),
      runtimeService.listModels(),
      runtimeService.listRunningModels()
    ])
    
    const diagnostics = {
      timestamp: new Date().toISOString(),
      health,
      capabilities,
      models: {
        total: models.length,
        running: runningModels.length,
        available: models.length - runningModels.length,
        list: models.map(m => ({
          name: m.name,
          size: m.size,
          family: m.details?.family,
          contextLength: m.details?.num_ctx,
          modified: m.modified_at
        }))
      },
      runningModels: runningModels.map(m => ({
        name: m.name,
        size: m.size,
        status: m.status,
        expiresAt: m.expires_at
      }))
    }
    
    // Include metrics if requested
    if (includeMetrics) {
      diagnostics.metrics = runtimeService.getMetrics()
    }
    
    // Include snapshot if requested
    if (includeSnapshot) {
      diagnostics.snapshot = await runtimeService.createSnapshot()
    }
    
    return NextResponse.json({
      status: 'success',
      data: diagnostics
    })
  } catch (error) {
    console.error('Diagnostics failed:', error)
    
    return NextResponse.json({
      status: 'error',
      error: {
        code: 'DIAGNOSTICS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { test } = body
    
    const runtimeService = getRuntimeService()
    
    switch (test) {
      case 'connectivity':
        // Test basic connectivity
        const startTime = Date.now()
        await runtimeService.getHealth(true)
        const latency = Date.now() - startTime
        
        return NextResponse.json({
          status: 'success',
          data: {
            test: 'connectivity',
            result: 'passed',
            latency,
            timestamp: new Date().toISOString()
          }
        })
        
      case 'model_loading':
        // Test model loading capabilities
        const models = await runtimeService.listModels()
        const modelNames = models.slice(0, 3).map(m => m.name) // Test first 3 models
        
        const modelTests = await Promise.allSettled(
          modelNames.map(async (modelName) => {
            try {
              const modelInfo = await runtimeService.showModel(modelName)
              return { model: modelName, status: 'success', info: modelInfo }
            } catch (error) {
              return { 
                model: modelName, 
                status: 'failed', 
                error: error instanceof Error ? error.message : 'Unknown error'
              }
            }
          })
        )
        
        return NextResponse.json({
          status: 'success',
          data: {
            test: 'model_loading',
            results: modelTests.map(r => r.status === 'fulfilled' ? r.value : r.reason),
            timestamp: new Date().toISOString()
          }
        })
        
      case 'embeddings':
        // Test embedding generation
        const embeddingModels = await runtimeService.listModels()
        const embeddingModel = embeddingModels.find(m => 
          m.name.toLowerCase().includes('embed') || 
          m.details?.family?.toLowerCase().includes('embed')
        )
        
        if (!embeddingModel) {
          return NextResponse.json({
            status: 'success',
            data: {
              test: 'embeddings',
              result: 'skipped',
              reason: 'No embedding model found',
              timestamp: new Date().toISOString()
            }
          })
        }
        
        try {
          const startTime = Date.now()
          const embeddings = await runtimeService.embed({
            model: embeddingModel.name,
            input: 'Test embedding generation'
          })
          const latency = Date.now() - startTime
          
          return NextResponse.json({
            status: 'success',
            data: {
              test: 'embeddings',
              result: 'passed',
              model: embeddingModel.name,
              dimensions: embeddings[0]?.length,
              latency,
              timestamp: new Date().toISOString()
            }
          })
        } catch (error) {
          return NextResponse.json({
            status: 'success',
            data: {
              test: 'embeddings',
              result: 'failed',
              model: embeddingModel.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }
          })
        }
        
      case 'chat':
        // Test chat completion
        const chatModels = await runtimeService.listModels()
        const chatModel = chatModels.find(m => 
          !m.name.toLowerCase().includes('embed') && 
          !m.details?.family?.toLowerCase().includes('embed')
        )
        
        if (!chatModel) {
          return NextResponse.json({
            status: 'success',
            data: {
              test: 'chat',
              result: 'skipped',
              reason: 'No chat model found',
              timestamp: new Date().toISOString()
            }
          })
        }
        
        try {
          const startTime = Date.now()
          const chatStream = await runtimeService.chat({
            model: chatModel.name,
            messages: [{ role: 'user', content: 'Say "Hello, world!"' }]
          })
          
          // Read first response
          const reader = chatStream.getReader()
          const { value: firstEvent } = await reader.read()
          reader.releaseLock()
          
          const latency = Date.now() - startTime
          
          return NextResponse.json({
            status: 'success',
            data: {
              test: 'chat',
              result: 'passed',
              model: chatModel.name,
              firstEvent,
              latency,
              timestamp: new Date().toISOString()
            }
          })
        } catch (error) {
          return NextResponse.json({
            status: 'success',
            data: {
              test: 'chat',
              result: 'failed',
              model: chatModel.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString()
            }
          })
        }
        
      default:
        return NextResponse.json({
          status: 'error',
          error: {
            code: 'INVALID_TEST',
            message: `Unknown test: ${test}`
          }
        }, { status: 400 })
    }
  } catch (error) {
    console.error('Diagnostic test failed:', error)
    
    return NextResponse.json({
      status: 'error',
      error: {
        code: 'DIAGNOSTIC_TEST_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}
