/**
 * Chat Composer Component
 * 
 * Message input component with send functionality, model selection,
 * and streaming controls. Handles keyboard shortcuts and input validation.
 */

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useChatStore, useCanSendMessage, useCurrentConversation } from '@/stores/use-chat-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Send, Square, Paperclip } from 'lucide-react'
import { toast } from 'sonner'

interface ChatComposerProps {
  className?: string
  onSendMessage?: (message: string, model: string) => void
  onCancelStream?: () => void
}

export function ChatComposer({ className, onSendMessage, onCancelStream }: ChatComposerProps) {
  const messageInput = useChatStore((state) => state.messageInput)
  const setMessageInput = useChatStore((state) => state.setMessageInput)
  const selectedModel = useChatStore((state) => state.selectedModel)
  const setSelectedModel = useChatStore((state) => state.setSelectedModel)
  const availableModels = useChatStore((state) => state.availableModels)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const canSendMessage = useCanSendMessage()
  const currentConversation = useCurrentConversation()
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isComposing, setIsComposing] = useState(false)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [messageInput])

  // Focus textarea when conversation changes
  useEffect(() => {
    if (currentConversation && textareaRef.current && !isStreaming) {
      textareaRef.current.focus()
    }
  }, [currentConversation, isStreaming])

  const handleSendMessage = async () => {
    if (!canSendMessage) return

    const message = messageInput.trim()
    const model = selectedModel || availableModels[0]?.id

    if (!message) {
      toast.error('Please enter a message')
      return
    }

    if (!model) {
      toast.error('Please select a model')
      return
    }

    try {
      // Clear input
      setMessageInput('')
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      // Call the send handler
      await onSendMessage?.(message, model)
    } catch (error) {
      toast.error('Failed to send message')
      console.error('Send message error:', error)
    }
  }

  const handleCancelStream = () => {
    onCancelStream?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault()
      if (canSendMessage) {
        handleSendMessage()
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    // Handle file paste if needed in the future
    const text = e.clipboardData.getData('text')
    if (text.length > 10000) {
      e.preventDefault()
      toast.error('Message too long (max 10,000 characters)')
    }
  }

  // Set default model when available models change
  useEffect(() => {
    if (!selectedModel && availableModels.length > 0) {
      setSelectedModel(availableModels[0].id)
    }
  }, [availableModels, selectedModel, setSelectedModel])

  if (!currentConversation) {
    return (
      <div className={`p-4 border-t border-border ${className}`}>
        <div className="text-center text-muted-foreground">
          <p className="text-sm">Select or create a conversation to start chatting</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`border-t border-border bg-background ${className}`}>
      {/* Model selection */}
      {availableModels.length > 1 && (
        <div className="px-4 pt-3 pb-2">
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <span>{model.name}</span>
                    {model.family && (
                      <span className="text-xs text-muted-foreground">
                        ({model.family})
                      </span>
                    )}
                    {model.size && (
                      <span className="text-xs text-muted-foreground">
                        {model.size}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Message input */}
      <div className="p-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={
                isStreaming 
                  ? "AI is responding..." 
                  : "Type your message... (Enter to send, Shift+Enter for new line)"
              }
              disabled={isStreaming}
              className="min-h-[44px] max-h-[120px] resize-none pr-12"
              rows={1}
            />
            
            {/* Character count */}
            {messageInput.length > 500 && (
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {messageInput.length}/10000
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-1">
            {isStreaming ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelStream}
                className="h-[44px] w-[44px] p-0"
              >
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <>
                {/* Attachments (future feature) */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="h-[44px] w-[44px] p-0"
                  title="Attachments (coming soon)"
                >
                  <Paperclip className="w-4 h-4" />
                </Button>

                {/* Send button */}
                <Button
                  variant={canSendMessage ? 'default' : 'secondary'}
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={!canSendMessage}
                  className="h-[44px] w-[44px] p-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Input hints */}
        <div className="mt-2 text-xs text-muted-foreground flex justify-between">
          <span>
            {isStreaming 
              ? "Response is streaming..." 
              : messageInput.length === 0 
                ? "Type a message to start"
                : canSendMessage
                  ? "Press Enter to send"
                  : "Waiting for response..."
            }
          </span>
          {messageInput.length > 0 && (
            <span>{messageInput.length} characters</span>
          )}
        </div>
      </div>
    </div>
  )
}
