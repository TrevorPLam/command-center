/**
 * Index File Tool
 * 
 * Medium-risk tool for indexing files into the RAG system.
 * Provides bounded file processing with proper validation and security.
 */

import { z } from 'zod'
import { readFile, stat } from 'fs/promises'
import { join, relative, extname } from 'path'
import { BuiltinTool, ToolContext, ToolCapability } from '../types'

/**
 * Input schema for index-file tool
 */
export const IndexFileInputSchema = z.object({
  /** File path relative to workspace */
  path: z.string().min(1).max(500),
  /** Index name to add to */
  indexName: z.string().min(1).max(100).default('default'),
  /** Chunk size for text processing */
  chunkSize: z.number().int().min(100).max(4000).default(1000),
  /** Chunk overlap */
  chunkOverlap: z.number().int().min(0).max(200).default(100),
  /** Processing options */
  options: z.object({
    /** Extract metadata */
    extractMetadata: z.boolean().default(true),
    /** Generate summary */
    generateSummary: z.boolean().default(false),
    /** Force re-indexing if already indexed */
    forceReindex: z.boolean().default(false)
  }).default({})
})

/**
 * Output schema for index-file tool
 */
export const IndexFileOutputSchema = z.object({
  /** Indexing result */
  success: z.boolean(),
  /** Document ID */
  documentId: z.string().optional(),
  /** Number of chunks created */
  chunkCount: z.number().optional(),
  /** Processing summary */
  summary: z.object({
    fileName: z.string(),
    fileSize: z.number(),
    processingTime: z.number(),
    chunksCreated: z.number(),
    metadataExtracted: z.boolean()
  }).optional(),
  /** Error information */
  error: z.object({
    code: z.string(),
    message: z.string()
  }).optional()
})

/**
 * Supported file types for indexing
 */
const SUPPORTED_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.yaml', '.yml', '.csv', '.log',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.rb', '.php', '.java',
  '.c', '.cpp', '.h', '.hpp', '.rs', '.go', '.sh', '.sql',
  '.html', '.css', '.xml', '.svg'
])

/**
 * File type to content type mapping
 */
const CONTENT_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.csv': 'text/csv',
  '.log': 'text/log',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.jsx': 'text/javascript',
  '.tsx': 'text/typescript',
  '.py': 'text/python',
  '.rb': 'text/ruby',
  '.php': 'text/php',
  '.java': 'text/java',
  '.c': 'text/c',
  '.cpp': 'text/cpp',
  '.h': 'text/c',
  '.hpp': 'text/cpp',
  '.rs': 'text/rust',
  '.go': 'text/go',
  '.sh': 'text/shell',
  '.sql': 'text/sql',
  '.html': 'text/html',
  '.css': 'text/css',
  '.xml': 'text/xml',
  '.svg': 'text/xml'
}

/**
 * Index file tool implementation
 */
export class IndexFileTool implements BuiltinTool {
  readonly descriptor = {
    name: 'index-file',
    description: 'Index a file into the RAG system with chunking and metadata extraction',
    version: '1.0.0',
    author: 'Command Center',
    capabilities: ['filesystem-read', 'database-write'] as ToolCapability[],
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
        maxExecutionTimeSec: 60,
        maxMemoryMB: 256
      },
      requiredPermissions: ['filesystem-read', 'database-write'] as ToolCapability[]
    },
    inputSchema: IndexFileInputSchema,
    outputSchema: IndexFileOutputSchema,
    tags: ['indexing', 'rag', 'files', 'transform'],
    metadata: {
      category: 'transform',
      readOnly: false,
      safeForAutomation: false, // Requires monitoring
      boundedToWorkspace: true,
      modifiesDatabase: true
    }
  }

  /**
   * Execute the index-file tool
   */
  async execute(input: unknown, context: ToolContext): Promise<unknown> {
    const startTime = Date.now()
    const parsedInput = IndexFileInputSchema.parse(input)
    
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
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        throw new Error(`File type '${ext}' is not supported for indexing`)
      }

      // Check file size (limit to 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (fileStats.size > maxSize) {
        throw new Error(`File size (${fileStats.size} bytes) exceeds limit (${maxSize} bytes)`)
      }

      // Read file content
      const content = await readFile(resolvedPath, 'utf-8')
      
      // Process file for indexing
      const result = await this.processFileForIndexing(
        content,
        parsedInput,
        context,
        resolvedPath,
        fileStats
      )

      const processingTime = Date.now() - startTime

      return {
        success: true,
        documentId: result.documentId,
        chunkCount: result.chunkCount,
        summary: {
          fileName: parsedInput.path,
          fileSize: fileStats.size,
          processingTime,
          chunksCreated: result.chunkCount,
          metadataExtracted: result.metadataExtracted
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
      const parsed = IndexFileInputSchema.parse(input)
      
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

      // Validate chunk parameters
      if (parsed.chunkOverlap >= parsed.chunkSize) {
        errors.push('Chunk overlap must be less than chunk size')
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
   * Process file for indexing
   */
  private async processFileForIndexing(
    content: string,
    options: any,
    context: ToolContext,
    filePath: string,
    fileStats: any
  ): Promise<{
    documentId: string
    chunkCount: number
    metadataExtracted: boolean
  }> {
    // Generate document ID
    const documentId = this.generateDocumentId(filePath, fileStats)

    // Extract metadata
    let metadata: any = {}
    if (options.options.extractMetadata) {
      metadata = await this.extractMetadata(content, filePath, fileStats)
    }

    // Split content into chunks
    const chunks = this.chunkContent(content, options.chunkSize, options.chunkOverlap)

    // Process chunks (in a real implementation, this would involve embedding and database storage)
    const processedChunks = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = {
        id: `${documentId}-chunk-${i}`,
        documentId,
        content: chunks[i],
        chunkIndex: i,
        tokenCount: this.estimateTokenCount(chunks[i]),
        metadata: {
          ...metadata,
          chunkIndex: i,
          totalChunks: chunks.length,
          filePath: relative(context.workspaceDir, filePath)
        }
      }
      processedChunks.push(chunk)
    }

    // Simulate database storage (in production, would use actual repositories)
    await this.storeChunks(processedChunks, options.indexName)

    return {
      documentId,
      chunkCount: processedChunks.length,
      metadataExtracted: options.options.extractMetadata
    }
  }

  /**
   * Extract metadata from file
   */
  private async extractMetadata(content: string, filePath: string, fileStats: any): Promise<any> {
    const ext = extname(filePath).toLowerCase()
    const metadata: any = {
      fileName: filePath.split('/').pop() || filePath,
      extension: ext,
      contentType: CONTENT_TYPES[ext] || 'text/plain',
      size: fileStats.size,
      lastModified: fileStats.mtime.toISOString(),
      created: fileStats.birthtime.toISOString()
    }

    // Extract specific metadata based on file type
    switch (ext) {
      case '.md':
        metadata.title = this.extractMarkdownTitle(content)
        metadata.headings = this.extractMarkdownHeadings(content)
        break
      case '.json':
        try {
          const jsonData = JSON.parse(content)
          metadata.jsonStructure = this.getJsonStructure(jsonData)
        } catch {
          // Invalid JSON, ignore
        }
        break
      case '.yaml':
      case '.yml':
        metadata.yamlKeys = this.extractYamlKeys(content)
        break
      case '.js':
      case '.ts':
        metadata.functions = this.extractFunctionNames(content)
        metadata.imports = this.extractImportStatements(content)
        break
      case '.py':
        metadata.functions = this.extractPythonFunctions(content)
        metadata.imports = this.extractPythonImports(content)
        break
    }

    return metadata
  }

  /**
   * Split content into chunks
   */
  private chunkContent(content: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < content.length) {
      let end = start + chunkSize
      
      // Try to break at word boundaries
      if (end < content.length) {
        const nextSpace = content.indexOf(' ', end)
        if (nextSpace !== -1 && nextSpace - end < 100) {
          end = nextSpace
        }
      }

      chunks.push(content.slice(start, end))
      start = end - overlap
      
      if (start >= content.length) break
    }

    return chunks.filter(chunk => chunk.trim().length > 0)
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokenCount(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }

  /**
   * Generate document ID
   */
  private generateDocumentId(filePath: string, fileStats: any): string {
    // Use file path and modified time to create a stable ID
    const baseId = filePath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
    const timeHash = fileStats.mtime.getTime().toString(36)
    return `${baseId}-${timeHash}`
  }

  /**
   * Store chunks (simulated)
   */
  private async storeChunks(chunks: any[], indexName: string): Promise<void> {
    // In production, this would:
    // 1. Generate embeddings for each chunk
    // 2. Store chunks in LanceDB/vector store
    // 3. Update document metadata in SQLite
    
    console.log(`Storing ${chunks.length} chunks in index '${indexName}'`)
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  /**
   * Extract markdown title
   */
  private extractMarkdownTitle(content: string): string | null {
    const match = content.match(/^#\s+(.+)$/m)
    return match ? match[1].trim() : null
  }

  /**
   * Extract markdown headings
   */
  private extractMarkdownHeadings(content: string): string[] {
    const headings: string[] = []
    const matches = content.match(/^(#{1,6})\s+(.+)$/gm)
    if (matches) {
      for (const match of matches) {
        const level = match.match(/^#+/)?.[0].length || 0
        const title = match.replace(/^#+\s+/, '').trim()
        headings.push(`${'#'.repeat(level)} ${title}`)
      }
    }
    return headings
  }

  /**
   * Get JSON structure summary
   */
  private getJsonStructure(json: any): string {
    if (Array.isArray(json)) {
      return `Array[${json.length}]`
    } else if (typeof json === 'object' && json !== null) {
      const keys = Object.keys(json)
      return `Object{${keys.length}}[${keys.join(', ')}]`
    }
    return typeof json
  }

  /**
   * Extract YAML keys
   */
  private extractYamlKeys(content: string): string[] {
    const keys: string[] = []
    const matches = content.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*):/gm)
    if (matches) {
      for (const match of matches) {
        const key = match.replace(/^\s*([a-zA-Z_][a-zA-Z0-9_-]*):.*/, '$1')
        keys.push(key)
      }
    }
    return [...new Set(keys)]
  }

  /**
   * Extract function names (JavaScript/TypeScript)
   */
  private extractFunctionNames(content: string): string[] {
    const functions: string[] = []
    
    // Function declarations
    const funcMatches = content.match(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g)
    if (funcMatches) {
      for (const match of funcMatches) {
        const name = match.replace(/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(.*/, '$1')
        functions.push(name)
      }
    }
    
    // Arrow functions
    const arrowMatches = content.match(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:\([^)]*\)\s*)?=>/g)
    if (arrowMatches) {
      for (const match of arrowMatches) {
        const name = match.replace(/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=.*/, '$1')
        functions.push(name)
      }
    }
    
    return [...new Set(functions)]
  }

  /**
   * Extract import statements
   */
  private extractImportStatements(content: string): string[] {
    const imports: string[] = []
    
    // ES6 imports
    const es6Matches = content.match(/^import\s+.+?\s+from\s+['"](.+?)['"]/gm)
    if (es6Matches) {
      for (const match of es6Matches) {
        const moduleName = match.replace(/^import\s+.+?\s+from\s+['"](.+?)['"].*/, '$1')
        imports.push(moduleName)
      }
    }
    
    // CommonJS requires
    const cjsMatches = content.match(/require\s*\(\s*['"](.+?)['"]\s*\)/g)
    if (cjsMatches) {
      for (const match of cjsMatches) {
        const moduleName = match.replace(/require\s*\(\s*['"](.+?)['"]\s*\)/, '$1')
        imports.push(moduleName)
      }
    }
    
    return [...new Set(imports)]
  }

  /**
   * Extract Python functions
   */
  private extractPythonFunctions(content: string): string[] {
    const functions: string[] = []
    const matches = content.match(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm)
    if (matches) {
      for (const match of matches) {
        const name = match.replace(/^def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/, '$1')
        functions.push(name)
      }
    }
    return [...new Set(functions)]
  }

  /**
   * Extract Python imports
   */
  private extractPythonImports(content: string): string[] {
    const imports: string[] = []
    
    // Import statements
    const importMatches = content.match(/^import\s+(.+)$/gm)
    if (importMatches) {
      for (const match of importMatches) {
        const moduleName = match.replace(/^import\s+(.+)$/, '$1').split('.')[0]
        imports.push(moduleName)
      }
    }
    
    // From import statements
    const fromMatches = content.match(/^from\s+(\S+)\s+import/gm)
    if (fromMatches) {
      for (const match of fromMatches) {
        const moduleName = match.replace(/^from\s+(\S+)\s+import/, '$1')
        imports.push(moduleName)
      }
    }
    
    return [...new Set(imports)]
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
    }
    return 'INDEXING_ERROR'
  }
}

/**
 * Factory function for creating index-file tool
 */
export function createIndexFileTool(): IndexFileTool {
  return new IndexFileTool()
}
