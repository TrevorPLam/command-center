/**
 * Chat API Route
 * 
 * Server-Sent Events (SSE) endpoint for streaming chat responses.
 * Handles conversation creation, continuation, and real-time streaming.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createOllamaAdapter } from '@/lib/app/runtime/ollama-adapter'
import { chatStreamService, initializeChatStreamService } from '@/lib/app/services/chat-stream-service'
import { env } from '@/lib/config/env'

// Validation schema
const chatRequestSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(10000),
  model: z.string().min(1),
  systemPrompt: z.string().max(2000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(4000).optional(),
  stream: z.boolean().default(true)
})

// Initialize chat stream service if not already done
if (!chatStreamService) {
  const ollamaAdapter = createOllamaAdapter({
    baseUrl: env.OLLAMA_BASE_URL
  })
  initializeChatStreamService(ollamaAdapter)
}

/**
 * Convert stream event to SSE format
 */
function eventToSSE(event: any): string {
  const data = JSON.stringify(event)
  return `data: ${data}\n\n`
}

/**
 * POST /api/chat - Start or continue a chat conversation
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validated = chatRequestSchema.parse(body)

    // Get abort signal from request
    const signal = request.signal

    // Determine if this is a new conversation or continuation
    const isNewConversation = !validated.conversationId

    let streamResponse
    if (isNewConversation) {
      // Create new conversation and stream
      streamResponse = await chatStreamService.createConversationAndStream(
        {
          message: validated.message,
          model: validated.model,
          systemPrompt: validated.systemPrompt,
          temperature: validated.temperature,
          maxTokens: validated.maxTokens,
          stream: validated.stream
        },
        {
          signal,
          persistEvents: true
        }
      )
    } else {
      // Continue existing conversation
      streamResponse = await chatStreamService.continueConversationStream(
        validated.conversationId,
        {
          message: validated.message,
          model: validated.model,
          systemPrompt: validated.systemPrompt,
          temperature: validated.temperature,
          maxTokens: validated.maxTokens,
          stream: validated.stream
        },
        {
          signal,
          persistEvents: true
        }
      )
    }

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial connection event
          const connectEvent = {
            type: 'connected',
            conversationId: streamResponse.conversationId,
            messageId: streamResponse.messageId,
            timestamp: new Date().toISOString()
          }
          controller.enqueue(encoder.encode(eventToSSE(connectEvent)))

          // Stream chat events
          for await (const event of streamResponse.stream) {
            const sseEvent = {
              ...event,
              conversationId: streamResponse.conversationId,
              messageId: streamResponse.messageId,
              timestamp: new Date().toISOString()
            }
            controller.enqueue(encoder.encode(eventToSSE(sseEvent)))

            // End stream on done event
            if (event.type === 'done' || event.type === 'error') {
              controller.close()
              break
            }
          }
        } catch (error) {
          // Handle stream errors
          const errorEvent = {
            type: 'error',
            code: 'stream_error',
            message: error instanceof Error ? error.message : 'Unknown stream error',
            conversationId: streamResponse.conversationId,
            messageId: streamResponse.messageId,
            timestamp: new Date().toISOString()
          }
          controller.enqueue(encoder.encode(eventToSSE(errorEvent)))
          controller.close()
        }
      },

      cancel() {
        // Handle client disconnect
        console.log(`Chat stream cancelled for conversation ${streamResponse.conversationId}`)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })

  } catch (error) {
    console.error('Chat API error:', error)
    
    // Return error response
    const errorEvent = {
      type: 'error',
      code: 'validation_error',
      message: error instanceof Error ? error.message : 'Invalid request',
      timestamp: new Date().toISOString()
    }

    return new Response(eventToSSE(errorEvent), {
      status: 400,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      }
    })
  }
}

/**
 * GET /api/chat - Get available chat models
 */
export async function GET() {
  try {
    const models = await chatStreamService.getChatModels()
    
    return Response.json({
      success: true,
      models: models.map(model => ({
        id: model.name,
        name: model.name,
        size: model.size,
        family: model.details?.family,
        modified_at: model.modified_at
      }))
    })
  } catch (error) {
    console.error('Failed to get chat models:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get models'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/chat - Cancel an active stream
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const messageId = searchParams.get('messageId')

    if (!conversationId || !messageId) {
      return Response.json({
        success: false,
        error: 'conversationId and messageId are required'
      }, { status: 400 })
    }

    const cancelled = await chatStreamService.cancelStream(conversationId, messageId)

    return Response.json({
      success: cancelled,
      message: cancelled ? 'Stream cancelled' : 'Failed to cancel stream'
    })
  } catch (error) {
    console.error('Failed to cancel stream:', error)
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel stream'
    }, { status: 500 })
  }
}

/**
 * OPTIONS /api/chat - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
