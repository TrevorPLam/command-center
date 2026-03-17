/**
 * CSV Document Parser
 * 
 * Parses CSV documents and extracts structured data with column information,
    data types, and statistics.
 */

import { ParsedDocument, DocumentStructure, DocumentElement, DocumentSection } from '../types'

export class CsvParser {
  /**
   * Parse CSV content
   */
  static async parse(content: string): Promise<ParsedDocument> {
    const parsed = this.parseCSV(content)
    const elements: DocumentElement[] = []
    const sections: DocumentSection[] = []

    // Create section for headers
    if (parsed.headers.length > 0) {
      sections.push({
        path: ['headers'],
        text: parsed.headers.join(','),
        metadata: {
          type: 'headers',
          count: parsed.headers.length,
          columns: parsed.headers
        }
      })

      elements.push({
        type: 'other',
        content: parsed.headers.join(','),
        metadata: {
          element_type: 'headers',
          count: parsed.headers.length,
          columns: parsed.headers
        }
      })
    }

    // Create sections for data rows (sample first few)
    const sampleRows = parsed.rows.slice(0, 10)
    sampleRows.forEach((row, index) => {
      sections.push({
        path: ['row', `row-${index}`],
        text: row.join(','),
        metadata: {
          type: 'row',
          index,
          column_count: row.length
        }
      })

      elements.push({
        type: 'other',
        content: row.join(','),
        metadata: {
          element_type: 'row',
          index,
          column_count: row.length
        }
      })
    })

    // Analyze data types and statistics
    const columnAnalysis = this.analyzeColumns(parsed)
    const dataStats = this.calculateDataStats(parsed)

    // Create document structure
    const structure: DocumentStructure = {
      type: 'flat',
      elements
    }

    return {
      content,
      metadata: {
        ...columnAnalysis,
        ...dataStats,
        type: 'csv',
        columns: parsed.headers.length,
        rows: parsed.rows.length,
        has_headers: parsed.hasHeaders,
        delimiter: parsed.delimiter
      },
      sections,
      structure
    }
  }

  /**
   * Parse CSV content with auto-detection of delimiter and headers
   */
  private static parseCSV(content: string): {
    headers: string[]
    rows: string[][]
    hasHeaders: boolean
    delimiter: string
  } {
    const lines = content.split('\n').filter(line => line.trim().length > 0)
    
    if (lines.length === 0) {
      return { headers: [], rows: [], hasHeaders: false, delimiter: ',' }
    }

    // Auto-detect delimiter
    const delimiter = this.detectDelimiter(lines[0])
    
    // Parse all lines
    const parsedLines = lines.map(line => this.parseCSVLine(line, delimiter))
    
    // Detect if first row is headers
    const hasHeaders = this.detectHeaders(parsedLines)
    
    let headers: string[] = []
    let rows: string[][] = []
    
    if (hasHeaders && parsedLines.length > 1) {
      headers = parsedLines[0]
      rows = parsedLines.slice(1)
    } else {
      headers = parsedLines[0].map((_, index) => `Column ${index + 1}`)
      rows = parsedLines
    }

    return { headers, rows, hasHeaders, delimiter }
  }

  /**
   * Detect CSV delimiter
   */
  private static detectDelimiter(line: string): string {
    const delimiters = [',', ';', '\t', '|']
    const counts = delimiters.map(delimiter => ({
      delimiter,
      count: (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
    }))

    // Return delimiter with highest count
    const best = counts.reduce((prev, current) => 
      current.count > prev.count ? current : prev
    )

    return best.count > 0 ? best.delimiter : ','
  }

  /**
   * Parse a single CSV line
   */
  private static parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i += 2
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes
          i += 1
        }
      } else if (char === delimiter && !inQuotes) {
        // Field separator
        result.push(current.trim())
        current = ''
        i += 1
      } else {
        current += char
        i += 1
      }
    }

    // Add last field
    result.push(current.trim())

    return result
  }

  /**
   * Detect if first row contains headers
   */
  private static detectHeaders(rows: string[][]): boolean {
    if (rows.length < 2) return false

    const firstRow = rows[0]
    const secondRow = rows[1]

    // Check if first row has different data types than second row
    let typeDifferences = 0
    for (let i = 0; i < Math.min(firstRow.length, secondRow.length); i++) {
      const firstType = this.detectDataType(firstRow[i])
      const secondType = this.detectDataType(secondRow[i])
      
      if (firstType !== secondType) {
        typeDifferences++
      }
    }

    // If more than half the columns have different types, likely headers
    return typeDifferences > firstRow.length / 2
  }

  /**
   * Detect data type of a value
   */
  private static detectDataType(value: string): string {
    const trimmed = value.trim()
    
    if (trimmed === '') return 'empty'
    if (!isNaN(Number(trimmed))) return 'number'
    if (this.isDate(trimmed)) return 'date'
    if (this.isBoolean(trimmed)) return 'boolean'
    
    return 'text'
  }

  /**
   * Check if value is a date
   */
  private static isDate(value: string): boolean {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
      /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
    ]

    return datePatterns.some(pattern => pattern.test(value))
  }

  /**
   * Check if value is boolean
   */
  private static isBoolean(value: string): boolean {
    const lower = value.toLowerCase()
    return ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(lower)
  }

  /**
   * Analyze columns and their data types
   */
  private static analyzeColumns(parsed: { headers: string[]; rows: string[][] }): Record<string, unknown> {
    const columnTypes: Record<string, string> = {}
    const columnStats: Record<string, any> = {}

    parsed.headers.forEach((header, index) => {
      const columnValues = parsed.rows.map(row => row[index] || '').filter(val => val.trim() !== '')
      
      // Detect data type
      const types = columnValues.map(val => this.detectDataType(val))
      const typeCounts: Record<string, number> = {}
      types.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1
      })
      
      const dominantType = Object.entries(typeCounts)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'text'
      
      columnTypes[header] = dominantType

      // Calculate statistics
      const stats = {
        type: dominantType,
        non_empty_count: columnValues.length,
        empty_count: parsed.rows.length - columnValues.length,
        unique_count: new Set(columnValues).size
      }

      if (dominantType === 'number') {
        const numbers = columnValues.map(val => parseFloat(val)).filter(val => !isNaN(val))
        if (numbers.length > 0) {
          stats.min = Math.min(...numbers)
          stats.max = Math.max(...numbers)
          stats.avg = numbers.reduce((sum, num) => sum + num, 0) / numbers.length
        }
      }

      if (dominantType === 'text') {
        const lengths = columnValues.map(val => val.length)
        stats.avg_length = lengths.reduce((sum, len) => sum + len, 0) / lengths.length
        stats.max_length = Math.max(...lengths)
        stats.min_length = Math.min(...lengths)
      }

      columnStats[header] = stats
    })

    return {
      column_types: columnTypes,
      column_stats: columnStats
    }
  }

  /**
   * Calculate overall data statistics
   */
  private static calculateDataStats(parsed: { headers: string[]; rows: string[][] }): Record<string, unknown> {
    const totalCells = parsed.rows.length * parsed.headers.length
    const nonEmptyCells = parsed.rows.reduce((count, row) => {
      return count + row.filter(cell => cell.trim() !== '').length
    }, 0)

    const dataTypes: Record<string, number> = {}
    parsed.rows.forEach(row => {
      row.forEach(cell => {
        const type = this.detectDataType(cell)
        dataTypes[type] = (dataTypes[type] || 0) + 1
      })
    })

    return {
      total_cells: totalCells,
      non_empty_cells: nonEmptyCells,
      empty_cells: totalCells - nonEmptyCells,
      completeness: (nonEmptyCells / totalCells) * 100,
      data_type_distribution: dataTypes
    }
  }

  /**
   * Generate sample data for preview
   */
  static generateSample(parsed: { headers: string[]; rows: string[][] }, maxRows: number = 5): string {
    const sampleRows = parsed.rows.slice(0, maxRows)
    const allRows = [parsed.headers, ...sampleRows]
    
    return allRows.map(row => 
      row.map(cell => {
        // Truncate long cells for preview
        const truncated = cell.length > 50 ? cell.substring(0, 47) + '...' : cell
        return truncated.includes(',') ? `"${truncated}"` : truncated
      }).join(',')
    ).join('\n')
  }

  /**
   * Validate CSV structure
   */
  static validate(parsed: { headers: string[]; rows: string[][] }): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for consistent column count
    const expectedColumns = parsed.headers.length
    const inconsistentRows = parsed.rows.filter(row => row.length !== expectedColumns)
    
    if (inconsistentRows.length > 0) {
      errors.push(`${inconsistentRows.length} rows have incorrect column count`)
    }

    // Check for duplicate headers
    const duplicateHeaders = parsed.headers.filter((header, index) => 
      parsed.headers.indexOf(header) !== index
    )
    
    if (duplicateHeaders.length > 0) {
      warnings.push(`Duplicate headers found: ${[...new Set(duplicateHeaders)].join(', ')}`)
    }

    // Check for empty file
    if (parsed.rows.length === 0) {
      errors.push('CSV file contains no data rows')
    }

    // Check for completely empty columns
    const emptyColumns = parsed.headers.filter((header, index) => 
      parsed.rows.every(row => !row[index] || row[index].trim() === '')
    )
    
    if (emptyColumns.length > 0) {
      warnings.push(`Empty columns found: ${emptyColumns.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }
}
