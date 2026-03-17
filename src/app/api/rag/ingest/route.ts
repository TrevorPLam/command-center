/**
 * RAG Ingestion API Route
 * 
 * Handles document upload and ingestion requests.
 * Supports both file uploads and directory watch configuration.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { IngestionService, UploadRequestSchema, DirectoryWatchRequestSchema } from '@/lib/app/services/ingestion-service'

// POST /api/rag/ingest - Upload documents for ingestion
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type')
    
    if (!contentType) {
      return NextResponse.json(
        { error: 'Content-Type header is required' },
        { status: 400 }
      )
    }

    // Handle multipart form data (file uploads)
    if (contentType.includes('multipart/form-data')) {
      return handleFileUpload(req)
    }

    // Handle JSON requests (directory watch, etc.)
    if (contentType.includes('application/json')) {
      return handleJsonRequest(req)
    }

    return NextResponse.json(
      { error: 'Unsupported content type' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Ingestion API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET /api/rag/ingest - Get ingestion status and jobs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')
    const status = searchParams.get('status')

    // Get specific job status
    if (jobId) {
      return getJobStatus(jobId)
    }

    // Get jobs by status
    if (status) {
      return getJobsByStatus(status)
    }

    // Get all recent jobs
    return getAllJobs()

  } catch (error) {
    console.error('Ingestion status API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/rag/ingest - Cancel or delete ingestion jobs
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId parameter is required' },
        { status: 400 }
      )
    }

    return cancelJob(jobId)

  } catch (error) {
    console.error('Ingestion cancel API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle multipart file upload
 */
async function handleFileUpload(req: NextRequest) {
  try {
    const formData = await req.formData()
    
    // Extract files
    const files: File[] = []
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Extract configuration
    const indexId = formData.get('indexId') as string
    const chunkingPolicyStr = formData.get('chunkingPolicy') as string
    const embeddingModel = formData.get('embeddingModel') as string

    if (!indexId) {
      return NextResponse.json(
        { error: 'indexId is required' },
        { status: 400 }
      )
    }

    // Parse chunking policy if provided
    let chunkingPolicy
    if (chunkingPolicyStr) {
      try {
        chunkingPolicy = JSON.parse(chunkingPolicyStr)
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid chunkingPolicy JSON' },
          { status: 400 }
        )
      }
    }

    // Create upload request
    const uploadRequest: UploadRequestSchema = {
      files,
      indexId,
      ...(chunkingPolicy && { chunkingPolicy }),
      ...(embeddingModel && { embeddingModel })
    }

    // Process upload
    const job = await IngestionService.handleUpload(uploadRequest)

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        config: job.config,
        createdAt: job.createdAt
      }
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle JSON requests (directory watch, etc.)
 */
async function handleJsonRequest(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Determine request type
    if (body.type === 'directory_watch') {
      const { path, patterns, ignorePatterns, recursive, autoIndex, indexId, chunkingPolicy, embeddingModel } = body
      
      const watchRequest = DirectoryWatchRequestSchema.parse({
        path,
        patterns,
        ignorePatterns,
        recursive,
        autoIndex,
        indexId,
        chunkingPolicy,
        embeddingModel
      })

      const watchId = await IngestionService.configureDirectoryWatch(watchRequest)

      return NextResponse.json({
        success: true,
        watchId
      })
    }

    return NextResponse.json(
      { error: 'Unsupported request type' },
      { status: 400 }
    )

  } catch (error) {
    console.error('JSON request error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    )
  }
}

/**
 * Get specific job status
 */
async function getJobStatus(jobId: string) {
  try {
    // This would query the job repository
    // For now, return mock data
    return NextResponse.json({
      job: {
        id: jobId,
        status: 'running',
        progress: 0.65,
        startedAt: new Date().toISOString(),
        config: {
          sourceType: 'upload',
          indexId: 'default-index'
        }
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 }
    )
  }
}

/**
 * Get jobs by status
 */
async function getJobsByStatus(status: string) {
  try {
    // This would query the job repository
    // For now, return mock data
    return NextResponse.json({
      jobs: [
        {
          id: 'job-1',
          status: 'running',
          progress: 0.45,
          createdAt: new Date(Date.now() - 300000).toISOString()
        },
        {
          id: 'job-2',
          status: 'completed',
          progress: 1.0,
          createdAt: new Date(Date.now() - 600000).toISOString(),
          completedAt: new Date(Date.now() - 120000).toISOString()
        }
      ]
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

/**
 * Get all recent jobs
 */
async function getAllJobs() {
  try {
    // This would query the job repository
    // For now, return mock data
    return NextResponse.json({
      jobs: [
        {
          id: 'job-1',
          type: 'rag_ingest',
          status: 'running',
          progress: 0.75,
          createdAt: new Date(Date.now() - 300000).toISOString(),
          startedAt: new Date(Date.now() - 290000).toISOString(),
          config: {
            sourceType: 'upload',
            indexId: 'docs-index'
          }
        },
        {
          id: 'job-2',
          type: 'rag_ingest',
          status: 'completed',
          progress: 1.0,
          createdAt: new Date(Date.now() - 600000).toISOString(),
          startedAt: new Date(Date.now() - 590000).toISOString(),
          completedAt: new Date(Date.now() - 120000).toISOString(),
          result: {
            documentsProcessed: 5,
            documentsSucceeded: 5,
            documentsFailed: 0,
            chunksGenerated: 47,
            embeddingsGenerated: 47
          }
        },
        {
          id: 'job-3',
          type: 'rag_ingest',
          status: 'failed',
          progress: 0.2,
          createdAt: new Date(Date.now() - 900000).toISOString(),
          startedAt: new Date(Date.now() - 890000).toISOString(),
          completedAt: new Date(Date.now() - 800000).toISOString(),
          error: 'Failed to parse PDF file: Corrupted format'
        }
      ]
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

/**
 * Cancel a job
 */
async function cancelJob(jobId: string) {
  try {
    // This would update the job status in the repository
    // For now, return success
    return NextResponse.json({
      success: true,
      message: `Job ${jobId} cancelled`
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to cancel job' },
      { status: 500 }
    )
  }
}
