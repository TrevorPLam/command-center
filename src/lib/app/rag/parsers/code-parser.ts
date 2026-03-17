/**
 * Code Document Parser
 * 
 * Parses source code files and extracts functions, classes, imports,
 * comments, and code structure for better chunking and indexing.
 */

import { ParsedDocument, DocumentStructure, DocumentElement, DocumentSection } from '../types'

export class CodeParser {
  /**
   * Parse source code content
   */
  static async parse(content: string, language: string): Promise<ParsedDocument> {
    const parser = this.getParserForLanguage(language)
    return parser.parse(content)
  }

  /**
   * Get appropriate parser for language
   */
  private static getParserForLanguage(language: string): CodeParserBase {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'jsx':
        return new JavaScriptParser()
      case 'typescript':
      case 'tsx':
        return new TypeScriptParser()
      case 'python':
      case 'py':
        return new PythonParser()
      case 'java':
        return new JavaParser()
      case 'cpp':
      case 'c':
      case 'c++':
        return new CppParser()
      case 'csharp':
      case 'cs':
        return new CSharpParser()
      case 'go':
        return new GoParser()
      case 'rust':
      case 'rs':
        return new RustParser()
      case 'sql':
        return new SQLParser()
      default:
        return new GenericCodeParser()
    }
  }
}

/**
 * Base class for code parsers
 */
abstract class CodeParserBase {
  abstract parse(content: string): ParsedDocument

  protected createDocumentStructure(
    content: string,
    elements: DocumentElement[],
    sections: DocumentSection[],
    metadata: Record<string, unknown>
  ): ParsedDocument {
    const structure: DocumentStructure = {
      type: 'code',
      elements
    }

    return {
      content,
      metadata: {
        ...metadata,
        elements_count: elements.length,
        sections_count: sections.length
      },
      sections,
      structure
    }
  }

  protected extractComments(content: string, commentPatterns: RegExp[]): string[] {
    const comments: string[] = []
    
    commentPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        comments.push(match[1]?.trim() || match[0]?.trim() || '')
      }
    })

    return comments.filter(comment => comment.length > 0)
  }

  protected extractFunctions(content: string, patterns: RegExp[]): Array<{
    name: string
    type: string
    line: number
    signature: string
  }> {
    const functions: Array<{ name: string; type: string; line: number; signature: string }> = []
    const lines = content.split('\n')

    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        const signature = match[0]?.trim() || ''
        const name = match[1]?.trim() || ''
        const type = 'function'
        
        // Find line number
        const lineIndex = lines.findIndex(line => line.includes(signature))
        const lineNumber = lineIndex >= 0 ? lineIndex + 1 : 0

        functions.push({ name, type, line: lineNumber, signature })
      }
    })

    return functions
  }

  protected extractClasses(content: string, patterns: RegExp[]): Array<{
    name: string
    line: number
    signature: string
  }> {
    const classes: Array<{ name: string; line: number; signature: string }> = []
    const lines = content.split('\n')

    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        const signature = match[0]?.trim() || ''
        const name = match[1]?.trim() || ''
        
        // Find line number
        const lineIndex = lines.findIndex(line => line.includes(signature))
        const lineNumber = lineIndex >= 0 ? lineIndex + 1 : 0

        classes.push({ name, line: lineNumber, signature })
      }
    })

    return classes
  }

  protected extractImports(content: string, patterns: RegExp[]): string[] {
    const imports: string[] = []

    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        imports.push(match[0]?.trim() || '')
      }
    })

    return imports
  }
}

/**
 * JavaScript/TypeScript Parser
 */
class JavaScriptParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []
    const lines = content.split('\n')

    // Extract imports
    const imports = this.extractImports(content, [
      /import\s+.*?from\s+['"`]([^'"`]+)['"`]/g,
      /const\s+.*?=\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    ])

    // Extract functions
    const functions = this.extractFunctions(content, [
      /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:async\s+)?function)/g,
      /(?:async\s+)?function\s+(\w+)\s*\(/g,
      /(\w+)\s*\([^)]*\)\s*{/g
    ])

    // Extract classes
    const classes = this.extractClasses(content, [
      /class\s+(\w+)/g
    ])

    // Extract comments
    const comments = this.extractComments(content, [
      /\/\*\*?([\s\S]*?)\*\//g,
      /\/\/(.*)$/gm
    ])

    // Create sections for imports
    if (imports.length > 0) {
      sections.push({
        path: ['imports'],
        text: imports.join('\n'),
        metadata: {
          type: 'imports',
          count: imports.length
        }
      })

      elements.push({
        type: 'other',
        content: imports.join('\n'),
        metadata: {
          element_type: 'imports',
          count: imports.length
        }
      })
    }

    // Create sections for functions
    functions.forEach((func, index) => {
      const sectionPath = ['function', func.name || `anonymous-${index}`]
      sections.push({
        path: sectionPath,
        text: func.signature,
        metadata: {
          type: 'function',
          name: func.name,
          line: func.line,
          signature: func.signature
        }
      })

      elements.push({
        type: 'code',
        content: func.signature,
        metadata: {
          element_type: 'function',
          name: func.name,
          line: func.line
        }
      })
    })

    // Create sections for classes
    classes.forEach((cls) => {
      const sectionPath = ['class', cls.name]
      sections.push({
        path: sectionPath,
        text: cls.signature,
        metadata: {
          type: 'class',
          name: cls.name,
          line: cls.line,
          signature: cls.signature
        }
      })

      elements.push({
        type: 'code',
        content: cls.signature,
        metadata: {
          element_type: 'class',
          name: cls.name,
          line: cls.line
        }
      })
    })

    // Create sections for comments
    comments.forEach((comment, index) => {
      if (comment.length > 10) { // Only include substantial comments
        sections.push({
          path: ['comment', `comment-${index}`],
          text: comment,
          metadata: {
            type: 'comment',
            index
          }
        })

        elements.push({
          type: 'other',
          content: comment,
          metadata: {
            element_type: 'comment',
            index
          }
        })
      }
    })

    return this.createDocumentStructure(content, elements, sections, {
      language: 'javascript',
      imports_count: imports.length,
      functions_count: functions.length,
      classes_count: classes.length,
      comments_count: comments.length
    })
  }
}

/**
 * TypeScript Parser (extends JavaScript)
 */
class TypeScriptParser extends JavaScriptParser {
  parse(content: string): ParsedDocument {
    const baseResult = super.parse(content)
    
    // Add TypeScript specific parsing
    const interfaces = this.extractInterfaces(content)
    const types = this.extractTypeAliases(content)

    // Update metadata
    baseResult.metadata = {
      ...baseResult.metadata,
      language: 'typescript',
      interfaces_count: interfaces.length,
      types_count: types.length
    }

    return baseResult
  }

  private extractInterfaces(content: string): Array<{ name: string; line: number }> {
    const interfaces: Array<{ name: string; line: number }> = []
    const lines = content.split('\n')
    const matches = content.matchAll(/interface\s+(\w+)/g)

    for (const match of matches) {
      const name = match[1]
      const lineIndex = lines.findIndex(line => line.includes(match[0]))
      interfaces.push({ name, line: lineIndex >= 0 ? lineIndex + 1 : 0 })
    }

    return interfaces
  }

  private extractTypeAliases(content: string): Array<{ name: string; line: number }> {
    const types: Array<{ name: string; line: number }> = []
    const lines = content.split('\n')
    const matches = content.matchAll(/type\s+(\w+)\s*=/g)

    for (const match of matches) {
      const name = match[1]
      const lineIndex = lines.findIndex(line => line.includes(match[0]))
      types.push({ name, line: lineIndex >= 0 ? lineIndex + 1 : 0 })
    }

    return types
  }
}

/**
 * Python Parser
 */
class PythonParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Extract imports
    const imports = this.extractImports(content, [
      /import\s+(.+)/g,
      /from\s+(\S+)\s+import\s+(.+)/g
    ])

    // Extract functions
    const functions = this.extractFunctions(content, [
      /def\s+(\w+)\s*\(/g
    ])

    // Extract classes
    const classes = this.extractClasses(content, [
      /class\s+(\w+)/g
    ])

    // Extract docstrings
    const docstrings = this.extractDocstrings(content)

    // Create sections
    if (imports.length > 0) {
      sections.push({
        path: ['imports'],
        text: imports.join('\n'),
        metadata: { type: 'imports', count: imports.length }
      })
    }

    functions.forEach((func, index) => {
      sections.push({
        path: ['function', func.name || `anonymous-${index}`],
        text: func.signature,
        metadata: {
          type: 'function',
          name: func.name,
          line: func.line
        }
      })
    })

    classes.forEach((cls) => {
      sections.push({
        path: ['class', cls.name],
        text: cls.signature,
        metadata: {
          type: 'class',
          name: cls.name,
          line: cls.line
        }
      })
    })

    docstrings.forEach((docstring, index) => {
      sections.push({
        path: ['docstring', `docstring-${index}`],
        text: docstring,
        metadata: { type: 'docstring', index }
      })
    })

    return this.createDocumentStructure(content, elements, sections, {
      language: 'python',
      imports_count: imports.length,
      functions_count: functions.length,
      classes_count: classes.length,
      docstrings_count: docstrings.length
    })
  }

  private extractDocstrings(content: string): string[] {
    const docstrings: string[] = []
    
    // Triple-quoted strings
    const tripleQuoteMatches = content.matchAll(/("""|''')([\s\S]*?)\1/g)
    for (const match of tripleQuoteMatches) {
      const docstring = match[2]?.trim()
      if (docstring && docstring.length > 10) {
        docstrings.push(docstring)
      }
    }

    return docstrings
  }
}

/**
 * Java Parser
 */
class JavaParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Extract imports
    const imports = this.extractImports(content, [
      /import\s+(.+);/g
    ])

    // Extract classes
    const classes = this.extractClasses(content, [
      /(?:public\s+|private\s+|protected\s+)?(?:abstract\s+|final\s+)?class\s+(\w+)/g,
      /(?:public\s+|private\s+|protected\s+)?interface\s+(\w+)/g,
      /(?:public\s+|private\s+|protected\s+)?enum\s+(\w+)/g
    ])

    // Extract methods
    const methods = this.extractFunctions(content, [
      /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*{/g
    ])

    // Create sections
    if (imports.length > 0) {
      sections.push({
        path: ['imports'],
        text: imports.join('\n'),
        metadata: { type: 'imports', count: imports.length }
      })
    }

    classes.forEach((cls) => {
      sections.push({
        path: ['class', cls.name],
        text: cls.signature,
        metadata: {
          type: 'class',
          name: cls.name,
          line: cls.line
        }
      })
    })

    methods.forEach((method, index) => {
      sections.push({
        path: ['method', method.name || `anonymous-${index}`],
        text: method.signature,
        metadata: {
          type: 'method',
          name: method.name,
          line: method.line
        }
      })
    })

    return this.createDocumentStructure(content, elements, sections, {
      language: 'java',
      imports_count: imports.length,
      classes_count: classes.length,
      methods_count: methods.length
    })
  }
}

/**
 * C++ Parser
 */
class CppParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Extract includes
    const includes = this.extractImports(content, [
      /#include\s*[<"]([^>"]+)[>"]/g
    ])

    // Extract functions
    const functions = this.extractFunctions(content, [
      /\w+\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?(?:override\s*)?(?:final\s*)?{/g,
      /\w+\s+(\w+)\s*\([^)]*\)(?!\s*;)/g
    ])

    // Extract classes
    const classes = this.extractClasses(content, [
      /class\s+(\w+)/g,
      /struct\s+(\w+)/g
    ])

    // Create sections
    if (includes.length > 0) {
      sections.push({
        path: ['includes'],
        text: includes.join('\n'),
        metadata: { type: 'includes', count: includes.length }
      })
    }

    functions.forEach((func, index) => {
      sections.push({
        path: ['function', func.name || `anonymous-${index}`],
        text: func.signature,
        metadata: {
          type: 'function',
          name: func.name,
          line: func.line
        }
      })
    })

    classes.forEach((cls) => {
      sections.push({
        path: ['class', cls.name],
        text: cls.signature,
        metadata: {
          type: 'class',
          name: cls.name,
          line: cls.line
        }
      })
    })

    return this.createDocumentStructure(content, elements, sections, {
      language: 'cpp',
      includes_count: includes.length,
      functions_count: functions.length,
      classes_count: classes.length
    })
  }
}

/**
 * C# Parser
 */
class CSharpParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Extract using statements
    const usings = this.extractImports(content, [
      /using\s+(.+);/g
    ])

    // Extract classes
    const classes = this.extractClasses(content, [
      /(?:public\s+|private\s+|internal\s+)?(?:abstract\s+|sealed\s+)?class\s+(\w+)/g,
      /(?:public\s+|private\s+|internal\s+)?interface\s+(\w+)/g,
      /(?:public\s+|private\s+|internal\s+)?enum\s+(\w+)/g
    ])

    // Extract methods
    const methods = this.extractFunctions(content, [
      /(?:public\s+|private\s+|internal\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(?:virtual\s+)?(?:override\s+)?(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*(?:where\s+[\w\s,]+)?\s*{/g
    ])

    // Create sections
    if (usings.length > 0) {
      sections.push({
        path: ['usings'],
        text: usings.join('\n'),
        metadata: { type: 'usings', count: usings.length }
      })
    }

    classes.forEach((cls) => {
      sections.push({
        path: ['class', cls.name],
        text: cls.signature,
        metadata: {
          type: 'class',
          name: cls.name,
          line: cls.line
        }
      })
    })

    methods.forEach((method, index) => {
      sections.push({
        path: ['method', method.name || `anonymous-${index}`],
        text: method.signature,
        metadata: {
          type: 'method',
          name: method.name,
          line: method.line
        }
      })
    })

    return this.createDocumentStructure(content, elements, sections, {
      language: 'csharp',
      usings_count: usings.length,
      classes_count: classes.length,
      methods_count: methods.length
    })
  }
}

/**
 * Go Parser
 */
class GoParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Extract imports
    const imports = this.extractImports(content, [
      /import\s+["`]([^"`]+)["`]/g,
      /import\s*\([^)]*\)/g
    ])

    // Extract functions
    const functions = this.extractFunctions(content, [
      /func\s+(\w+)\s*\([^)]*\)/g
    ])

    // Extract types
    const types = this.extractTypes(content)

    // Create sections
    if (imports.length > 0) {
      sections.push({
        path: ['imports'],
        text: imports.join('\n'),
        metadata: { type: 'imports', count: imports.length }
      })
    }

    functions.forEach((func, index) => {
      sections.push({
        path: ['function', func.name || `anonymous-${index}`],
        text: func.signature,
        metadata: {
          type: 'function',
          name: func.name,
          line: func.line
        }
      })
    })

    types.forEach((type) => {
      sections.push({
        path: ['type', type.name],
        text: type.signature,
        metadata: {
          type: 'type',
          name: type.name,
          line: type.line
        }
      })
    })

    return this.createDocumentStructure(content, elements, sections, {
      language: 'go',
      imports_count: imports.length,
      functions_count: functions.length,
      types_count: types.length
    })
  }

  private extractTypes(content: string): Array<{ name: string; line: number; signature: string }> {
    const types: Array<{ name: string; line: number; signature: string }> = []
    const lines = content.split('\n')
    const matches = content.matchAll(/type\s+(\w+)\s+(.+)/g)

    for (const match of matches) {
      const name = match[1]
      const signature = match[0]?.trim() || ''
      const lineIndex = lines.findIndex(line => line.includes(signature))
      types.push({ 
        name, 
        line: lineIndex >= 0 ? lineIndex + 1 : 0,
        signature
      })
    }

    return types
  }
}

/**
 * Rust Parser
 */
class RustParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Extract use statements
    const uses = this.extractImports(content, [
      /use\s+([^;]+);/g
    ])

    // Extract functions
    const functions = this.extractFunctions(content, [
      /fn\s+(\w+)\s*\([^)]*\)/g
    ])

    // Extract structs
    const structs = this.extractStructs(content)

    // Extract impl blocks
    const impls = this.extractImpls(content)

    // Create sections
    if (uses.length > 0) {
      sections.push({
        path: ['uses'],
        text: uses.join('\n'),
        metadata: { type: 'uses', count: uses.length }
      })
    }

    functions.forEach((func, index) => {
      sections.push({
        path: ['function', func.name || `anonymous-${index}`],
        text: func.signature,
        metadata: {
          type: 'function',
          name: func.name,
          line: func.line
        }
      })
    })

    structs.forEach((struct) => {
      sections.push({
        path: ['struct', struct.name],
        text: struct.signature,
        metadata: {
          type: 'struct',
          name: struct.name,
          line: struct.line
        }
      })
    })

    impls.forEach((impl, index) => {
      sections.push({
        path: ['impl', `impl-${index}`],
        text: impl.signature,
        metadata: {
          type: 'impl',
          target: impl.target,
          line: impl.line
        }
      })
    })

    return this.createDocumentStructure(content, elements, sections, {
      language: 'rust',
      uses_count: uses.length,
      functions_count: functions.length,
      structs_count: structs.length,
      impls_count: impls.length
    })
  }

  private extractStructs(content: string): Array<{ name: string; line: number; signature: string }> {
    const structs: Array<{ name: string; line: number; signature: string }> = []
    const lines = content.split('\n')
    const matches = content.matchAll(/struct\s+(\w+)/g)

    for (const match of matches) {
      const name = match[1]
      const signature = match[0]?.trim() || ''
      const lineIndex = lines.findIndex(line => line.includes(signature))
      structs.push({ 
        name, 
        line: lineIndex >= 0 ? lineIndex + 1 : 0,
        signature
      })
    }

    return structs
  }

  private extractImpls(content: string): Array<{ target: string; line: number; signature: string }> {
    const impls: Array<{ target: string; line: number; signature: string }> = []
    const lines = content.split('\n')
    const matches = content.matchAll(/impl\s+(.+?)\s*\{/g)

    for (const match of matches) {
      const target = match[1]?.trim() || ''
      const signature = match[0]?.trim() || ''
      const lineIndex = lines.findIndex(line => line.includes(signature))
      impls.push({ 
        target, 
        line: lineIndex >= 0 ? lineIndex + 1 : 0,
        signature
      })
    }

    return impls
  }
}

/**
 * SQL Parser
 */
class SQLParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Extract different SQL statement types
    const createTables = this.extractSQLStatements(content, /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)
    const views = this.extractSQLStatements(content, /CREATE\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)
    const indexes = this.extractSQLStatements(content, /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi)
    const procedures = this.extractSQLStatements(content, /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+(\w+)/gi)
    const functions = this.extractSQLStatements(content, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)/gi)

    // Create sections
    createTables.forEach((stmt) => {
      sections.push({
        path: ['table', stmt.name],
        text: stmt.statement,
        metadata: {
          type: 'table',
          name: stmt.name,
          line: stmt.line
        }
      })
    })

    views.forEach((view) => {
      sections.push({
        path: ['view', view.name],
        text: view.statement,
        metadata: {
          type: 'view',
          name: view.name,
          line: view.line
        }
      })
    })

    indexes.forEach((index) => {
      sections.push({
        path: ['index', index.name],
        text: index.statement,
        metadata: {
          type: 'index',
          name: index.name,
          line: index.line
        }
      })
    })

    procedures.forEach((proc) => {
      sections.push({
        path: ['procedure', proc.name],
        text: proc.statement,
        metadata: {
          type: 'procedure',
          name: proc.name,
          line: proc.line
        }
      })
    })

    functions.forEach((func) => {
      sections.push({
        path: ['function', func.name],
        text: func.statement,
        metadata: {
          type: 'function',
          name: func.name,
          line: func.line
        }
      })
    })

    return this.createDocumentStructure(content, elements, sections, {
      language: 'sql',
      tables_count: createTables.length,
      views_count: views.length,
      indexes_count: indexes.length,
      procedures_count: procedures.length,
      functions_count: functions.length
    })
  }

  private extractSQLStatements(content: string, pattern: RegExp): Array<{
    name: string
    statement: string
    line: number
  }> {
    const statements: Array<{ name: string; statement: string; line: number }> = []
    const lines = content.split('\n')

    const matches = content.matchAll(pattern)
    for (const match of matches) {
      const name = match[1]
      const fullMatch = match[0]
      
      // Find the complete statement (naive approach - would need proper SQL parsing)
      const startIndex = content.indexOf(fullMatch)
      const startLineIndex = content.substring(0, startIndex).split('\n').length - 1
      
      // Find the end of the statement (semicolon)
      const remainingContent = content.substring(startIndex)
      const endIndex = remainingContent.indexOf(';')
      const statement = remainingContent.substring(0, endIndex + 1)

      statements.push({
        name,
        statement: statement.trim(),
        line: startLineIndex + 1
      })
    }

    return statements
  }
}

/**
 * Generic Code Parser (fallback for unknown languages)
 */
class GenericCodeParser extends CodeParserBase {
  parse(content: string): ParsedDocument {
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Simple line-based parsing
    const lines = content.split('\n')
    let currentSection: DocumentSection | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      if (line.length === 0) {
        if (currentSection && currentSection.text.trim()) {
          sections.push(currentSection)
          currentSection = null
        }
        continue
      }

      // Look for common patterns
      if (line.includes('function') || line.includes('def ') || line.includes('func ')) {
        if (currentSection && currentSection.text.trim()) {
          sections.push(currentSection)
        }
        
        currentSection = {
          path: ['function', `line-${i}`],
          text: line,
          metadata: {
            type: 'function',
            line: i + 1
          }
        }
      } else if (line.includes('class') || line.includes('struct') || line.includes('interface')) {
        if (currentSection && currentSection.text.trim()) {
          sections.push(currentSection)
        }
        
        currentSection = {
          path: ['class', `line-${i}`],
          text: line,
          metadata: {
            type: 'class',
            line: i + 1
          }
        }
      } else {
        if (currentSection) {
          currentSection.text += '\n' + line
        } else {
          currentSection = {
            path: ['code', `section-${i}`],
            text: line,
            metadata: {
              type: 'code',
              line: i + 1
            }
          }
        }
      }
    }

    if (currentSection && currentSection.text.trim()) {
      sections.push(currentSection)
    }

    return this.createDocumentStructure(content, elements, sections, {
      language: 'unknown',
      sections_count: sections.length
    })
  }
}
