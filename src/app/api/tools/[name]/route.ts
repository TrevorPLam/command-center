/**
 * Individual Tool Execution API Route
 * 
 * REST API endpoints for executing specific tools with validation,
 * approval handling, and security enforcement.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { toolService, ToolServiceUtils } from '@/lib/app/services/tool-service'
import { 
  ToolExecutionRequest,
  ToolContext,
  ToolCapability,
  isValidToolExecutionRequest,
  isValidToolContext
} from '@/lib/app/tools/types'

// Request validation schemas
const executeToolSchema = z.object({
  input: z.unknown(),
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  conversationId: z.string().optional(),
  workspaceDir: z.string().min(1),
  grantedCapabilities: z.array(z.enum([
    'filesystem-read',
    'filesystem-write',
    'network-egress',
    'database-read',
    'database-write',
    'runtime-query',
    'system-info',
    'process-exec'
  ])).default([]),
  dryRun: z.boolean().default(false),
  approvalToken: z.string().optional()
})

const validateToolSchema = z.object({
  input: z.unknown(),
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  conversationId: z.string().optional(),
  workspaceDir: z.string().min(1),
  grantedCapabilities: z.array(z.enum([
    'filesystem-read',
    'filesystem-write',
    'network-egress',
    'database-read',
    'database-write',
    'runtime-query',
    'system-info',
    'process-exec'
  ])).default([])
})

const assessRiskSchema = z.object({
  input: z.unknown(),
  sessionId: z.string().min(1),
  userId: z.string().optional(),
  conversationId: z.string().optional(),
  workspaceDir: z.string().min(1),
  grantedCapabilities: z.array(z.enum([
    'filesystem-read',
    'filesystem-write',
    'network-egress',
    'database-read',
    'database-write',
    'runtime-query',
    'system-info',
    'process-exec'
  ])).default([])
})

/**
 * GET /api/tools/[name]
 * 
 * Get tool information and metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const toolName = params.name

    // Get tool information
    const tool = await toolService.getTool(toolName)

    return NextResponse.json({
      success: true,
      tool
    })

  } catch (error) {
    console.error('Failed to get tool:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Tool '${params.name}' not found` 
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tools/[name]
 * 
 * Execute a tool with validation and approval handling
 * 
 * Request body:
 * - input: Tool input parameters
 * - sessionId: Session identifier
 * - userId: Optional user identifier
 * - conversationId: Optional conversation identifier
 * - workspaceDir: Workspace directory path
 * - grantedCapabilities: List of granted capabilities
 * - dryRun: If true, validate only without execution
 * - approvalToken: Optional pre-approval token
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const toolName = params.name

    // Parse and validate request body
    const body = await request.json()
    const validatedData = executeToolSchema.parse(body)

    // Create execution context
    const context: ToolContext = toolService.createExecutionContext({
      sessionId: validatedData.sessionId,
      userId: validatedData.userId,
      workspaceDir: validatedData.workspaceDir,
      conversationId: validatedData.conversationId,
      grantedCapabilities: validatedData.grantedCapabilities as ToolCapability[]
    })

    // Create execution request
    const executionRequest: ToolExecutionRequest = toolService.createExecutionRequest({
      toolName,
      input: validatedData.input,
      context,
      dryRun: validatedData.dryRun,
      approvalToken: validatedData.approvalToken
    })

    // Execute the tool
    const result = await toolService.executeTool(executionRequest)

    return NextResponse.json({
      success: true,
      result,
      executionId: context.executionId
    })

  } catch (error) {
    console.error('Failed to execute tool:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Tool '${params.name}' not found` 
        },
        { status: 404 }
      )
    }

    if (error instanceof Error && error.message.includes('APPROVAL_REQUIRED')) {
      // Extract approval request details from the error
      const approvalRequired = JSON.parse(error.message.split('APPROVAL_REQUIRED:')[1] || '{}')
      return NextResponse.json(
        { 
          success: false, 
          error: 'APPROVAL_REQUIRED',
          approvalRequest: approvalRequired
        },
        { status: 202 } // Accepted - pending approval
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/tools/[name]/validate
 * 
 * Validate tool execution without actually executing
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const toolName = params.name

    // Parse and validate request body
    const body = await request.json()
    const validatedData = validateToolSchema.parse(body)

    // Create execution context
    const context: ToolContext = toolService.createExecutionContext({
      sessionId: validatedData.sessionId,
      userId: validatedData.userId,
      workspaceDir: validatedData.workspaceDir,
      conversationId: validatedData.conversationId,
      grantedCapabilities: validatedData.grantedCapabilities as ToolCapability[]
    })

    // Create validation request
    const validationRequest: ToolExecutionRequest = toolService.createExecutionRequest({
      toolName,
      input: validatedData.input,
      context,
      dryRun: true
    })

    // Validate the execution
    const result = await toolService.validateExecution(validationRequest)

    return NextResponse.json({
      success: true,
      validation: result,
      executionId: context.executionId
    })

  } catch (error) {
    console.error('Failed to validate tool:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Tool '${params.name}' not found` 
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/tools/[name]/assess-risk
 * 
 * Assess execution risk for a tool
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const toolName = params.name

    // Parse and validate request body
    const body = await request.json()
    const validatedData = assessRiskSchema.parse(body)

    // Create execution context
    const context: ToolContext = toolService.createExecutionContext({
      sessionId: validatedData.sessionId,
      userId: validatedData.userId,
      workspaceDir: validatedData.workspaceDir,
      conversationId: validatedData.conversationId,
      grantedCapabilities: validatedData.grantedCapabilities as ToolCapability[]
    })

    // Assess risk
    const riskAssessment = await toolService.assessRisk(
      toolName,
      validatedData.input,
      context
    )

    return NextResponse.json({
      success: true,
      riskAssessment,
      executionId: context.executionId
    })

  } catch (error) {
    console.error('Failed to assess risk:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Tool '${params.name}' not found` 
        },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Helper function to extract tool name from request
 */
function getToolNameFromRequest(request: NextRequest): string | null {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  const toolNameIndex = pathParts.findIndex(part => part === 'tools') + 1
  
  return toolNameIndex < pathParts.length ? pathParts[toolNameIndex] : null
}

/**
 * Error handling utility
 */
function handleToolError(error: unknown, toolName: string): NextResponse {
  console.error(`Tool operation failed for '${toolName}':`, error)

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Validation failed',
        details: error.errors
      },
      { status: 400 }
    )
  }

  if (error instanceof Error) {
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Tool '${toolName}' not found` 
        },
        { status: 404 }
      )
    }

    if (error.message.includes('permission')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Permission denied',
          details: error.message
        },
        { status: 403 }
      )
    }

    if (error.message.includes('validation')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Validation failed',
          details: error.message
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { 
      success: false, 
      error: 'Unknown error occurred' 
    },
    { status: 500 }
  )
}
