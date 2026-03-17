/**
 * Chat Panel Component
 * 
 * Main chat interface that combines conversation list, message display,
 * and message composer. Handles real-time streaming and state management.
 */

'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Panel, PanelHeader, PanelTitle } from '@/components/ui/panel'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ConversationList } from '@/components/chat/conversation-list'
import { MessageList } from '@/components/chat/message-list'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ContextUsageIndicator } from '@/components/chat/context-usage-indicator'
import { ConversationSummary } from '@/components/chat/conversation-summary'
import { useChatStore, useCurrentConversation, useHasActiveConversation } from '@/stores/use-chat-store'
import { listConversations, getConversationWithMessages, getChatModels } from '@/app/actions/conversations'
import { Loader2, MessageSquare, PanelLeft, PanelRight, BarChart3, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface ChatPanelProps {
  className?: string
}

export function ChatPanel({ className }: ChatPanelProps) {
  const currentConversation = useCurrentConversation()
  const hasActiveConversation = useHasActiveConversation()
  const sidebarOpen = useChatStore((state) => state.sidebarOpen)
  const setSidebarOpen = useChatStore((state) => state.setSidebarOpen)
  const setConversations = useChatStore((state) => state.setConversations)
  const setMessages = useChatStore((state) => state.setMessages)
  const setActiveConversation = useChatStore((state) => state.setActiveConversation)
  const setAvailableModels = useChatStore((state) => state.setAvailableModels)
  const isLoadingConversations = useChatStore((state) => state.isLoadingConversations)
  const setLoadingStates = useChatStore((state) => state.setLoadingStates)
  const error = useChatStore((state) => state.error)
  
  const [isLoading, setIsLoading] = useState(false)
  const [streamController, setStreamController] = useState<AbortController | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const [showContextDetails, setShowContextDetails] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const selectedModel = useChatStore((state) => state.selectedModel)

  // Load initial data
  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setIsLoading(true)
    setLoadingStates({ isLoadingConversations: true })
    
    try {
      // Load conversations
      const conversationsResult = await listConversations()
      if (conversationsResult.success) {
        setConversations(conversationsResult.conversations)
      } else {
        toast.error('Failed to load conversations')
      }

      // Load available models
      const modelsResponse = await fetch('/api/chat')
      if (modelsResponse.ok) {
        const modelsData = await modelsResponse.json()
        if (modelsData.success) {
          setAvailableModels(modelsData.models)
        }
      }
    } catch (error) {
      console.error('Failed to load initial data:', error)
      toast.error('Failed to load chat data')
    } finally {
      setIsLoading(false)
      setLoadingStates({ isLoadingConversations: false })
    }
  }

  const handleConversationSelect = async (conversationId: string) => {
    try {
      const result = await getConversationWithMessages(conversationId)
      
      if (result.success) {
        setActiveConversation(conversationId)
        setMessages(conversationId, result.messages)
      } else {
        toast.error(result.error || 'Failed to load conversation')
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
      toast.error('Failed to load conversation')
    }
  }

  const handleNewConversation = async () => {
    // This will be handled by the ConversationList component
    // which creates a new conversation and automatically selects it
  }

  const handleSendMessage = async (message: string, model: string) => {
    if (!currentConversation) return

    // Cancel any existing stream
    if (streamController) {
      streamController.abort()
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      // Create new abort controller for this request
      const controller = new AbortController()
      setStreamController(controller)

      // Start streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: currentConversation.id,
          message,
          model,
          stream: true
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              handleStreamEvent(data)
            } catch (error) {
              console.error('Failed to parse stream event:', error)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Stream was aborted')
      } else {
        console.error('Chat streaming error:', error)
        toast.error('Failed to send message')
      }
    } finally {
      setStreamController(null)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }

  const handleStreamEvent = (event: any) => {
    const { type, conversationId, messageId, content, timestamp } = event

    switch (type) {
      case 'connected':
        console.log('Connected to chat stream')
        break

      case 'token':
        // Handle streaming token
        useChatStore.getState().appendStreamingContent(content || '')
        break

      case 'done':
      case 'error':
        // Finish streaming
        useChatStore.getState().finishStreaming()
        
        // Reload messages to get the final state
        if (conversationId) {
          handleConversationSelect(conversationId)
        }
        break

      default:
        console.log('Unknown stream event:', event)
    }
  }

  const handleCancelStream = () => {
    if (streamController) {
      streamController.abort()
      setStreamController(null)
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    useChatStore.getState().cancelStreaming()
    toast.info('Message cancelled')
  }

  return (
    <Panel className={`flex flex-col ${className}`}>
      <PanelHeader className="flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <PanelTitle>Chat</PanelTitle>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 p-0"
            >
              {sidebarOpen ? <PanelLeft className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </PanelHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation Sidebar */}
        {sidebarOpen && (
          <div className="w-80 border-r border-border flex-shrink-0">
            <ConversationList
              onConversationSelect={handleConversationSelect}
              onNewConversation={handleNewConversation}
            />
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {hasActiveConversation ? (
            <>
              {/* Conversation Header */}
              <div className="flex-shrink-0 p-4 border-b border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{currentConversation?.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {currentConversation?.modelProfileId && `Model: ${currentConversation.modelProfileId}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status indicator */}
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                </div>

                {/* Context Usage Indicator */}
                {selectedModel && currentConversation && (
                  <div className="flex items-center justify-between">
                    <ContextUsageIndicator 
                      model={selectedModel}
                      conversationId={currentConversation.id}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowContextDetails(!showContextDetails)}
                        className="h-8 w-8 p-0"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSummary(!showSummary)}
                        className="h-8 w-8 p-0"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Expanded Context Details */}
                {showContextDetails && selectedModel && currentConversation && (
                  <div className="border-t border-border pt-3">
                    <ContextUsageIndicator 
                      model={selectedModel}
                      conversationId={currentConversation.id}
                      showDetails={true}
                      onModelSwitch={(newModel) => {
                        useChatStore.getState().setSelectedModel(newModel)
                        toast.success(`Switched to ${newModel}`)
                      }}
                    />
                  </div>
                )}

                {/* Conversation Summary */}
                {showSummary && currentConversation && (
                  <div className="border-t border-border pt-3">
                    <ConversationSummary 
                      conversationId={currentConversation.id}
                      editable={true}
                      onRefresh={() => {
                        // Refresh the conversation data
                        handleConversationSelect(currentConversation.id)
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Messages */}
              <MessageList className="flex-1" />

              {/* Message Composer */}
              <ChatComposer
                onSendMessage={handleSendMessage}
                onCancelStream={handleCancelStream}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
                <p className="text-muted-foreground mb-4">
                  Choose a conversation from the sidebar or create a new one to start chatting.
                </p>
                <Button onClick={() => setSidebarOpen(true)}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Browse Conversations
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 p-2 border-t border-border bg-destructive/10">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => useChatStore.getState().resetError()}
              className="h-6 w-6 p-0"
            >
              ×
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}
