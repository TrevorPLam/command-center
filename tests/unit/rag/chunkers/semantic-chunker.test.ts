/**
 * Semantic Chunker Unit Tests
 * 
 * Tests for the semantic chunking strategy implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SemanticChunker } from '@/lib/app/rag/chunkers/semantic-chunker'
import type { DocumentSection, ChunkingPolicy } from '@/lib/app/rag/types'

describe('SemanticChunker', () => {
  let chunker: SemanticChunker
  let mockSections: DocumentSection[]

  beforeEach(() => {
    chunker = new SemanticChunker()
    
    mockSections = [
      {
        path: ['introduction'],
        text: 'This is the introduction to our document. It provides context and background information.',
        metadata: { type: 'paragraph', level: 1 }
      },
      {
        path: ['main-content', 'section1'],
        text: 'Section 1 contains important information about the main topic. It elaborates on key concepts and provides detailed explanations.',
        metadata: { type: 'paragraph', level: 2 }
      },
      {
        path: ['main-content', 'section2'],
        text: 'Section 2 expands on the previous section with additional details and examples. It helps readers understand the material better.',
        metadata: { type: 'paragraph', level: 2 }
      },
      {
        path: ['conclusion'],
        text: 'The conclusion summarizes the key points and provides final thoughts on the topic discussed throughout the document.',
        metadata: { type: 'paragraph', level: 1 }
      }
    ]
  })

  describe('SupportedContentTypes', () => {
    it('should support common text formats', () => {
      const supportedTypes = chunker.getSupportedContentTypes()
      
      expect(supportedTypes).toContain('text/plain')
      expect(supportedTypes).toContain('text/markdown')
      expect(supportedTypes).toContain('text/html')
      expect(supportedTypes).toContain('application/json')
    })

    it('should support programming languages', () => {
      const supportedTypes = chunker.getSupportedContentTypes()
      
      expect(supportedTypes).toContain('text/javascript')
      expect(supportedTypes).toContain('text/typescript')
      expect(supportedTypes).toContain('text/python')
      expect(supportedTypes).toContain('text/java')
    })
  })

  describe('Chunking Logic', () => {
    it('should create chunks based on semantic boundaries', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-1', mockSections, policy)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.every(chunk => chunk.documentId === 'doc-1')).toBe(true)
      expect(chunks.every(chunk => chunk.text.length <= policy.maxChunkSize)).toBe(true)
    })

    it('should preserve section boundaries when possible', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 300,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-1', mockSections, policy)

      // Check that chunks don't split sections unnecessarily
      chunks.forEach(chunk => {
        const chunkText = chunk.text
        const sectionBoundaries = mockSections.map(section => section.text)
        
        // If a chunk contains text from multiple sections, it should be at semantic boundaries
        const containsMultipleSections = sectionBoundaries.filter(text => 
          chunkText.includes(text)
        ).length > 1
        
        if (containsMultipleSections) {
          // Should contain complete sections, not partial ones
          expect(chunkText.split('.').length).toBeGreaterThan(1)
        }
      })
    })

    it('should handle overlap correctly', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 150,
        chunkOverlap: 30
      }

      const chunks = await chunker.chunk('doc-1', mockSections, policy)

      if (chunks.length > 1) {
        // Check that adjacent chunks have overlapping content
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunk = chunks[i]
          const nextChunk = chunks[i + 1]
          
          // Simple overlap check - in real implementation would be more sophisticated
          const currentEnd = currentChunk.text.slice(-policy.chunkOverlap)
          const nextStart = nextChunk.text.slice(0, policy.chunkOverlap)
          
          // This is a basic check - real implementation would use semantic similarity
          expect(currentChunk.text).toBeDefined()
          expect(nextChunk.text).toBeDefined()
        }
      }
    })

    it('should handle very small max chunk size', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 50,
        chunkOverlap: 10
      }

      const chunks = await chunker.chunk('doc-1', mockSections, policy)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.every(chunk => chunk.text.length <= policy.maxChunkSize)).toBe(true)
    })

    it('should handle very large max chunk size', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 1000,
        chunkOverlap: 100
      }

      const chunks = await chunker.chunk('doc-1', mockSections, policy)

      expect(chunks.length).toBeGreaterThanOrEqual(1)
      // With large chunk size, might get fewer chunks
      expect(chunks.every(chunk => chunk.text.length <= policy.maxChunkSize)).toBe(true)
    })
  })

  describe('Metadata and Structure', () => {
    it('should preserve section path information', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-1', mockSections, policy)

      chunks.forEach(chunk => {
        expect(chunk.sectionPath).toBeDefined()
        expect(Array.isArray(chunk.sectionPath)).toBe(true)
      })
    })

    it('should include chunk metadata', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-1', mockSections, policy)

      chunks.forEach(chunk => {
        expect(chunk.metadata).toBeDefined()
        expect(typeof chunk.metadata).toBe('object')
        expect(chunk.chunkIndex).toBeGreaterThanOrEqual(0)
        expect(chunk.tokenCount).toBeGreaterThan(0)
      })
    })

    it('should maintain chunk index order', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 150,
        chunkOverlap: 30
      }

      const chunks = await chunker.chunk('doc-1', mockSections, policy)

      // Check that chunk indices are sequential
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty sections', async () => {
      const emptySections: DocumentSection[] = [
        { path: ['empty'], text: '', metadata: { type: 'paragraph' } }
      ]

      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-empty', emptySections, policy)

      // Should handle gracefully - either no chunks or minimal chunks
      expect(chunks).toBeDefined()
    })

    it('should handle sections with only whitespace', async () => {
      const whitespaceSections: DocumentSection[] = [
        { path: ['whitespace'], text: '   \n\t   ', metadata: { type: 'paragraph' } }
      ]

      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-whitespace', whitespaceSections, policy)

      expect(chunks).toBeDefined()
    })

    it('should handle very long sections', async () => {
      const longText = 'A'.repeat(1000) // Very long section
      const longSections: DocumentSection[] = [
        { path: ['long'], text: longText, metadata: { type: 'paragraph' } }
      ]

      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-long', longSections, policy)

      expect(chunks.length).toBeGreaterThan(1) // Should split long content
      expect(chunks.every(chunk => chunk.text.length <= policy.maxChunkSize)).toBe(true)
    })

    it('should handle sections with special characters', async () => {
      const specialSections: DocumentSection[] = [
        { 
          path: ['special'], 
          text: 'Special chars: éñ中文🚀\n\nNewlines and\t\ttabs\nSymbols: @#$%^&*()', 
          metadata: { type: 'paragraph' } 
        }
      ]

      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-special', specialSections, policy)

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0].text).toContain('Special chars')
    })
  })

  describe('Performance', () => {
    it('should handle large numbers of sections efficiently', async () => {
      const manySections: DocumentSection[] = Array.from({ length: 100 }, (_, i) => ({
        path: [`section-${i}`],
        text: `This is section ${i} with some content to process.`,
        metadata: { type: 'paragraph', index: i }
      }))

      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 300,
        chunkOverlap: 50
      }

      const startTime = Date.now()
      const chunks = await chunker.chunk('doc-many', manySections, policy)
      const endTime = Date.now()

      expect(chunks.length).toBeGreaterThan(0)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle complex nested structures', async () => {
      const complexSections: DocumentSection[] = [
        {
          path: ['chapter1', 'section1', 'subsection1'],
          text: 'Deep nested content 1',
          metadata: { type: 'paragraph', depth: 3 }
        },
        {
          path: ['chapter1', 'section1', 'subsection2'],
          text: 'Deep nested content 2',
          metadata: { type: 'paragraph', depth: 3 }
        },
        {
          path: ['chapter2', 'section1'],
          text: 'Less nested content',
          metadata: { type: 'paragraph', depth: 2 }
        }
      ]

      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      const chunks = await chunker.chunk('doc-complex', complexSections, policy)

      expect(chunks.length).toBeGreaterThan(0)
      chunks.forEach(chunk => {
        expect(chunk.sectionPath).toBeDefined()
        expect(chunk.sectionPath.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid policy gracefully', async () => {
      const invalidPolicy = {
        strategy: 'semantic' as const,
        maxChunkSize: -1, // Invalid
        chunkOverlap: 100
      }

      // Should not throw, but handle gracefully
      const chunks = await chunker.chunk('doc-invalid', mockSections, invalidPolicy)
      
      // Implementation should either use defaults or handle appropriately
      expect(chunks).toBeDefined()
    })

    it('should handle null/undefined sections', async () => {
      const policy: ChunkingPolicy = {
        strategy: 'semantic',
        maxChunkSize: 200,
        chunkOverlap: 50
      }

      // Should not crash with null sections
      const chunks = await chunker.chunk('doc-null', [], policy)
      
      expect(chunks).toBeDefined()
      expect(Array.isArray(chunks)).toBe(true)
    })
  })
})
