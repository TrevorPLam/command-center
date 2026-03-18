/**
 * Summarize File Tool
 * 
 * Medium-risk tool for generating file summaries using AI.
 * Provides bounded file processing with AI-powered summarization.
 */

import { z } from 'zod'
import { readFile, stat } from 'fs/promises'
import { join, relative, extname } from 'path'
import { BuiltinTool, ToolContext, ToolCapability } from '../types'
import { RuntimeAdapter } from '../../runtime/types'

/**
 * Input schema for summarize-file tool
 */
export const SummarizeFileInputSchema = z.object({
  /** File path relative to workspace */
  path: z.string().min(1).max(500),
  /** Summary length */
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  /** Summary type */
  type: z.enum(['general', 'technical', 'executive']).default('general'),
  /** Include code examples in summary */
  includeCodeExamples: z.boolean().default(true),
  /** Maximum file size to process (bytes) */
  maxFileSize: z.number().int().min(1000).max(1_000_000).default(100_000),
  /** Language model to use for summarization */
  model: z.string().optional()
})

/**
 * Output schema for summarize-file tool
 */
export const SummarizeFileOutputSchema = z.object({
  /** Summary result */
  success: z.boolean(),
  /** Generated summary */
  summary: z.string().optional(),
  /** File information */
  fileInfo: z.object({
    fileName: z.string(),
    fileSize: z.number(),
    fileType: z.string(),
    language: z.string().optional()
  }).optional(),
  /** Processing metadata */
  metadata: z.object({
    processingTime: z.number(),
    tokensUsed: z.number(),
    modelUsed: z.string(),
    summaryLength: z.number()
  }).optional(),
  /** Error information */
  error: z.object({
    code: z.string(),
    message: z.string()
  }).optional()
})

/**
 * Supported file types for summarization
 */
const SUMMARIZABLE_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.yaml', '.yml', '.csv', '.log',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.php', '.java',
  '.c', '.cpp', '.h', '.hpp', '.rs', '.go', '.sh', '.sql',
  '.html', '.css', '.xml', '.rst', '.tex'
])

/**
 * File type to programming language mapping
 */
const FILE_LANGUAGES: Record<string, string> = {
  '.js': 'JavaScript',
  '.ts': 'TypeScript',
  '.jsx': 'JavaScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.java': 'Java',
  '.c': 'C',
  '.cpp': 'C++',
  '.h': 'C',
  '.hpp': 'C++',
  '.rs': 'Rust',
  '.go': 'Go',
  '.sh': 'Shell',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.css': 'CSS',
  '.xml': 'XML',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.md': 'Markdown',
  '.rst': 'reStructuredText',
  '.tex': 'LaTeX',
  '.txt': 'Plain Text',
  '.csv': 'CSV',
  '.log': 'Log File'
}

/**
 * Summarize file tool implementation
 */
export class SummarizeFileTool implements BuiltinTool {
  readonly descriptor = {
    name: 'summarize-file',
    description: 'Generate AI-powered summaries of files within the workspace',
    version: '1.0.0',
    author: 'Command Center',
    capabilities: ['filesystem-read', 'runtime-query'] as ToolCapability[],
    riskLevel: 'medium' as const,
    approvalRequired: false, // Medium risk but bounded to workspace
    executionScope: {
      allowedPaths: ['**/*'], // Allow all files within workspace
      deniedPaths: [
        '**/.git/**',
        '**/node_modules/**',
        '**/.env*',
        '**/*.key',
        '**/*.pem',
        '**/*.p12',
        '**/secrets/**',
        '**/.ssh/**',
        '**/.aws/**',
        '**/*.exe',
        '**/*.dll',
        '**/*.so',
        '**/*.dylib',
        '**/*.bin',
        '**/*.img',
        '**/*.iso',
        '**/*.dmg',
        '**/*.zip',
        '**/*.tar',
        '**/*.gz',
        '**/*.pdf',
        '**/*.png',
        '**/*.jpg',
        '**/*.jpeg',
        '**/*.gif'
      ],
      networkRules: {
        defaultAllow: false
      },
      resourceLimits: {
        maxExecutionTimeSec: 120, // 2 minutes for AI processing
        maxMemoryMB: 512
      },
      requiredPermissions: ['filesystem-read', 'runtime-query'] as ToolCapability[]
    },
    inputSchema: SummarizeFileInputSchema,
    outputSchema: SummarizeFileOutputSchema,
    tags: ['summarization', 'ai', 'files', 'transform'],
    metadata: {
      category: 'transform',
      readOnly: false,
      safeForAutomation: false, // Requires AI monitoring
      boundedToWorkspace: true,
      usesAI: true
    }
  }

  constructor(private runtime: RuntimeAdapter) {}

  /**
   * Execute the summarize-file tool
   */
  async execute(input: unknown, context: ToolContext): Promise<unknown> {
    const startTime = Date.now()
    const parsedInput = SummarizeFileInputSchema.parse(input)
    
    try {
      // Validate and resolve path
      const resolvedPath = this.resolvePath(parsedInput.path, context.workspaceDir)
      
      // Check file exists and get stats
      const fileStats = await stat(resolvedPath)
      if (!fileStats.isFile()) {
        throw new Error(`Path '${parsedInput.path}' is not a file`)
      }

      // Check file type support
      const ext = extname(resolvedPath).toLowerCase()
      if (!SUMMARIZABLE_EXTENSIONS.has(ext)) {
        throw new Error(`File type '${ext}' is not supported for summarization`)
      }

      // Check file size
      if (fileStats.size > parsedInput.maxFileSize) {
        throw new Error(`File size (${fileStats.size} bytes) exceeds limit (${parsedInput.maxFileSize} bytes)`)
      }

      // Read file content
      const content = await readFile(resolvedPath, 'utf-8')
      
      // Generate summary using AI
      const result = await this.generateSummary(
        content,
        parsedInput,
        context,
        resolvedPath,
        fileStats
      )

      const processingTime = Date.now() - startTime

      return {
        success: true,
        summary: result.summary,
        fileInfo: {
          fileName: parsedInput.path,
          fileSize: fileStats.size,
          fileType: ext,
          language: FILE_LANGUAGES[ext]
        },
        metadata: {
          processingTime,
          tokensUsed: result.tokensUsed,
          modelUsed: result.modelUsed,
          summaryLength: result.summary.length
        }
      }

    } catch (error) {
      return {
        success: false,
        error: {
          code: this.getErrorCode(error),
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }
  }

  /**
   * Validate input (optional method)
   */
  validate?(input: unknown): { valid: boolean; errors: string[] } {
    try {
      const parsed = SummarizeFileInputSchema.parse(input)
      
      // Additional validation
      const errors: string[] = []
      
      // Check for path traversal attempts
      if (parsed.path.includes('..') || parsed.path.includes('~')) {
        errors.push('Path cannot contain ".." or "~" characters')
      }
      
      // Check for absolute paths
      if (parsed.path.startsWith('/') || /^[A-Za-z]:/.test(parsed.path)) {
        errors.push('Path must be relative to workspace')
      }

      // Validate file size
      if (parsed.maxFileSize < 1000 || parsed.maxFileSize > 1_000_000) {
        errors.push('Max file size must be between 1KB and 1MB')
      }
      
      return {
        valid: errors.length === 0,
        errors
      }
    } catch (error) {
      return {
        valid: false,
        errors: error instanceof Error ? [error.message] : ['Unknown validation error']
      }
    }
  }

  /**
   * Generate summary using AI
   */
  private async generateSummary(
    content: string,
    options: any,
    context: ToolContext,
    filePath: string,
    fileStats: any
  ): Promise<{
    summary: string
    tokensUsed: number
    modelUsed: string
  }> {
    // Determine model to use
    const model = options.model || 'llama3.1:8b'
    
    // Create summarization prompt
    const prompt = this.createSummarizationPrompt(content, options, filePath)
    
    try {
      // Call AI runtime for summarization
      const response = await this.runtime.chat({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant that creates accurate, concise summaries of code and text files.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        options: {
          temperature: 0.3, // Lower temperature for more consistent summaries
          num_predict: this.getMaxTokens(options.length)
        },
        stream: false,
        totalTimeoutMs: 60000 // 1 minute timeout
      })

      // Extract summary from response
      const summary = response.message?.content || 'Unable to generate summary'
      
      // Estimate token usage (rough approximation)
      const tokensUsed = this.estimateTokenCount(prompt) + this.estimateTokenCount(summary)

      return {
        summary: summary.trim(),
        tokensUsed,
        modelUsed: model
      }

    } catch (error) {
      throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create summarization prompt
   */
  private createSummarizationPrompt(content: string, options: any, filePath: string): string {
    const ext = extname(filePath).toLowerCase()
    const language = FILE_LANGUAGES[ext] || 'Unknown'
    
    // Truncate content if too long
    const maxContentLength = 8000 // Keep content manageable for AI
    const truncatedContent = content.length > maxContentLength
      ? content.slice(0, maxContentLength) + '\n\n[Content truncated for summarization...]'
      : content

    let prompt = `Please summarize the following ${language} file located at "${filePath}".\n\n`
    
    // Add summary type instructions
    switch (options.type) {
      case 'technical':
        prompt += 'Focus on technical details, architecture, APIs, and implementation specifics. '
        break
      case 'executive':
        prompt += 'Focus on business value, purpose, and key outcomes. Avoid technical jargon. '
        break
      default:
        prompt += 'Provide a balanced overview of the content. '
    }

    // Add length instructions
    switch (options.length) {
      case 'short':
        prompt += 'Keep the summary concise (2-3 sentences max). '
        break
      case 'long':
        prompt += 'Provide a detailed summary with multiple paragraphs. '
        break
      default:
        prompt += 'Provide a medium-length summary (1-2 paragraphs). '
    }

    // Add code examples instruction
    if (options.includeCodeExamples && this.isCodeFile(ext)) {
      prompt += 'Include relevant code examples to illustrate key concepts. '
    } else {
      prompt += 'Do not include code examples in the summary. '
    }

    prompt += '\n\nFile content:\n```\n'
    prompt += truncatedContent
    prompt += '\n```\n\nSummary:'

    return prompt
  }

  /**
   * Get maximum tokens based on summary length
   */
  private getMaxTokens(length: string): number {
    switch (length) {
      case 'short': return 150
      case 'long': return 800
      default: return 400
    }
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(ext: string): boolean {
    const codeExtensions = new Set([
      '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.php', '.java',
      '.c', '.cpp', '.h', '.hpp', '.rs', '.go', '.sh', '.sql',
      '.html', '.css', '.xml', '.json', '.yaml', '.yml'
    ])
    return codeExtensions.has(ext)
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  /**
   * Resolve and validate file path
   */
  private resolvePath(path: string, workspaceDir: string): string {
    const cleanPath = path.replace(/^[/\\]+/, '')
    const resolvedPath = join(workspaceDir, cleanPath)
    
    if (!resolvedPath.startsWith(workspaceDir)) {
      throw new Error('Path must be within workspace directory')
    }
    
    return resolvedPath
  }

  /**
   * Get error code from exception
   */
  private getErrorCode(error: any): string {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) return 'FILE_NOT_FOUND'
      if (error.message.includes('EACCES')) return 'PERMISSION_DENIED'
      if (error.message.includes('supported')) return 'UNSUPPORTED_FILE_TYPE'
      if (error.message.includes('limit')) return 'FILE_TOO_LARGE'
      if (error.message.includes('workspace')) return 'INVALID_PATH'
      if (error.message.includes('summary')) return 'SUMMARY_GENERATION_FAILED'
    }
    return 'SUMMARIZATION_ERROR'
  }
}

/**
 * Factory function for creating summarize-file tool
 */
export function createSummarizeFileTool(runtime: RuntimeAdapter): SummarizeFileTool {
  return new SummarizeFileTool(runtime)
}
