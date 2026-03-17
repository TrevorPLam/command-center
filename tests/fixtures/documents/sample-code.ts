/**
 * Sample TypeScript Code File
 * 
 * This file demonstrates various TypeScript language features
 * that the ingestion pipeline should correctly parse and structure.
 */

import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: Date
  metadata?: MessageMetadata
  tokenCount?: number
  latencyMs?: number
}

export interface MessageMetadata {
  modelUsed?: string
  thinkingTraces?: ThinkingTrace[]
  toolCalls?: ToolCall[]
  error?: string
}

export interface ThinkingTrace {
  step: number
  reasoning: string
  confidence: number
  alternatives?: string[]
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
  output?: unknown
  status: 'pending' | 'completed' | 'failed'
  error?: string
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().min(1),
  timestamp: z.date(),
  metadata: z.object({
    modelUsed: z.string().optional(),
    thinkingTraces: z.array(z.object({
      step: z.number(),
      reasoning: z.string(),
      confidence: z.number().min(0).max(1),
      alternatives: z.array(z.string()).optional()
    })).optional(),
    toolCalls: z.array(z.object({
      id: z.string(),
      name: z.string(),
      input: z.record(z.unknown()),
      output: z.unknown().optional(),
      status: z.enum(['pending', 'completed', 'failed']),
      error: z.string().optional()
    })).optional(),
    error: z.string().optional()
  }).optional(),
  tokenCount: z.number().optional(),
  latencyMs: z.number().optional()
})

export type ValidatedChatMessage = z.infer<typeof ChatMessageSchema>

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

interface ChatState {
  // Current conversation state
  currentConversationId: string | null
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  
  // UI state
  sidebarOpen: boolean
  theme: 'light' | 'dark' | 'system'
  
  // Actions
  setCurrentConversation: (conversationId: string) => void
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  deleteMessage: (id: string) => void
  clearMessages: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentConversationId: null,
      messages: [],
      isLoading: false,
      error: null,
      sidebarOpen: true,
      theme: 'system',
      
      // Actions
      setCurrentConversation: (conversationId) => {
        set({ currentConversationId: conversationId })
      },
      
      addMessage: (messageData) => {
        const message: ChatMessage = {
          ...messageData,
          id: crypto.randomUUID(),
          timestamp: new Date()
        }
        
        set((state) => ({
          messages: [...state.messages, message]
        }))
      },
      
      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          )
        }))
      },
      
      deleteMessage: (id) => {
        set((state) => ({
          messages: state.messages.filter((msg) => msg.id !== id)
        }))
      },
      
      clearMessages: () => {
        set({ messages: [] })
      },
      
      setLoading: (loading) => {
        set({ isLoading: loading })
      },
      
      setError: (error) => {
        set({ error })
      },
      
      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }))
      },
      
      setTheme: (theme) => {
        set({ theme })
      }
    }),
    {
      name: 'chat-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme
      })
    }
  )
)

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates a chat message using Zod schema
 */
export function validateChatMessage(message: unknown): ValidatedChatMessage {
  return ChatMessageSchema.parse(message)
}

/**
 * Calculates token count for a message (mock implementation)
 */
export function calculateTokenCount(message: ChatMessage): number {
  // Simple word-based estimation (in production, use actual tokenizer)
  const words = message.content.split(/\s+/).length
  const metadataTokens = JSON.stringify(message.metadata || {}).split(/\s+/).length
  return words + metadataTokens + 10 // Buffer for structure
}

/**
 * Formats a timestamp for display
 */
export function formatTimestamp(timestamp: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  }).format(timestamp)
}

/**
 * Extracts thinking traces from message metadata
 */
export function extractThinkingTraces(message: ChatMessage): ThinkingTrace[] {
  return message.metadata?.thinkingTraces || []
}

/**
 * Extracts tool calls from message metadata
 */
export function extractToolCalls(message: ChatMessage): ToolCall[] {
  return message.metadata?.toolCalls || []
}

// ============================================================================
// CLASSES AND INTERFACES
// ============================================================================

/**
 * Abstract base class for message processors
 */
abstract class MessageProcessor {
  protected nextProcessor?: MessageProcessor
  
  setNext(processor: MessageProcessor): MessageProcessor {
    this.nextProcessor = processor
    return processor
  }
  
  abstract process(message: ChatMessage): ChatMessage
  
  protected processNext(message: ChatMessage): ChatMessage {
    return this.nextProcessor ? this.nextProcessor.process(message) : message
  }
}

/**
 * Token counting processor
 */
class TokenCountProcessor extends MessageProcessor {
  process(message: ChatMessage): ChatMessage {
    const tokenCount = calculateTokenCount(message)
    return this.processNext({
      ...message,
      tokenCount
    })
  }
}

/**
 * Metadata enrichment processor
 */
class MetadataEnrichmentProcessor extends MessageProcessor {
  process(message: ChatMessage): ChatMessage {
    const enrichedMetadata = {
      ...message.metadata,
      processedAt: new Date().toISOString(),
      messageLength: message.content.length,
      wordCount: message.content.split(/\s+/).length
    }
    
    return this.processNext({
      ...message,
      metadata: enrichedMetadata
    })
  }
}

/**
 * Validation processor
 */
class ValidationProcessor extends MessageProcessor {
  process(message: ChatMessage): ChatMessage {
    try {
      validateChatMessage(message)
      return this.processNext(message)
    } catch (error) {
      throw new Error(`Invalid message: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

// ============================================================================
// PROCESSOR CHAIN
// ============================================================================

/**
 * Creates a message processing chain
 */
export function createMessageProcessorChain(): MessageProcessor {
  const validationProcessor = new ValidationProcessor()
  const tokenCountProcessor = new TokenCountProcessor()
  const metadataProcessor = new MetadataEnrichmentProcessor()
  
  // Chain processors together
  validationProcessor.setNext(tokenCountProcessor)
  tokenCountProcessor.setNext(metadataProcessor)
  
  return validationProcessor
}

/**
 * Process a message through the entire chain
 */
export function processMessage(message: ChatMessage): ChatMessage {
  const processorChain = createMessageProcessorChain()
  return processorChain.process(message)
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example function demonstrating usage
 */
export async function exampleUsage() {
  // Create a new message
  const newMessage = {
    conversationId: 'conv-123',
    role: 'user' as const,
    content: 'Hello, AI assistant! Can you help me with TypeScript?',
    metadata: {
      modelUsed: 'gpt-4',
      thinkingTraces: [
        {
          step: 1,
          reasoning: 'User is asking for TypeScript help',
          confidence: 0.9,
          alternatives: ['User wants general programming help', 'User has a specific TypeScript question']
        }
      ]
    }
  }
  
  // Add to store
  const { addMessage } = useChatStore.getState()
  addMessage(newMessage)
  
  // Process message (in real implementation, this happens in the service layer)
  const processedMessage = processMessage({
    ...newMessage,
    id: crypto.randomUUID(),
    timestamp: new Date()
  })
  
  console.log('Processed message:', processedMessage)
  
  // Extract and display thinking traces
  const thinkingTraces = extractThinkingTraces(processedMessage)
  console.log('Thinking traces:', thinkingTraces)
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ChatState }
export { MessageProcessor, TokenCountProcessor, MetadataEnrichmentProcessor, ValidationProcessor }
