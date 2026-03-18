/**
 * Read File Tool
 * 
 * Low-risk tool for reading file contents within the workspace.
 * Provides bounded file system access with security constraints.
 */

import { z } from 'zod'
import { readFile, stat } from 'fs/promises'
import { join, relative, extname } from 'path'
import { BuiltinTool, ToolContext, ToolCapability } from '../types'

/**
 * Input schema for read-file tool
 */
export const ReadFileInputSchema = z.object({
  /** File path relative to workspace */
  path: z.string().min(1).max(500),
  /** Maximum number of bytes to read */
  maxBytes: z.number().int().min(1).max(10_000_000).default(1_000_000),
  /** Include file metadata */
  includeMetadata: z.boolean().default(false),
  /** Encoding for text files */
  encoding: z.enum(['utf8', 'utf16le', 'latin1']).default('utf8')
})

/**
 * Output schema for read-file tool
 */
export const ReadFileOutputSchema = z.object({
  /** File content (base64 for binary files) */
  content: z.string(),
  /** Whether content is binary (base64 encoded) */
  isBinary: z.boolean(),
  /** File metadata (if requested) */
  metadata: z.object({
    size: z.number(),
    modified: z.string(),
    created: z.string(),
    extension: z.string(),
    mimeType: z.string().optional(),
    isDirectory: z.boolean(),
    isFile: z.boolean()
  }).optional(),
  /** Relative path from workspace */
  relativePath: z.string()
})

/**
 * File type detection and MIME type mapping
 */
const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.css': 'text/css',
  '.xml': 'application/xml',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.csv': 'text/csv',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip'
}

/**
 * Binary file extensions
 */
const BINARY_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.zip', '.tar', '.gz',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.img', '.iso', '.dmg'
])

/**
 * Read file tool implementation
 */
export class ReadFileTool implements BuiltinTool {
  readonly descriptor = {
    name: 'read-file',
    description: 'Read file contents from within the workspace directory',
    version: '1.0.0',
    author: 'Command Center',
    capabilities: ['filesystem-read'] as ToolCapability[],
    riskLevel: 'low' as const,
    approvalRequired: false,
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
        '**/.aws/**'
      ],
      networkRules: {
        defaultAllow: false
      },
      resourceLimits: {
        maxExecutionTimeSec: 10,
        maxMemoryMB: 128
      },
      requiredPermissions: ['filesystem-read'] as ToolCapability[]
    },
    inputSchema: ReadFileInputSchema,
    outputSchema: ReadFileOutputSchema,
    tags: ['filesystem', 'files', 'read'],
    metadata: {
      category: 'filesystem',
      readOnly: true,
      safeForAutomation: true,
      boundedToWorkspace: true
    }
  }

  /**
   * Execute the read-file tool
   */
  async execute(input: unknown, context: ToolContext): Promise<unknown> {
    const parsedInput = ReadFileInputSchema.parse(input)
    
    // Validate and resolve path
    const resolvedPath = this.resolvePath(parsedInput.path, context.workspaceDir)
    
    try {
      // Get file stats
      const fileStats = await stat(resolvedPath)
      
      if (!fileStats.isFile()) {
        throw new Error(`Path '${parsedInput.path}' is not a file`)
      }

      // Check file size limit
      if (fileStats.size > parsedInput.maxBytes) {
        throw new Error(`File size (${fileStats.size} bytes) exceeds limit (${parsedInput.maxBytes} bytes)`)
      }

      // Determine if file is binary
      const ext = extname(resolvedPath).toLowerCase()
      const isBinary = BINARY_EXTENSIONS.has(ext) || this.isBinaryFile(resolvedPath, ext)

      // Read file content
      let content: string
      if (isBinary) {
        // Read as base64 for binary files
        const buffer = await readFile(resolvedPath)
        content = buffer.toString('base64')
      } else {
        // Read as text for text files
        content = await readFile(resolvedPath, parsedInput.encoding)
      }

      const result: any = {
        content,
        isBinary,
        relativePath: relative(context.workspaceDir, resolvedPath)
      }

      // Include metadata if requested
      if (parsedInput.includeMetadata) {
        result.metadata = {
          size: fileStats.size,
          modified: fileStats.mtime.toISOString(),
          created: fileStats.birthtime.toISOString(),
          extension: ext,
          mimeType: MIME_TYPES[ext] || (isBinary ? 'application/octet-stream' : 'text/plain'),
          isDirectory: fileStats.isDirectory(),
          isFile: fileStats.isFile()
        }
      }

      return result

    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error(`File not found: '${parsedInput.path}'`)
      }
      if (error instanceof Error && error.message.includes('EACCES')) {
        throw new Error(`Permission denied: '${parsedInput.path}'`)
      }
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate input (optional method)
   */
  validate?(input: unknown): { valid: boolean; errors: string[] } {
    try {
      const parsed = ReadFileInputSchema.parse(input)
      
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
   * Resolve and validate file path
   */
  private resolvePath(path: string, workspaceDir: string): string {
    // Remove any leading slashes to ensure relative path
    const cleanPath = path.replace(/^[/\\]+/, '')
    
    // Join with workspace directory
    const resolvedPath = join(workspaceDir, cleanPath)
    
    // Ensure resolved path is within workspace
    if (!resolvedPath.startsWith(workspaceDir)) {
      throw new Error('Path must be within workspace directory')
    }
    
    return resolvedPath
  }

  /**
   * Determine if file is binary based on extension and content
   */
  private isBinaryFile(filePath: string, ext: string): boolean {
    // Check known binary extensions
    if (BINARY_EXTENSIONS.has(ext)) {
      return true
    }
    
    // Check unknown extensions - assume binary unless it's a known text type
    const knownTextExtensions = new Set([
      '.txt', '.json', '.js', '.ts', '.md', '.html', '.css', '.xml',
      '.yaml', '.yml', '.csv', '.log', '.sql', '.sh', '.py', '.rb',
      '.php', '.java', '.c', '.cpp', '.h', '.hpp', '.rs', '.go'
    ])
    
    return !knownTextExtensions.has(ext) && ext !== ''
  }
}

/**
 * Factory function for creating read-file tool
 */
export function createReadFileTool(): ReadFileTool {
  return new ReadFileTool()
}
