/**
 * Agent Runner Service
 * 
 * Bounded agent runner that implements explicit turn-based execution
 * with tool calling, progress tracking, and proper limits enforcement.
 * Based on Claude-style agent loop architecture.
 */

import { randomUUID } from 'crypto'
import type { Job } from '@/lib/db/schema'
import { runtimeService } from './runtime-service'
import { getExecutionProvider } from '@/lib/app/tools/execution-provider'
import { jobRepository, toolRunRepository } from '@/lib/app/persistence/job-repository'
import { createApprovalRequest, getApprovalStatus } from '@/app/actions/tool-approvals'
import type { 
  ToolExecutionRequest, 
  ToolExecutionResult 
} from '@/lib/app/tools/types'

export interface AgentConfig {
  maxSteps: number
  maxDurationMs: number
  maxTokensPerStep: number
  maxToolCallsPerStep: number
  approvalRequired: boolean
  enableThinking: boolean
}

export interface AgentTurn {
  id: string
  stepNumber: number
  userInput: string
  assistantResponse: string
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
  tokensUsed: number
  latencyMs: number
  timestamp: Date
}

export interface ToolCall {
  id: string
  name: string
  input: any
  approved: boolean
  executed: boolean
  result?: any
  error?: string
  durationMs?: number
}

export interface ToolResult {
  toolCallId: string
  success: boolean
  result?: any
  error?: string
  durationMs: number
}

export interface AgentResult {
  success: boolean
  finalResponse: string
  turns: AgentTurn[]
  totalSteps: number
  totalTokensUsed: number
  totalDurationMs: number
  toolsUsed: string[]
  error?: string
  aborted: boolean
}

/**
 * Agent Runner Class
 * 
 * Implements bounded agent execution with explicit turn management.
 */
export class AgentRunner {
  private config: AgentConfig
  private jobId: string
  private startTime: Date
  private turns: AgentTurn[] = []
  private toolsUsed: Set<string> = new Set()
  private totalTokensUsed: number = 0
  private isAborted: boolean = false

  constructor(job: Job, config: Partial<AgentConfig> = {}) {
    this.jobId = job.id
    this.startTime = new Date()
    
    // Extract config from job or use defaults
    const jobConfig = JSON.parse(job.config)
    this.config = {
      maxSteps: job.maxSteps || config.maxSteps || 50,
      maxDurationMs: (job as any).timeoutMs || config.maxDurationMs || 300000, // 5 minutes
      maxTokensPerStep: config.maxTokensPerStep || 4000,
      maxToolCallsPerStep: config.maxToolCallsPerStep || 5,
      approvalRequired: jobConfig.requireApproval || config.approvalRequired || false,
      enableThinking: jobConfig.enableThinking || config.enableThinking || false,
      ...config
    }
  }

  /**
   * Run the agent to completion
   */
  async run(initialPrompt: string, signal: AbortSignal): Promise<AgentResult> {
    try {
      // Check if aborted before starting
      if (signal.aborted) {
        throw new Error('Agent run aborted before starting')
      }

      let currentPrompt = initialPrompt
      let stepNumber = 0

      // Main agent loop
      while (stepNumber < this.config.maxSteps && !this.isAborted) {
        // Check limits
        if (this.checkLimits(signal)) {
          break
        }

        // Execute one turn
        const turn = await this.executeTurn(currentPrompt, stepNumber + 1, signal)
        this.turns.push(turn)

        // Update progress
        await this.updateProgress(stepNumber + 1)

        // Check if agent is done
        if (this.isAgentDone(turn)) {
          break
        }

        // Prepare next prompt with tool results
        currentPrompt = this.buildNextPrompt(turn)
        stepNumber++
      }

      // Return final result
      return this.buildResult()

    } catch (error) {
      return this.buildResult(error)
    }
  }

  /**
   * Execute a single agent turn
   */
  private async executeTurn(
    prompt: string, 
    stepNumber: number, 
    signal: AbortSignal
  ): Promise<AgentTurn> {
    const turnId = randomUUID()
    const turnStart = Date.now()

    try {
      // Get model profile from job config
      const jobConfig = JSON.parse((await jobRepository.getById(this.jobId))!.config)
      const modelProfileId = jobConfig.modelProfileId

      // Prepare system prompt with agent instructions
      const systemPrompt = this.buildSystemPrompt(stepNumber)

      // Create chat request
      const chatRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        model: modelProfileId || 'default',
        stream: false,
        maxTokens: this.config.maxTokensPerStep,
        tools: await this.getAvailableTools(),
        enableThinking: this.config.enableThinking
      }

      // Execute chat request
      const response = await runtimeService.chat(chatRequest, signal)
      
      // Parse response for tool calls
      const assistantResponse = response.content || ''
      const toolCalls = this.parseToolCalls(response)

      // Execute tool calls if any
      const toolResults: ToolResult[] = []
      for (const toolCall of toolCalls.slice(0, this.config.maxToolCallsPerStep)) {
        if (signal.aborted) {
          throw new Error('Turn aborted during tool execution')
        }

        const result = await this.executeToolCall(toolCall, signal)
        toolResults.push(result)
        
        if (result.success) {
          this.toolsUsed.add(toolCall.name)
        }
      }

      // Calculate tokens used (simplified)
      const tokensUsed = this.estimateTokens(prompt + assistantResponse)

      const turn: AgentTurn = {
        id: turnId,
        stepNumber,
        userInput: prompt,
        assistantResponse,
        toolCalls,
        toolResults,
        tokensUsed,
        latencyMs: Date.now() - turnStart,
        timestamp: new Date()
      }

      this.totalTokensUsed += tokensUsed

      // Persist turn data
      await this.persistTurn(turn)

      return turn

    } catch (error) {
      if (signal.aborted) {
        this.isAborted = true
        throw new Error('Turn aborted')
      }
      throw error
    }
  }

  /**
   * Execute a tool call
   */
  private async executeToolCall(
    toolCall: ToolCall, 
    signal: AbortSignal
  ): Promise<ToolResult> {
    const startTime = Date.now()

    try {
      // Check if approval is required
      if (this.config.approvalRequired && !toolCall.approved) {
        // Create approval request
        const approvalResult = await createApprovalRequest({
          toolName: toolCall.name,
          input: toolCall.input,
          sessionId: this.jobId,
          executionId: toolCall.id
        })

        if (!approvalResult.success) {
          return {
            toolCallId: toolCall.id,
            success: false,
            error: approvalResult.error || 'Failed to create approval request',
            durationMs: Date.now() - startTime
          }
        }

        // Wait for approval (with timeout)
        const approvalTimeout = 60000 // 1 minute
        const approvalStartTime = Date.now()

        while (Date.now() - approvalStartTime < approvalTimeout) {
          if (signal.aborted) {
            throw new Error('Tool execution aborted during approval wait')
          }

          const statusResult = await getApprovalStatus(approvalResult.requestId!)
          if (statusResult.success && statusResult.status) {
            if (statusResult.status.status === 'approved') {
              toolCall.approved = true
              break
            } else if (statusResult.status.status === 'denied') {
              return {
                toolCallId: toolCall.id,
                success: false,
                error: 'Tool approval denied',
                durationMs: Date.now() - startTime
              }
            } else if (statusResult.status.status === 'expired') {
              return {
                toolCallId: toolCall.id,
                success: false,
                error: 'Tool approval request expired',
                durationMs: Date.now() - startTime
              }
            }
          }

          // Wait before checking again
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

        // If we get here, approval timed out
        return {
          toolCallId: toolCall.id,
          success: false,
          error: 'Tool approval timed out',
          durationMs: Date.now() - startTime
        }
      }

      // Get execution provider
      const executionProvider = getExecutionProvider()

      // Create tool execution request
      const request: ToolExecutionRequest = {
        toolName: toolCall.name,
        input: toolCall.input,
        context: {
          jobId: this.jobId,
          userId: 'system',
          requestId: randomUUID(),
          timestamp: new Date()
        }
      }

      // Execute tool
      const result = await executionProvider.execute(request, signal)

      // Record tool run
      await this.recordToolRun(toolCall, result, true)

      return {
        toolCallId: toolCall.id,
        success: true,
        result: result.output,
        durationMs: result.durationMs || Date.now() - startTime
      }

    } catch (error) {
      // Record failed tool run
      await this.recordToolRun(toolCall, null, false, error)

      return {
        toolCallId: toolCall.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown tool error',
        durationMs: Date.now() - startTime
      }
    }
  }

  /**
   * Parse tool calls from response
   */
  private parseToolCalls(response: any): ToolCall[] {
    const toolCalls: ToolCall[] = []

    // Handle different response formats
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        toolCalls.push({
          id: toolCall.id || randomUUID(),
          name: toolCall.function?.name || 'unknown',
          input: JSON.parse(toolCall.function?.arguments || '{}'),
          approved: !this.config.approvalRequired,
          executed: false
        })
      }
    }

    return toolCalls
  }

  /**
   * Build system prompt for agent
   */
  private buildSystemPrompt(stepNumber: number): string {
    return `You are an AI assistant with access to tools that can help accomplish tasks.

Current step: ${stepNumber} / ${this.config.maxSteps}
Time remaining: ${Math.max(0, this.config.maxDurationMs - (Date.now() - this.startTime.getTime()))}ms

Guidelines:
- Use tools when they can help accomplish the user's request
- Be efficient and purposeful in your actions
- Explain what you're doing and why
- If you need to stop, indicate that you've completed the task or hit a limit

Available tools: ${this.getAvailableToolNames().join(', ')}
${this.config.approvalRequired ? '\nNote: Some tools may require approval before execution.' : ''}`
  }

  /**
   * Get available tools from execution provider
   */
  private async getAvailableTools(): Promise<any[]> {
    const executionProvider = getExecutionProvider()
    return await executionProvider.listTools()
  }

  /**
   * Get available tool names
   */
  private getAvailableToolNames(): string[] {
    // This would be expanded based on available tools
    return ['read-file', 'list-models', 'query-settings', 'get-metrics']
  }

  /**
   * Check if agent is done based on turn results
   */
  private isAgentDone(turn: AgentTurn): boolean {
    // Agent is done if no tool calls were made
    // or if the response indicates completion
    const hasToolCalls = turn.toolCalls.length > 0
    const indicatesCompletion = this.indicatesCompletion(turn.assistantResponse)
    
    return !hasToolCalls || indicatesCompletion
  }

  /**
   * Check if response indicates task completion
   */
  private indicatesCompletion(response: string): boolean {
    const completionPhrases = [
      'task completed',
      'finished',
      'done',
      'complete',
      'accomplished',
      'resolved'
    ]
    
    const lowerResponse = response.toLowerCase()
    return completionPhrases.some(phrase => lowerResponse.includes(phrase))
  }

  /**
   * Build next prompt with tool results
   */
  private buildNextPrompt(turn: AgentTurn): string {
    if (turn.toolResults.length === 0) {
      return turn.assistantResponse
    }

    let nextPrompt = turn.assistantResponse + '\n\nTool Results:\n'
    
    for (const result of turn.toolResults) {
      nextPrompt += `- ${result.toolCallId}: `
      if (result.success) {
        nextPrompt += `Success: ${JSON.stringify(result.result)}\n`
      } else {
        nextPrompt += `Error: ${result.error}\n`
      }
    }

    nextPrompt += '\nPlease continue based on these results.'
    
    return nextPrompt
  }

  /**
   * Check limits and constraints
   */
  private checkLimits(signal: AbortSignal): boolean {
    // Check abort signal
    if (signal.aborted) {
      this.isAborted = true
      return true
    }

    // Check duration
    const elapsedMs = Date.now() - this.startTime.getTime()
    if (elapsedMs > this.config.maxDurationMs) {
      return true
    }

    // Check token limit (simplified)
    if (this.totalTokensUsed > this.config.maxTokensPerStep * this.config.maxSteps) {
      return true
    }

    return false
  }

  /**
   * Update job progress
   */
  private async updateProgress(stepNumber: number): Promise<void> {
    const progress = stepNumber / this.config.maxSteps
    await jobRepository.updateProgress(this.jobId, progress, stepNumber)
  }

  /**
   * Persist turn data
   */
  private async persistTurn(turn: AgentTurn): Promise<void> {
    // Store turn data in job metadata or separate table
    const job = await jobRepository.getById(this.jobId)
    if (!job) return

    const metadata = job.metadata ? JSON.parse(job.metadata) : {}
    metadata.turns = metadata.turns || []
    metadata.turns.push(turn)

    await jobRepository.update(this.jobId, {
      metadata: JSON.stringify(metadata)
    })
  }

  /**
   * Record tool run with comprehensive audit logging
   */
  private async recordToolRun(
    toolCall: ToolCall, 
    result: any, 
    success: boolean, 
    error?: Error
  ): Promise<void> {
    const auditData = {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      input: toolCall.input,
      output: success ? result?.output : null,
      success,
      error: error?.message,
      durationMs: result?.durationMs || Date.now() - (toolCall as any).startTime,
      approved: toolCall.approved,
      jobId: this.jobId,
      stepNumber: this.turns.length + 1,
      timestamp: new Date(),
      riskLevel: this.getToolRiskLevel(toolCall.name),
      capabilities: this.getToolCapabilities(toolCall.name)
    }

    await toolRunRepository.create({
      id: randomUUID(),
      jobId: this.jobId,
      toolName: toolCall.name,
      input: JSON.stringify(toolCall.input),
      output: success ? JSON.stringify(result?.output) : null,
      status: success ? 'completed' : 'failed',
      error: error?.message,
      durationMs: result?.durationMs,
      metadata: JSON.stringify({
        approved: toolCall.approved,
        stepNumber: this.turns.length + 1,
        riskLevel: auditData.riskLevel,
        capabilities: auditData.capabilities
      })
    })
  }

  /**
   * Get tool risk level
   */
  private getToolRiskLevel(toolName: string): 'low' | 'medium' | 'high' {
    const highRiskTools = ['shell-command', 'write-file', 'delete-file']
    const mediumRiskTools = ['index-file', 'summarize-file']
    
    if (highRiskTools.includes(toolName)) return 'high'
    if (mediumRiskTools.includes(toolName)) return 'medium'
    return 'low'
  }

  /**
   * Get tool capabilities
   */
  private getToolCapabilities(toolName: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      'read-file': ['file-read', 'local-access'],
      'write-file': ['file-write', 'local-access', 'data-modification'],
      'delete-file': ['file-delete', 'local-access', 'data-destruction'],
      'shell-command': ['shell-execution', 'system-access', 'command-execution'],
      'index-file': ['file-read', 'search-indexing', 'data-processing'],
      'summarize-file': ['file-read', 'text-processing', 'content-analysis'],
      'list-models': ['model-discovery', 'runtime-query'],
      'query-settings': ['config-read', 'settings-access'],
      'get-metrics': ['metrics-read', 'system-monitoring']
    }
    
    return capabilityMap[toolName] || []
  }

  /**
   * Estimate token count (simplified)
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  /**
   * Build final result
   */
  private buildResult(error?: Error): AgentResult {
    const lastTurn = this.turns[this.turns.length - 1]
    const finalResponse = lastTurn?.assistantResponse || ''
    const totalDurationMs = Date.now() - this.startTime.getTime()

    return {
      success: !error && !this.isAborted && this.turns.length > 0,
      finalResponse,
      turns: this.turns,
      totalSteps: this.turns.length,
      totalTokensUsed: this.totalTokensUsed,
      totalDurationMs,
      toolsUsed: Array.from(this.toolsUsed),
      error: error?.message,
      aborted: this.isAborted
    }
  }
}

/**
 * Create and run an agent
 */
export async function runAgent(job: Job, signal: AbortSignal): Promise<AgentResult> {
  const runner = new AgentRunner(job)
  const jobConfig = JSON.parse(job.config)
  
  return await runner.run(jobConfig.prompt, signal)
}
