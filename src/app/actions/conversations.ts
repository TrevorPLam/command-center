/**
 * Conversation Server Actions
 * 
 * Server actions for managing conversations and messages with proper validation
 * and error handling. These actions are called from client components.
 */

'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { conversationRepository, messageRepository } from '@/lib/app/persistence/conversation-repository'
import type { Conversation, Message, NewConversation, NewMessage } from '@/lib/db/schema'

// Validation schemas
const createConversationSchema = z.object({
  title: z.string().min(1).max(200),
  modelProfileId: z.string().optional(),
  summaryJson: z.string().optional(),
  metadata: z.string().optional()
})

const updateConversationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  modelProfileId: z.string().optional(),
  summaryJson: z.string().optional(),
  metadata: z.string().optional()
})

const createMessageSchema = z.object({
  conversationId: z.string().min(1),
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().min(1),
  tokenCount: z.number().int().min(0).optional(),
  latencyMs: z.number().int().min(0).optional(),
  metadata: z.string().optional()
})

const listConversationsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  archived: z.boolean().optional(),
  modelProfileId: z.string().optional()
})

const getMessagesSchema = z.object({
  conversationId: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
  role: z.enum(['system', 'user', 'assistant', 'tool']).optional()
})

/**
 * Create a new conversation
 */
export async function createConversation(data: z.infer<typeof createConversationSchema>) {
  try {
    const validated = createConversationSchema.parse(data)
    
    const conversationData: NewConversation = {
      id: uuidv4(),
      title: validated.title,
      modelProfileId: validated.modelProfileId,
      summaryJson: validated.summaryJson,
      metadata: validated.metadata,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const conversation = await conversationRepository.create(conversationData)

    // Revalidate relevant paths
    revalidatePath('/chat')
    revalidatePath('/')

    return { success: true, conversation }
  } catch (error) {
    console.error('Failed to create conversation:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get a conversation by ID
 */
export async function getConversation(id: string) {
  try {
    if (!id) {
      return { success: false, error: 'Conversation ID is required' }
    }

    const conversation = await conversationRepository.getById(id, true)
    
    if (!conversation) {
      return { success: false, error: 'Conversation not found' }
    }

    return { success: true, conversation }
  } catch (error) {
    console.error(`Failed to get conversation ${id}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * List conversations with pagination and filtering
 */
export async function listConversations(data: z.infer<typeof listConversationsSchema> = {}) {
  try {
    const validated = listConversationsSchema.parse(data)
    const conversations = await conversationRepository.list(validated)

    return { success: true, conversations }
  } catch (error) {
    console.error('Failed to list conversations:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Update a conversation
 */
export async function updateConversation(data: z.infer<typeof updateConversationSchema>) {
  try {
    const validated = updateConversationSchema.parse(data)
    
    const updateData: Partial<NewConversation> = {}
    if (validated.title !== undefined) updateData.title = validated.title
    if (validated.modelProfileId !== undefined) updateData.modelProfileId = validated.modelProfileId
    if (validated.summaryJson !== undefined) updateData.summaryJson = validated.summaryJson
    if (validated.metadata !== undefined) updateData.metadata = validated.metadata

    const conversation = await conversationRepository.update(validated.id, updateData)
    
    if (!conversation) {
      return { success: false, error: 'Conversation not found' }
    }

    // Revalidate relevant paths
    revalidatePath('/chat')
    revalidatePath(`/chat/${validated.id}`)

    return { success: true, conversation }
  } catch (error) {
    console.error(`Failed to update conversation ${data.id}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Archive a conversation
 */
export async function archiveConversation(id: string) {
  try {
    if (!id) {
      return { success: false, error: 'Conversation ID is required' }
    }

    const archived = await conversationRepository.archive(id)
    
    if (!archived) {
      return { success: false, error: 'Conversation not found' }
    }

    // Revalidate relevant paths
    revalidatePath('/chat')
    revalidatePath(`/chat/${id}`)

    return { success: true }
  } catch (error) {
    console.error(`Failed to archive conversation ${id}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Delete a conversation and all its messages
 */
export async function deleteConversation(id: string) {
  try {
    if (!id) {
      return { success: false, error: 'Conversation ID is required' }
    }

    const deleted = await conversationRepository.delete(id)
    
    if (!deleted) {
      return { success: false, error: 'Conversation not found' }
    }

    // Revalidate relevant paths
    revalidatePath('/chat')
    revalidatePath(`/chat/${id}`)

    return { success: true }
  } catch (error) {
    console.error(`Failed to delete conversation ${id}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Create a new message
 */
export async function createMessage(data: z.infer<typeof createMessageSchema>) {
  try {
    const validated = createMessageSchema.parse(data)
    
    const messageData: NewMessage = {
      id: uuidv4(),
      conversationId: validated.conversationId,
      role: validated.role,
      content: validated.content,
      tokenCount: validated.tokenCount,
      latencyMs: validated.latencyMs,
      metadata: validated.metadata,
      createdAt: new Date()
    }

    const message = await messageRepository.create(messageData)

    // Revalidate relevant paths
    revalidatePath('/chat')
    revalidatePath(`/chat/${validated.conversationId}`)

    return { success: true, message }
  } catch (error) {
    console.error('Failed to create message:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get messages for a conversation
 */
export async function getMessages(data: z.infer<typeof getMessagesSchema>) {
  try {
    const validated = getMessagesSchema.parse(data)
    const messages = await messageRepository.getByConversationId(
      validated.conversationId,
      {
        limit: validated.limit,
        offset: validated.offset,
        role: validated.role
      }
    )

    return { success: true, messages }
  } catch (error) {
    console.error(`Failed to get messages for conversation ${data.conversationId}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get conversation with all messages
 */
export async function getConversationWithMessages(conversationId: string) {
  try {
    if (!conversationId) {
      return { success: false, error: 'Conversation ID is required' }
    }

    const result = await messageRepository.getConversationWithMessages(conversationId)
    
    if (!result.conversation) {
      return { success: false, error: 'Conversation not found' }
    }

    return { success: true, ...result }
  } catch (error) {
    console.error(`Failed to get conversation with messages ${conversationId}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Update a message
 */
export async function updateMessage(id: string, data: Partial<NewMessage>) {
  try {
    if (!id) {
      return { success: false, error: 'Message ID is required' }
    }

    const message = await messageRepository.update(id, data)
    
    if (!message) {
      return { success: false, error: 'Message not found' }
    }

    // Revalidate relevant paths
    revalidatePath('/chat')
    revalidatePath(`/chat/${message.conversationId}`)

    return { success: true, message }
  } catch (error) {
    console.error(`Failed to update message ${id}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(id: string) {
  try {
    if (!id) {
      return { success: false, error: 'Message ID is required' }
    }

    // Get message first to know which conversation to revalidate
    const message = await messageRepository.getById(id)
    if (!message) {
      return { success: false, error: 'Message not found' }
    }

    const deleted = await messageRepository.delete(id)
    
    if (!deleted) {
      return { success: false, error: 'Message not found' }
    }

    // Revalidate relevant paths
    revalidatePath('/chat')
    revalidatePath(`/chat/${message.conversationId}`)

    return { success: true }
  } catch (error) {
    console.error(`Failed to delete message ${id}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Get conversation statistics
 */
export async function getConversationStats() {
  try {
    const stats = await conversationRepository.getStats()
    return { success: true, stats }
  } catch (error) {
    console.error('Failed to get conversation stats:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Bulk create messages (for import/restore)
 */
export async function createMessages(messagesData: NewMessage[]) {
  try {
    if (!messagesData.length) {
      return { success: false, error: 'No messages provided' }
    }

    const messages = await messageRepository.createMany(messagesData)

    // Revalidate all conversation paths
    const conversationIds = [...new Set(messagesData.map(m => m.conversationId))]
    for (const conversationId of conversationIds) {
      revalidatePath(`/chat/${conversationId}`)
    }
    revalidatePath('/chat')

    return { success: true, messages }
  } catch (error) {
    console.error('Failed to create messages:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Search conversations by title or content
 */
export async function searchConversations(query: string, limit = 20) {
  try {
    if (!query || query.trim().length < 2) {
      return { success: false, error: 'Search query must be at least 2 characters' }
    }

    // For now, implement basic search by title
    // In a full implementation, you might use FTS or vector search
    const conversations = await conversationRepository.list({ limit })
    const filtered = conversations.filter(conv => 
      conv.title.toLowerCase().includes(query.toLowerCase())
    )

    return { success: true, conversations: filtered }
  } catch (error) {
    console.error(`Failed to search conversations with query "${query}":`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}
