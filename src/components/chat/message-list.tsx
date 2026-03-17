/**
 * Message List Component
 * 
 * Displays a list of chat messages with proper formatting, timestamps,
 * and streaming indicators. Handles user and assistant message styling.
 */

'use client'

import React, { useRef, useEffect } from 'react'
import { useCurrentMessages, useChatStore } from '@/stores/use-chat-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, User, Bot, Copy, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface MessageListProps {
  className?: string
}

export function MessageList({ className }: MessageListProps) {
  const messages = useCurrentMessages()
  const isStreaming = useChatStore((state) => state.isStreaming)
  const streamingContent = useChatStore((state) => state.streamingContent)
  const streamingMessageId = useChatStore((state) => state.streamingMessageId)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScrollRef.current && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }
  }, [messages, streamingContent])

  // Detect user scroll to disable auto-scroll
  const handleScroll = () => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        const { scrollTop, scrollHeight, clientHeight } = scrollElement
        autoScrollRef.current = scrollTop + clientHeight >= scrollHeight - 50
      }
    }
  }

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch (error) {
      console.error('Failed to copy message:', error)
    }
  }

  const renderMessage = (message: any, isStreaming = false) => {
    const isUser = message.role === 'user'
    const isSystem = message.role === 'system'
    const isAssistant = message.role === 'assistant'
    const isTool = message.role === 'tool'

    // Parse metadata for additional info
    let metadata = {}
    try {
      if (message.metadata) {
        metadata = JSON.parse(message.metadata)
      }
    } catch {
      // Ignore metadata parsing errors
    }

    return (
      <div
        key={message.id}
        className={`flex gap-3 p-4 ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            {isSystem ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
            ) : isTool ? (
              <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-orange-600" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </div>
        )}

        <div className={`max-w-[70%] ${isUser ? 'order-first' : 'order-last'}`}>
          <div
            className={`rounded-lg p-3 ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : isSystem
                ? 'bg-gray-100 text-gray-700 border border-gray-200'
                : isTool
                ? 'bg-orange-50 text-orange-900 border border-orange-200'
                : 'bg-muted text-foreground border border-border'
            }`}
          >
            {/* Tool call indicator */}
            {isTool && metadata.name && (
              <div className="text-xs font-mono mb-2 text-orange-700">
                🛠️ Tool: {metadata.name}
              </div>
            )}

            {/* Message content */}
            <div className="text-sm whitespace-pre-wrap break-words">
              {isStreaming && message.id === streamingMessageId
                ? streamingContent
                : message.content}
              
              {/* Streaming indicator */}
              {isStreaming && message.id === streamingMessageId && (
                <span className="inline-block ml-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                </span>
              )}
            </div>

            {/* Message metadata */}
            {(message.tokenCount || message.latencyMs || metadata.type) && (
              <div className="mt-2 text-xs opacity-70 space-x-2">
                {message.tokenCount && (
                  <span>{message.tokenCount} tokens</span>
                )}
                {message.latencyMs && (
                  <span>{message.latencyMs}ms</span>
                )}
                {metadata.type === 'thinking' && (
                  <span>💭 Thinking</span>
                )}
                {metadata.type === 'cancelled' && (
                  <span>❌ Cancelled</span>
                )}
                {metadata.type === 'error' && (
                  <span>⚠️ Error</span>
                )}
              </div>
            )}
          </div>

          {/* Message footer */}
          <div className="flex items-center gap-2 mt-1 px-1">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
            </span>
            
            {/* Copy button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 hover:opacity-100 transition-opacity"
              onClick={() => copyMessage(message.content)}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <ScrollArea
      ref={scrollAreaRef}
      className={`flex-1 ${className}`}
      onScroll={handleScroll}
    >
      <div className="space-y-1 p-2">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Bot className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Start a conversation to begin chatting</p>
          </div>
        ) : (
          <>
            {messages.map((message) => renderMessage(message))}
            
            {/* Show streaming message if it's a new message not yet in the list */}
            {isStreaming && streamingMessageId && !messages.find(m => m.id === streamingMessageId) && (
              <div>
                {renderMessage({
                  id: streamingMessageId,
                  role: 'assistant',
                  content: '',
                  createdAt: new Date().toISOString()
                }, true)}
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  )
}
