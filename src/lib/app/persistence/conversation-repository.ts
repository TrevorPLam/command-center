/**
 * Conversation Repository
 * 
 * Repository helpers for conversation and message operations.
 * Provides typed CRUD operations with proper error handling.
 */

import { eq, desc, and, count } from 'drizzle-orm'
import { db, withTransaction } from '@/lib/db/client'
import { conversations, messages } from '@/lib/db/schema'
import type { Conversation, Message, NewConversation, NewMessage } from '@/lib/db/schema'

export class ConversationRepository {
  /**
   * Create a new conversation
   */
  async create(data: NewConversation): Promise<Conversation> {
    const database = await db
    const [conversation] = await database
      .insert(conversations)
      .values(data)
      .returning()
    
    return conversation
  }

  /**
   * Get a conversation by ID with optional message count
   */
  async getById(id: string, includeMessageCount = false): Promise<Conversation | null> {
    const query = (await db)
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1)

    if (includeMessageCount) {
      const database = await db
      const [conversation] = await query
      if (!conversation) return null

      const messageCount = await database
        .select({ count: count() })
        .from(messages)
        .where(eq(messages.conversationId, id))
        .then(rows => rows[0]?.count || 0)

      return { ...conversation, messageCount } as Conversation & { messageCount: number }
    }

    const [conversation] = await query
    return conversation || null
  }

  /**
   * List conversations with pagination
   */
  async list(options: {
    limit?: number
    offset?: number
    archived?: boolean
    modelProfileId?: string
  } = {}): Promise<Conversation[]> {
    const { limit = 50, offset = 0, archived, modelProfileId } = options

    const whereConditions = []
    
    if (archived !== undefined) {
      whereConditions.push(
        archived 
          ? conversations.archivedAt.isNotNull()
          : conversations.archivedAt.isNull()
      )
    }
    
    if (modelProfileId) {
      whereConditions.push(eq(conversations.modelProfileId, modelProfileId))
    }

    const whereClause = whereConditions.length > 0 
      ? and(...whereConditions) 
      : undefined

    const database = await db
    return await database
      .select()
      .from(conversations)
      .where(whereClause)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset)
  }

  /**
   * Update a conversation
   */
  async update(id: string, data: Partial<NewConversation>): Promise<Conversation | null> {
    const database = await db
    const [conversation] = await database
      .update(conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning()

    return conversation || null
  }

  /**
   * Archive a conversation
   */
  async archive(id: string): Promise<boolean> {
    const database = await db
    const result = await database
      .update(conversations)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, id))

    return result.changes > 0
  }

  /**
   * Delete a conversation and all its messages (transactional)
   */
  async delete(id: string): Promise<boolean> {
    return await withTransaction(async (tx) => {
      // Delete messages first (foreign key constraint)
      await tx
        .delete(messages)
        .where(eq(messages.conversationId, id))

      // Delete conversation
      const result = await tx
        .delete(conversations)
        .where(eq(conversations.id, id))

      return result.changes > 0
    })
  }

  /**
   * Get conversation statistics
   */
  async getStats(): Promise<{
    total: number
    active: number
    archived: number
    totalMessages: number
  }> {
    const database = await db
    const [totalResult, archivedResult, messagesResult] = await Promise.all([
      database.select({ count: count() }).from(conversations),
      database.select({ count: count() }).from(conversations).where(conversations.archivedAt.isNotNull()),
      database.select({ count: count() }).from(messages)
    ])

    return {
      total: totalResult[0]?.count || 0,
      archived: archivedResult[0]?.count || 0,
      active: (totalResult[0]?.count || 0) - (archivedResult[0]?.count || 0),
      totalMessages: messagesResult[0]?.count || 0
    }
  }
}

export class MessageRepository {
  /**
   * Add a message to a conversation
   */
  async create(data: NewMessage): Promise<Message> {
    const database = await db
    const [message] = await database
      .insert(messages)
      .values(data)
      .returning()

    // Update conversation's updated timestamp
    await database
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, data.conversationId))

    return message
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getByConversationId(
    conversationId: string, 
    options: {
      limit?: number
      offset?: number
      role?: Message['role']
    } = {}
  ): Promise<Message[]> {
    const { limit = 100, offset = 0, role } = options

    let whereClause = eq(messages.conversationId, conversationId)
    if (role) {
      whereClause = and(whereClause, eq(messages.role, role))
    }

    const database = await db
    return await database
      .select()
      .from(messages)
      .where(whereClause)
      .orderBy(messages.createdAt)
      .limit(limit)
      .offset(offset)
  }

  /**
   * Get a message by ID
   */
  async getById(id: string): Promise<Message | null> {
    const database = await db
    const [message] = await database
      .select()
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1)

    return message || null
  }

  /**
   * Update a message
   */
  async update(id: string, data: Partial<NewMessage>): Promise<Message | null> {
    const database = await db
    const [message] = await database
      .update(messages)
      .set(data)
      .where(eq(messages.id, id))
      .returning()

    return message || null
  }

  /**
   * Delete a message
   */
  async delete(id: string): Promise<boolean> {
    const database = await db
    const result = await database
      .delete(messages)
      .where(eq(messages.id, id))

    return result.changes > 0
  }

  /**
   * Get conversation with all messages (for export/backup)
   */
  async getConversationWithMessages(conversationId: string): Promise<{
    conversation: Conversation | null
    messages: Message[]
  }> {
    const database = await db
    const conversation = await database
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)
      .then(rows => rows[0] || null)

    const messages = conversation 
      ? await database
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(messages.createdAt)
      : []

    return { conversation, messages }
  }

  /**
   * Bulk insert messages (for import/restore)
   */
  async createMany(messagesData: NewMessage[]): Promise<Message[]> {
    const database = await db
    const messages = await database
      .insert(messages)
      .values(messagesData)
      .returning()

    // Update conversation timestamps
    const conversationIds = [...new Set(messagesData.map(m => m.conversationId))]
    await Promise.all(
      conversationIds.map(id =>
        database
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, id))
      )
    )

    return messages
  }
}

// Export singleton instances
export const conversationRepository = new ConversationRepository()
export const messageRepository = new MessageRepository()
