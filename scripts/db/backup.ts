#!/usr/bin/env tsx

/**
 * Database Backup Script
 * 
 * Creates backups of the database with optional compression and rotation.
 * Supports full backups and incremental exports of specific data.
 */

import { Database } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../src/lib/db/schema'
import { settingsRepository } from '../../src/lib/app/persistence/settings-repository'
import { conversationRepository } from '../../src/lib/app/persistence/conversation-repository'
import { promptTemplateRepository } from '../../src/lib/app/persistence/prompt-repository'
import { env } from '@/lib/config/env'

interface BackupOptions {
  compress?: boolean
  rotate?: number
  includeData?: boolean
  outputDir?: string
}

interface BackupData {
  version: string
  timestamp: string
  settings: any[]
  conversations: any[]
  promptTemplates: any[]
  metadata: {
    totalConversations: number
    totalMessages: number
    totalPromptTemplates: number
    databaseSize: number
  }
}

async function createDatabaseBackup(options: BackupOptions = {}) {
  const { 
    compress = false, 
    rotate = 7, 
    includeData = true, 
    outputDir = './backups' 
  } = options

  console.log('💾 Creating database backup...')
  console.log('=============================')

  try {
    // Ensure output directory exists
    const fs = require('fs')
    const path = require('path')
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
      console.log(`📁 Created backup directory: ${outputDir}`)
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupBase = path.join(outputDir, `command-center-backup-${timestamp}`)

    // Create database file backup
    const dbBackupPath = `${backupBase}.db`
    fs.copyFileSync(env.DATABASE_URL, dbBackupPath)
    console.log(`✓ Database file backed up: ${dbBackupPath}`)

    let backupData: BackupData | null = null

    // Create data export if requested
    if (includeData) {
      backupData = await createDataExport(backupBase)
    }

    // Compress if requested
    if (compress) {
      await compressBackup(dbBackupPath, backupBase, backupData)
    }

    // Rotate old backups
    await rotateOldBackups(outputDir, rotate)

    // Update last backup timestamp
    await settingsRepository.set('system.last_backup', new Date().toISOString(), {
      category: 'system',
      description: 'Timestamp of last system backup',
      isPublic: false
    })

    console.log('✅ Backup completed successfully!')
    console.log()
    console.log('📊 Backup Summary:')
    console.log(`  Location: ${compress ? `${backupBase}.zip` : dbBackupPath}`)
    console.log(`  Size: ${formatBytes(fs.statSync(compress ? `${backupBase}.zip` : dbBackupPath).size)}`)
    
    if (backupData) {
      console.log(`  Conversations: ${backupData.metadata.totalConversations}`)
      console.log(`  Prompt Templates: ${backupData.metadata.totalPromptTemplates}`)
      console.log(`  Settings: ${backupData.settings.length}`)
    }

  } catch (error) {
    console.error('❌ Backup failed:', error)
    process.exit(1)
  }
}

async function createDataExport(backupBase: string): Promise<BackupData> {
  console.log('📤 Exporting data...')
  
  const fs = require('fs')
  const path = require('path')

  try {
    // Export settings
    const settings = await settingsRepository.getAll()
    console.log(`  ✓ Exported ${settings.length} settings`)

    // Export conversations with messages
    const conversations = []
    const conversationList = await conversationRepository.list({ limit: 1000 })
    
    for (const conversation of conversationList) {
      const { conversation: conv, messages } = await conversationRepository.getConversationWithMessages(conversation.id)
      if (conv) {
        conversations.push({
          ...conv,
          messages
        })
      }
    }
    
    console.log(`  ✓ Exported ${conversations.length} conversations with ${conversations.reduce((sum, c) => sum + c.messages.length, 0)} messages`)

    // Export prompt templates
    const promptTemplates = await promptTemplateRepository.list({ limit: 1000 })
    console.log(`  ✓ Exported ${promptTemplates.length} prompt templates`)

    // Calculate metadata
    const metadata = {
      totalConversations: conversations.length,
      totalMessages: conversations.reduce((sum, c) => sum + c.messages.length, 0),
      totalPromptTemplates: promptTemplates.length,
      databaseSize: fs.statSync(env.DATABASE_URL).size
    }

    const backupData: BackupData = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      settings,
      conversations,
      promptTemplates,
      metadata
    }

    // Write data export
    const dataPath = `${backupBase}-data.json`
    fs.writeFileSync(dataPath, JSON.stringify(backupData, null, 2))
    console.log(`  ✓ Data export saved: ${dataPath}`)

    return backupData

  } catch (error) {
    console.error('  ❌ Data export failed:', error)
    throw error
  }
}

async function compressBackup(dbPath: string, backupBase: string, data: BackupData | null) {
  console.log('🗜️  Compressing backup...')
  
  try {
    const fs = require('fs')
    const path = require('path')
    const archiver = require('archiver')

    return new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(`${backupBase}.zip`)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => {
        console.log(`  ✓ Backup compressed: ${backupBase}.zip`)
        
        // Remove uncompressed files
        fs.unlinkSync(dbPath)
        if (data) {
          fs.unlinkSync(`${backupBase}-data.json`)
        }
        
        resolve()
      })

      archive.on('error', (error: any) => {
        reject(error)
      })

      archive.pipe(output)

      // Add database file
      archive.file(dbPath, { name: 'command-center.db' })

      // Add data export if it exists
      if (data) {
        archive.file(`${backupBase}-data.json`, { name: 'data.json' })
      }

      archive.finalize()
    })

  } catch (error) {
    console.warn('  ⚠️  Compression failed, keeping uncompressed backup:', error)
  }
}

async function rotateOldBackups(outputDir: string, keepCount: number) {
  console.log(`🔄 Rotating backups (keeping ${keepCount} most recent)...`)
  
  try {
    const fs = require('fs')
    const path = require('path')

    const files = fs.readdirSync(outputDir)
      .filter((file: string) => file.startsWith('command-center-backup-'))
      .map((file: string) => ({
        name: file,
        path: path.join(outputDir, file),
        time: fs.statSync(path.join(outputDir, file)).mtime
      }))
      .sort((a: any, b: any) => b.time - a.time)

    if (files.length > keepCount) {
      const filesToDelete = files.slice(keepCount)
      
      for (const file of filesToDelete) {
        fs.unlinkSync(file.path)
        console.log(`  🗑️  Deleted old backup: ${file.name}`)
      }
    }

    console.log(`  ✓ Kept ${Math.min(files.length, keepCount)} backups`)

  } catch (error) {
    console.warn('  ⚠️  Backup rotation failed:', error)
  }
}

async function restoreFromBackup(backupPath: string) {
  console.log('🔄 Restoring from backup...')
  console.log('==========================')

  try {
    const fs = require('fs')
    const path = require('path')

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }

    // Create current backup before restore
    console.log('💾 Creating safety backup before restore...')
    await createDatabaseBackup({ 
      compress: false, 
      includeData: false,
      outputDir: './backups/pre-restore'
    })

    // Close existing database connections
    const { closeDatabase } = require('../../src/lib/db/client')
    closeDatabase()

    // Copy backup file
    fs.copyFileSync(backupPath, env.DATABASE_URL)
    console.log(`✓ Database restored from: ${backupPath}`)

    // If there's a data export file, restore that too
    const dataPath = backupPath.replace('.db', '-data.json')
    if (fs.existsSync(dataPath)) {
      console.log('📤 Restoring data from export...')
      await restoreDataFromExport(dataPath)
    }

    console.log('✅ Restore completed successfully!')
    console.log('⚠️  Please restart the application to ensure all connections are refreshed.')

  } catch (error) {
    console.error('❌ Restore failed:', error)
    process.exit(1)
  }
}

async function restoreDataFromExport(dataPath: string) {
  try {
    const fs = require('fs')
    const data: BackupData = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

    // Restore settings
    if (data.settings && data.settings.length > 0) {
      const { settingsRepository } = require('../../src/lib/app/persistence/settings-repository')
      for (const setting of data.settings) {
        await settingsRepository.set(setting.key, JSON.parse(setting.value), {
          category: setting.category,
          description: setting.description,
          isPublic: setting.isPublic
        })
      }
      console.log(`  ✓ Restored ${data.settings.length} settings`)
    }

    // Restore conversations and messages
    if (data.conversations && data.conversations.length > 0) {
      const { conversationRepository, messageRepository } = require('../../src/lib/app/persistence/conversation-repository')
      
      for (const conv of data.conversations) {
        // Create conversation
        await conversationRepository.create({
          id: conv.id,
          title: conv.title,
          modelProfileId: conv.modelProfileId,
          summaryJson: conv.summaryJson,
          metadata: conv.metadata,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt)
        })

        // Create messages
        if (conv.messages && conv.messages.length > 0) {
          await messageRepository.createMany(conv.messages.map((msg: any) => ({
            id: msg.id,
            conversationId: msg.conversationId,
            role: msg.role,
            content: msg.content,
            tokenCount: msg.tokenCount,
            latencyMs: msg.latencyMs,
            metadata: msg.metadata,
            createdAt: new Date(msg.createdAt)
          })))
        }
      }
      
      console.log(`  ✓ Restored ${data.conversations.length} conversations`)
    }

    // Restore prompt templates
    if (data.promptTemplates && data.promptTemplates.length > 0) {
      const { promptTemplateRepository } = require('../../src/lib/app/persistence/prompt-repository')
      
      for (const template of data.promptTemplates) {
        await promptTemplateRepository.create({
          id: template.id,
          name: template.name,
          description: template.description,
          template: template.template,
          variables: template.variables,
          category: template.category,
          tags: template.tags,
          isActive: template.isActive,
          usageCount: template.usageCount,
          metadata: template.metadata,
          createdAt: new Date(template.createdAt),
          updatedAt: new Date(template.updatedAt)
        })
      }
      
      console.log(`  ✓ Restored ${data.promptTemplates.length} prompt templates`)
    }

  } catch (error) {
    console.error('  ❌ Data restore failed:', error)
    throw error
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Parse command line arguments
function parseArgs(): { action: string, options: BackupOptions, backupPath?: string } {
  const args = process.argv.slice(2)
  const options: BackupOptions = {}
  let action = 'backup'
  let backupPath = ''

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg === '--compress') {
      options.compress = true
    } else if (arg === '--rotate') {
      options.rotate = parseInt(args[++i]) || 7
    } else if (arg === '--no-data') {
      options.includeData = false
    } else if (arg === '--output-dir') {
      options.outputDir = args[++i]
    } else if (arg === '--restore') {
      action = 'restore'
      backupPath = args[++i]
    } else if (arg === '--help' || arg === '-h') {
      console.log('Database Backup Script')
      console.log('======================')
      console.log()
      console.log('Usage: pnpm db:backup [options]')
      console.log('       pnpm db:backup --restore <backup-file>')
      console.log()
      console.log('Options:')
      console.log('  --compress              Compress backup with ZIP')
      console.log('  --rotate <count>        Keep only N most recent backups (default: 7)')
      console.log('  --no-data               Skip data export (database file only)')
      console.log('  --output-dir <dir>      Custom output directory (default: ./backups)')
      console.log('  --restore <file>        Restore from backup file')
      console.log('  --help, -h              Show this help message')
      console.log()
      console.log('Examples:')
      console.log('  pnpm db:backup')
      console.log('  pnpm db:backup --compress --rotate 5')
      console.log('  pnpm db:backup --restore ./backups/command-center-backup-2024-01-01.db')
      process.exit(0)
    }
  }

  return { action, options, backupPath }
}

// Run the backup function
if (require.main === module) {
  const { action, options, backupPath } = parseArgs()
  
  if (action === 'restore') {
    if (!backupPath) {
      console.error('❌ Backup file path required for restore')
      process.exit(1)
    }
    restoreFromBackup(backupPath)
  } else {
    createDatabaseBackup(options)
      .then(() => {
        console.log('🎉 Backup completed!')
        process.exit(0)
      })
      .catch((error) => {
        console.error('💥 Backup failed:', error)
        process.exit(1)
      })
  }
}
