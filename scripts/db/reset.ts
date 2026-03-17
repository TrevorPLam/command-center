#!/usr/bin/env tsx

/**
 * Database Reset Script
 * 
 * Resets the database to a clean state. Useful for development and testing.
 * WARNING: This will delete all data!
 */

import { Database } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from '../../src/lib/db/schema'
import { settingsRepository } from '../../src/lib/app/persistence/settings-repository'
import { env } from '../../src/lib/config/env'
import { closeDatabase } from '../../src/lib/db/client'

interface ResetOptions {
  confirm?: boolean
  seed?: boolean
  backup?: boolean
}

async function resetDatabase(options: ResetOptions = {}) {
  const { confirm = false, seed = false, backup = false } = options
  
  console.log('🔄 Database Reset Script')
  console.log('========================')
  console.log('⚠️  WARNING: This will delete ALL data in the database!')
  console.log()

  if (!confirm) {
    console.log('❌ Reset cancelled. Use --confirm to proceed.')
    console.log('   Example: pnpm db:reset --confirm')
    console.log('   Example: pnpm db:reset --confirm --seed')
    process.exit(0)
  }

  try {
    console.log('🗑️  Resetting database...')

    // Create backup if requested
    if (backup) {
      await createDatabaseBackup()
    }

    // Close existing connections
    closeDatabase()

    // Delete and recreate database file
    await deleteDatabaseFile()

    // Initialize fresh database
    await initializeFreshDatabase()

    // Re-initialize default settings
    console.log('⚙️ Re-initializing default settings...')
    await settingsRepository.initializeDefaults()

    // Seed with sample data if requested
    if (seed) {
      console.log('🌱 Seeding database with sample data...')
      await seedSampleData()
    }

    console.log('✅ Database reset completed successfully!')
    console.log()
    console.log('📊 Database Statistics:')
    await printDatabaseStats()

  } catch (error) {
    console.error('❌ Database reset failed:', error)
    process.exit(1)
  }
}

async function createDatabaseBackup() {
  console.log('💾 Creating database backup...')
  
  const fs = require('fs')
  const path = require('path')
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(
    path.dirname(env.DATABASE_URL), 
    `backup-${timestamp}.db`
  )
  
  try {
    fs.copyFileSync(env.DATABASE_URL, backupPath)
    console.log(`  ✓ Backup created: ${backupPath}`)
  } catch (error) {
    console.warn('  ⚠️  Backup failed:', error)
  }
}

async function deleteDatabaseFile() {
  const fs = require('fs')
  const path = require('path')
  
  try {
    if (fs.existsSync(env.DATABASE_URL)) {
      fs.unlinkSync(env.DATABASE_URL)
      console.log('  ✓ Database file deleted')
    } else {
      console.log('  ℹ️  Database file does not exist')
    }
  } catch (error) {
    console.error('  ❌ Failed to delete database file:', error)
    throw error
  }
}

async function initializeFreshDatabase() {
  console.log('🔧 Initializing fresh database...')
  
  // Ensure data directory exists
  const fs = require('fs')
  const path = require('path')
  const dbDir = path.dirname(env.DATABASE_URL)
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // Create new database connection
  const dbInstance = new Database(env.DATABASE_URL)
  
  // Configure database
  dbInstance.pragma('foreign_keys = ON')
  dbInstance.pragma('journal_mode = WAL')
  dbInstance.pragma('synchronous = NORMAL')
  dbInstance.pragma('cache_size = 1000000')
  dbInstance.pragma('temp_store = MEMORY')
  
  // Run migrations
  const db = drizzle(dbInstance, { schema })
  await migrate(db, { migrationsFolder: './src/lib/db/migrations' })
  
  dbInstance.close()
  console.log('  ✓ Fresh database initialized')
}

async function seedSampleData() {
  // Import and run the seed function
  const { seedDatabase } = await import('./seed')
  await seedDatabase()
}

async function printDatabaseStats() {
  try {
    // Re-open database connection for stats
    const dbInstance = new Database(env.DATABASE_URL)
    const db = drizzle(dbInstance, { schema })

    // Get table counts
    const tables = [
      { name: 'conversations', table: schema.conversations },
      { name: 'messages', table: schema.messages },
      { name: 'model_profiles', table: schema.modelProfiles },
      { name: 'settings', table: schema.settings },
      { name: 'prompt_templates', table: schema.promptTemplates },
      { name: 'runtime_snapshots', table: schema.runtimeSnapshots }
    ]

    for (const { name, table } of tables) {
      try {
        const result = await db.select().from(table).limit(1)
        console.log(`  ${name}: ${result.length}+ records`)
      } catch (error) {
        console.log(`  ${name}: N/A`)
      }
    }

    dbInstance.close()
  } catch (error) {
    console.warn('  ⚠️  Could not fetch database stats:', error)
  }
}

// Parse command line arguments
function parseArgs(): ResetOptions {
  const args = process.argv.slice(2)
  const options: ResetOptions = {}

  for (const arg of args) {
    if (arg === '--confirm') {
      options.confirm = true
    } else if (arg === '--seed') {
      options.seed = true
    } else if (arg === '--backup') {
      options.backup = true
    } else if (arg === '--help' || arg === '-h') {
      console.log('Database Reset Script')
      console.log('====================')
      console.log()
      console.log('Usage: pnpm db:reset [options]')
      console.log()
      console.log('Options:')
      console.log('  --confirm    Confirm the reset (required)')
      console.log('  --seed       Seed with sample data after reset')
      console.log('  --backup     Create backup before reset')
      console.log('  --help, -h   Show this help message')
      console.log()
      console.log('Examples:')
      console.log('  pnpm db:reset --confirm')
      console.log('  pnpm db:reset --confirm --seed')
      console.log('  pnpm db:reset --confirm --backup --seed')
      process.exit(0)
    }
  }

  return options
}

// Run the reset function
if (require.main === module) {
  const options = parseArgs()
  resetDatabase(options)
    .then(() => {
      console.log('🎉 Reset completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Reset failed:', error)
      process.exit(1)
    })
}
