/**
 * Conversation List Component
 * 
 * Displays a list of conversations with search, create new conversation,
 * and conversation management features. Shows conversation previews and metadata.
 */

'use client'

import React, { useState, useMemo } from 'react'
import { useChatStore } from '@/stores/use-chat-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  MessageSquare, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Archive, 
  Trash2,
  Pencil,
  Check,
  X
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { createConversation, archiveConversation, deleteConversation } from '@/app/actions/conversations'

interface ConversationListProps {
  className?: string
  onConversationSelect?: (conversationId: string) => void
  onNewConversation?: () => void
}

export function ConversationList({ 
  className, 
  onConversationSelect, 
  onNewConversation 
}: ConversationListProps) {
  const conversations = useChatStore((state) => state.conversations)
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const isLoadingConversations = useChatStore((state) => state.isLoadingConversations)
  const setActiveConversation = useChatStore((state) => state.setActiveConversation)
  const removeConversation = useChatStore((state) => state.removeConversation)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    
    const query = searchQuery.toLowerCase()
    return conversations.filter(conv => 
      conv.title.toLowerCase().includes(query) ||
      (conv.messageCount && conv.messageCount.toString().includes(query))
    )
  }, [conversations, searchQuery])

  // Sort conversations by most recent
  const sortedConversations = useMemo(() => {
    return [...filteredConversations].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [filteredConversations])

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversation(conversationId)
    onConversationSelect?.(conversationId)
  }

  const handleCreateConversation = async () => {
    if (isCreating) return
    
    setIsCreating(true)
    try {
      const result = await createConversation({
        title: 'New Conversation',
        modelProfileId: 'default' // This should be dynamic based on available models
      })
      
      if (result.success && result.conversation) {
        // Add to local state
        useChatStore.getState().addConversation(result.conversation)
        
        // Select the new conversation
        handleSelectConversation(result.conversation.id)
        
        onNewConversation?.()
        toast.success('Conversation created')
      } else {
        toast.error(result.error || 'Failed to create conversation')
      }
    } catch (error) {
      toast.error('Failed to create conversation')
      console.error('Create conversation error:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleArchiveConversation = async (conversationId: string) => {
    try {
      const result = await archiveConversation(conversationId)
      
      if (result.success) {
        // Remove from local state
        removeConversation(conversationId)
        toast.success('Conversation archived')
      } else {
        toast.error(result.error || 'Failed to archive conversation')
      }
    } catch (error) {
      toast.error('Failed to archive conversation')
      console.error('Archive conversation error:', error)
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return
    }
    
    try {
      const result = await deleteConversation(conversationId)
      
      if (result.success) {
        // Remove from local state
        removeConversation(conversationId)
        toast.success('Conversation deleted')
      } else {
        toast.error(result.error || 'Failed to delete conversation')
      }
    } catch (error) {
      toast.error('Failed to delete conversation')
      console.error('Delete conversation error:', error)
    }
  }

  const handleStartEditing = (conversationId: string, currentTitle: string) => {
    setEditingId(conversationId)
    setEditingTitle(currentTitle)
  }

  const handleSaveEdit = async (conversationId: string) => {
    if (!editingTitle.trim()) {
      setEditingId(null)
      return
    }

    try {
      // Update locally first for immediate UI feedback
      useChatStore.getState().updateConversation(conversationId, { title: editingTitle.trim() })
      
      // Then update on server (this would need a server action)
      // For now, just update locally
      setEditingId(null)
      toast.success('Conversation renamed')
    } catch (error) {
      toast.error('Failed to rename conversation')
      console.error('Rename conversation error:', error)
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const renderConversationItem = (conversation: any) => {
    const isActive = conversation.id === activeConversationId
    const isEditing = conversation.id === editingId

    return (
      <div
        key={conversation.id}
        className={`group relative p-3 rounded-lg border cursor-pointer transition-colors ${
          isActive
            ? 'bg-primary/10 border-primary/20'
            : 'hover:bg-muted/50 border-border'
        }`}
        onClick={() => !isEditing && handleSelectConversation(conversation.id)}
      >
        {/* Active indicator */}
        {isActive && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
        )}

        <div className="flex items-start gap-3">
          {/* Conversation icon */}
          <div className={`flex-shrink-0 mt-1 ${
            isActive ? 'text-primary' : 'text-muted-foreground'
          }`}>
            <MessageSquare className="w-4 h-4" />
          </div>

          {/* Conversation content */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit(conversation.id)
                    } else if (e.key === 'Escape') {
                      handleCancelEdit()
                    }
                  }}
                  className="h-7 text-sm"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSaveEdit(conversation.id)
                  }}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCancelEdit()
                  }}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                {/* Title */}
                <h3 className="font-medium text-sm truncate pr-8">
                  {conversation.title}
                </h3>

                {/* Metadata */}
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {conversation.messageCount !== undefined && (
                    <span>{conversation.messageCount} messages</span>
                  )}
                  <span>•</span>
                  <span>
                    {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Actions dropdown */}
          {!isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    handleStartEditing(conversation.id, conversation.title)
                  }}
                >
                  <Pencil className="w-3 h-3 mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    handleArchiveConversation(conversation.id)
                  }}
                >
                  <Archive className="w-3 h-3 mr-2" />
                  Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteConversation(conversation.id)
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-semibold text-lg">Conversations</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCreateConversation}
            disabled={isCreating}
            className="ml-auto"
          >
            <Plus className="w-4 h-4 mr-1" />
            New
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoadingConversations ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-sm">Loading conversations...</div>
            </div>
          ) : sortedConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
              <p className="text-xs mt-1">
                {searchQuery ? 'Try a different search term' : 'Create your first conversation to get started'}
              </p>
            </div>
          ) : (
            sortedConversations.map(renderConversationItem)
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
