#!/usr/bin/env tsx

/**
 * Database Seed Script
 * 
 * Populates the database with initial data for development and testing.
 * Includes sample conversations, prompts, and default settings.
 */

import { validateEnv } from '../../src/lib/config/env'
import { env } from '../../src/lib/config/env'
import { settingsRepository } from '../../src/lib/app/persistence/settings-repository'
import { conversationRepository } from '../../src/lib/app/persistence/conversation-repository'
import { messageRepository } from '../../src/lib/app/persistence/conversation-repository'
import { promptTemplateRepository } from '../../src/lib/app/persistence/prompt-repository'

/**
 * Run database migrations
 */
async function runMigrations() {
  // Import and run the migration function directly
  await import('./migrate').then(module => {
    if (module.runMigrations) {
      return module.runMigrations()
    } else {
      throw new Error('runMigrations function not found in migrate module')
    }
  })
}

async function seedDatabase() {
  console.log('🌱 Starting database seeding...')
  
  try {
    // Validate environment first
    validateEnv()
    
    // Run migrations first
    console.log('📋 Running database migrations...')
    await runMigrations()
    
    // Initialize database connection and seed data

    // Initialize default settings
    console.log('⚙️ Initializing default settings...')
    await settingsRepository.initializeDefaults()
    
    // Add some sample data
    await seedSampleData()
    
    console.log('✅ Database seeding completed successfully!')
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error)
    process.exit(1)
  }
}

async function seedSampleData() {
  console.log('📝 Adding sample data...')

  // Sample prompt templates
  const samplePrompts = [
    {
      id: 'code-review-template',
      name: 'code-review',
      description: 'Review code for best practices and potential issues',
      template: `Please review the following code for:
- Code quality and best practices
- Potential bugs or security issues
- Performance optimizations
- Suggest improvements

Code to review:
\`\`\`{{language}}
{{code}}
\`\`\`

Focus on: {{focus_area}}`,
      variables: JSON.stringify(['language', 'code', 'focus_area']),
      category: 'development',
      tags: JSON.stringify(['code', 'review', 'development']),
      isActive: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'summarize-text-template',
      name: 'summarize-text',
      description: 'Create a concise summary of provided text',
      template: `Please provide a concise summary of the following text.

Text:
{{text}}

Requirements:
- Maximum length: {{max_length}} characters
- Focus on: {{focus_points}}
- Output format: {{format}}`,
      variables: JSON.stringify(['text', 'max_length', 'focus_points', 'format']),
      category: 'productivity',
      tags: JSON.stringify(['summary', 'text', 'productivity']),
      isActive: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'explain-concept-template',
      name: 'explain-concept',
      description: 'Explain complex concepts in simple terms',
      template: `Explain the concept of "{{concept}}" in simple terms.

Target audience: {{audience}}
Context: {{context}}
Desired depth: {{depth_level}}

Please provide:
1. A simple definition
2. Key points to understand
3. A practical example
4. Common misconceptions to avoid`,
      variables: JSON.stringify(['concept', 'audience', 'context', 'depth_level']),
      category: 'education',
      tags: JSON.stringify(['explanation', 'education', 'learning']),
      isActive: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]

  for (const promptData of samplePrompts) {
    const existing = await promptTemplateRepository.getByName(promptData.name)
    if (!existing) {
      await promptTemplateRepository.create(promptData)
      console.log(`  ✓ Created prompt template: ${promptData.name}`)
    }
  }

  // Sample conversation
  const sampleConversation = await conversationRepository.create({
    id: 'sample-conversation-1',
    title: 'Sample AI Assistant Conversation',
    modelProfileId: 'llama3.1-8b',
    summaryJson: JSON.stringify({
      user_goal: 'Demonstrate chat functionality',
      topics_discussed: ['AI capabilities', 'system features'],
      key_insights: ['System is working properly']
    }),
    metadata: JSON.stringify({
      is_sample: true,
      created_for: 'demonstration'
    }),
    createdAt: new Date(),
    updatedAt: new Date()
  })

  console.log(`  ✓ Created sample conversation: ${sampleConversation.id}`)

  // Sample messages
  const sampleMessages = [
    {
      id: 'sample-message-1',
      conversationId: sampleConversation.id,
      role: 'system' as const,
      content: 'You are a helpful AI assistant demonstrating the chat functionality of the Command Center system.',
      tokenCount: 15,
      metadata: JSON.stringify({ sample: true }),
      createdAt: new Date()
    },
    {
      id: 'sample-message-2',
      conversationId: sampleConversation.id,
      role: 'user' as const,
      content: 'Hello! Can you tell me about the features of this Command Center system?',
      tokenCount: 14,
      metadata: JSON.stringify({ sample: true }),
      createdAt: new Date()
    },
    {
      id: 'sample-message-3',
      conversationId: sampleConversation.id,
      role: 'assistant' as const,
      content: 'The Command Center is a comprehensive AI operations console with several key features:\n\n1. **Multi-Panel Dashboard** - Organized interface for chat, models, RAG, agents, monitoring, and prompts\n2. **Runtime Integration** - Seamless connection to local AI models via Ollama\n3. **Conversation Management** - Persistent chat history with search and organization\n4. **Model Management** - View and manage installed AI models\n5. **Settings System** - Customizable preferences and configuration\n6. **Diagnostics** - System health monitoring and troubleshooting tools\n\nThe system is built with Next.js 15, TypeScript, and SQLite for local data persistence.',
      tokenCount: 85,
      latencyMs: 1250,
      metadata: JSON.stringify({ sample: true }),
      createdAt: new Date()
    },
    {
      id: 'sample-message-4',
      conversationId: sampleConversation.id,
      role: 'user' as const,
      content: 'That sounds impressive! What makes this different from other AI interfaces?',
      tokenCount: 12,
      metadata: JSON.stringify({ sample: true }),
      createdAt: new Date()
    },
    {
      id: 'sample-message-5',
      conversationId: sampleConversation.id,
      role: 'assistant' as const,
      content: 'The Command Center stands out in several ways:\n\n**Local-First Architecture**: Everything runs locally on your machine, ensuring privacy and offline capability.\n\n**Panel-Based Organization**: Instead of a single chat window, you get specialized panels for different tasks, making it easier to manage complex workflows.\n\n**Professional Integration**: Built for serious AI work with features like model profiling, performance metrics, and structured output support.\n\n**Extensible Design**: The system is designed to be extended with custom tools, agents, and workflows.\n\n**Developer-Friendly**: Full TypeScript support, comprehensive APIs, and detailed logging for debugging and optimization.\n\nIt\'s essentially a control surface for AI operations, not just another chat interface.',
      tokenCount: 78,
      latencyMs: 980,
      metadata: JSON.stringify({ sample: true }),
      createdAt: new Date()
    }
  ]

  for (const messageData of sampleMessages) {
    await messageRepository.create(messageData)
    console.log(`  ✓ Created sample message: ${messageData.id}`)
  }

  // Additional sample settings
  const additionalSettings = [
    {
      key: 'ui.welcome_shown',
      value: true,
      category: 'ui',
      description: 'Whether the welcome dialog has been shown',
      isPublic: false
    },
    {
      key: 'ui.last_active_panel',
      value: 'chat',
      category: 'ui',
      description: 'Last active panel in the dashboard',
      isPublic: false
    },
    {
      key: 'runtime.preferred_embedding_model',
      value: 'all-minilm:latest',
      category: 'runtime',
      description: 'Preferred model for embedding generation',
      isPublic: true
    },
    {
      key: 'features.auto_save_conversations',
      value: true,
      category: 'features',
      description: 'Automatically save conversation drafts',
      isPublic: true
    },
    {
      key: 'system.last_backup',
      value: new Date().toISOString(),
      category: 'system',
      description: 'Timestamp of last system backup',
      isPublic: false
    }
  ]

  for (const setting of additionalSettings) {
    const existing = await settingsRepository.get(setting.key)
    if (!existing) {
      await settingsRepository.set(setting.key, setting.value, {
        category: setting.category,
        description: setting.description,
        isPublic: setting.isPublic
      })
      console.log(`  ✓ Created setting: ${setting.key}`)
    }
  }

  console.log('📝 Sample data added successfully!')
}

// Run the seed function
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error)
      process.exit(1)
    })
}
