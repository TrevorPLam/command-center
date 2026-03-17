/**
 * Chat Store
 * 
 * Zustand store for managing chat state, conversations, and real-time streaming.
 * Complements the shell store with chat-specific state management.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// Types for chat state
export interface ChatMessage {
  id: string
  conversationId: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tokenCount?: number
  latencyMs?: number
  metadata?: string
  createdAt: string
  isStreaming?: boolean
}

export interface Conversation {
  id: string
  title: string
  modelProfileId?: string
  summaryJson?: string
  metadata?: string
  createdAt: string
  updatedAt: string
  archivedAt?: string
  messageCount?: number
}

export interface ChatState {
  // Current conversation state
  activeConversationId: string | null
  conversations: Conversation[]
  messages: Record<string, ChatMessage[]> // conversationId -> messages
  
  // Streaming state
  isStreaming: boolean
  streamingMessageId: string | null
  streamingContent: string
  
  // UI state
  sidebarOpen: boolean
  messageInput: string
  selectedModel: string
  availableModels: Array<{
    id: string
    name: string
    size?: number
    family?: string
  }>
  
  // Loading states
  isLoadingConversations: boolean
  isLoadingMessages: boolean
  error: string | null
  
  // Actions
  setActiveConversation: (conversationId: string | null) => void
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void
  removeConversation: (conversationId: string) => void
  
  setMessages: (conversationId: string, messages: ChatMessage[]) => void
  addMessage: (conversationId: string, message: ChatMessage) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void
  removeMessage: (conversationId: string, messageId: string) => void
  
  startStreaming: (conversationId: string, messageId: string) => void
  appendStreamingContent: (content: string) => void
  finishStreaming: () => void
  cancelStreaming: () => void
  
  setSidebarOpen: (open: boolean) => void
  setMessageInput: (input: string) => void
  setSelectedModel: (model: string) => void
  setAvailableModels: (models: ChatState['availableModels']) => void
  
  setLoadingStates: (states: {
    isLoadingConversations?: boolean
    isLoadingMessages?: boolean
  }) => void
  setError: (error: string | null) => void
  
  // Reset actions
  clearChatState: () => void
  resetError: () => void
}

export const useChatStore = create<ChatState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    activeConversationId: null,
    conversations: [],
    messages: {},
    isStreaming: false,
    streamingMessageId: null,
    streamingContent: '',
    sidebarOpen: true,
    messageInput: '',
    selectedModel: '',
    availableModels: [],
    isLoadingConversations: false,
    isLoadingMessages: false,
    error: null,

    // Conversation actions
    setActiveConversation: (conversationId) => {
      set({ activeConversationId: conversationId })
    },

    setConversations: (conversations) => {
      set({ conversations })
    },

    addConversation: (conversation) => {
      set((state) => ({
        conversations: [...state.conversations, conversation]
      }))
    },

    updateConversation: (conversationId, updates) => {
      set((state) => ({
        conversations: state.conversations.map(conv =>
          conv.id === conversationId ? { ...conv, ...updates } : conv
        )
      }))
    },

    removeConversation: (conversationId) => {
      set((state) => {
        const newConversations = state.conversations.filter(conv => conv.id !== conversationId)
        const newMessages = { ...state.messages }
        delete newMessages[conversationId]
        
        return {
          conversations: newConversations,
          messages: newMessages,
          activeConversationId: state.activeConversationId === conversationId 
            ? null 
            : state.activeConversationId
        }
      })
    },

    // Message actions
    setMessages: (conversationId, messages) => {
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: messages
        }
      }))
    },

    addMessage: (conversationId, message) => {
      set((state) => {
        const currentMessages = state.messages[conversationId] || []
        return {
          messages: {
            ...state.messages,
            [conversationId]: [...currentMessages, message]
          }
        }
      })
    },

    updateMessage: (conversationId, messageId, updates) => {
      set((state) => {
        const currentMessages = state.messages[conversationId] || []
        const updatedMessages = currentMessages.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        )
        return {
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages
          }
        }
      })
    },

    removeMessage: (conversationId, messageId) => {
      set((state) => {
        const currentMessages = state.messages[conversationId] || []
        const filteredMessages = currentMessages.filter(msg => msg.id !== messageId)
        return {
          messages: {
            ...state.messages,
            [conversationId]: filteredMessages
          }
        }
      })
    },

    // Streaming actions
    startStreaming: (conversationId, messageId) => {
      set({
        isStreaming: true,
        streamingMessageId: messageId,
        streamingContent: ''
      })
    },

    appendStreamingContent: (content) => {
      set((state) => ({
        streamingContent: state.streamingContent + content
      }))
    },

    finishStreaming: () => {
      const { streamingMessageId, streamingContent, activeConversationId } = get()
      
      if (streamingMessageId && activeConversationId && streamingContent) {
        // Update the streaming message with final content
        get().updateMessage(activeConversationId, streamingMessageId, {
          content: streamingContent,
          isStreaming: false
        })
      }
      
      set({
        isStreaming: false,
        streamingMessageId: null,
        streamingContent: ''
      })
    },

    cancelStreaming: () => {
      const { streamingMessageId, activeConversationId } = get()
      
      if (streamingMessageId && activeConversationId) {
        // Mark the message as cancelled
        get().updateMessage(activeConversationId, streamingMessageId, {
          isStreaming: false,
          metadata: JSON.stringify({
            type: 'cancelled',
            timestamp: new Date().toISOString()
          })
        })
      }
      
      set({
        isStreaming: false,
        streamingMessageId: null,
        streamingContent: ''
      })
    },

    // UI actions
    setSidebarOpen: (open) => {
      set({ sidebarOpen: open })
    },

    setMessageInput: (input) => {
      set({ messageInput: input })
    },

    setSelectedModel: (model) => {
      set({ selectedModel: model })
    },

    setAvailableModels: (models) => {
      set({ availableModels: models })
    },

    // Loading actions
    setLoadingStates: (states) => {
      set((state) => ({
        isLoadingConversations: states.isLoadingConversations ?? state.isLoadingConversations,
        isLoadingMessages: states.isLoadingMessages ?? state.isLoadingMessages
      }))
    },

    setError: (error) => {
      set({ error })
    },

    // Reset actions
    clearChatState: () => {
      set({
        activeConversationId: null,
        conversations: [],
        messages: {},
        isStreaming: false,
        streamingMessageId: null,
        streamingContent: '',
        messageInput: '',
        error: null
      })
    },

    resetError: () => {
      set({ error: null })
    }
  }))
)

// Selectors for derived state
export const useCurrentConversation = () => {
  return useChatStore((state) => {
    if (!state.activeConversationId) return null
    return state.conversations.find(conv => conv.id === state.activeConversationId) || null
  })
}

export const useCurrentMessages = () => {
  return useChatStore((state) => {
    if (!state.activeConversationId) return []
    return state.messages[state.activeConversationId] || []
  })
}

export const useConversationById = (conversationId: string) => {
  return useChatStore((state) => 
    state.conversations.find(conv => conv.id === conversationId) || null
  )
}

export const useMessagesByConversationId = (conversationId: string) => {
  return useChatStore((state) => 
    state.messages[conversationId] || []
  )
}

// Computed selectors
export const useHasActiveConversation = () => {
  return useChatStore((state) => !!state.activeConversationId)
}

export const useCanSendMessage = () => {
  return useChatStore((state) => 
    !!state.activeConversationId && 
    !state.isStreaming && 
    state.messageInput.trim().length > 0
  )
}
