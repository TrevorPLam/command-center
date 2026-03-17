#!/usr/bin/env tsx

/**
 * Database Migration Runner
 * 
 * Runs database migrations using sql.js and Drizzle.
 * Handles the migration process for the pure JavaScript SQLite implementation.
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'
import { validateEnv } from '../../src/lib/config/env'
import { env } from '../../src/lib/config/env'
import * as sqlJsModule from 'sql.js'

interface Migration {
  id: string
  sql: string
}

async function runMigrations() {
  console.log('🔄 Running database migrations...')
  
  try {
    // Validate environment
    validateEnv()
    
    // Initialize SQL.js
    const sqlJs = await sqlJsModule.default({
      locateFile: (file: string) => {
        // For Node.js environment, use the local file
        const path = require('path')
        return path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
      }
    })
    
    // Ensure data directory exists
    const dbDir = path.dirname(env.DATABASE_URL)
    
    try {
      await require('fs').promises.access(dbDir)
    } catch {
      await require('fs').promises.mkdir(dbDir, { recursive: true })
    }

    // Load or create database
    let db: sqlJsModule.Database
    try {
      const dbFile = readFileSync(env.DATABASE_URL)
      db = new sqlJs.Database(dbFile)
    } catch {
      db = new sqlJs.Database()
    }

    // Create migrations table if it doesn't exist
    try {
      db.run(`CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )`)
    } catch (error) {
      console.warn('Migration table creation warning:', error)
    }

    // Get migration files
    const migrationsDir = path.join(process.cwd(), 'src/lib/db/migrations')
    if (!existsSync(migrationsDir)) {
      console.log('📁 No migrations directory found, skipping migrations')
      return
    }

    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()

    if (migrationFiles.length === 0) {
      console.log('📁 No migration files found')
      return
    }

    // Get applied migrations
    let appliedMigrations: string[] = []
    try {
      const result = db.exec('SELECT hash FROM __drizzle_migrations ORDER BY created_at')
      if (result.length > 0 && result[0].values) {
        appliedMigrations = result[0].values.map((row: any) => row[0])
      }
    } catch (error) {
      console.warn('Could not fetch applied migrations:', error)
    }

    // Run pending migrations
    let migrationsRun = 0
    for (const file of migrationFiles) {
      const migrationId = path.basename(file, '.sql')
      
      if (appliedMigrations.includes(migrationId)) {
        console.log(`  ⏭️  Skipping already applied migration: ${migrationId}`)
        continue
      }

      try {
        const migrationPath = path.join(migrationsDir, file)
        const migrationSql = readFileSync(migrationPath, 'utf8')
        
        console.log(`  🔄 Running migration: ${migrationId}`)
        
        // Run migration in a transaction-like manner
        try {
          db.exec(migrationSql)
          
          // Record migration
          db.run('INSERT INTO __drizzle_migrations (hash) VALUES (?)', [migrationId])
          
          migrationsRun++
          console.log(`  ✅ Migration completed: ${migrationId}`)
        } catch (migrationError) {
          console.error(`  ❌ Migration failed: ${migrationId}`, migrationError)
          throw migrationError
        }
      } catch (error) {
        console.error(`  ❌ Error processing migration ${file}:`, error)
        throw error
      }
    }

    // Save database
    const dbData = db.export()
    require('fs').promises.writeFile(env.DATABASE_URL, Buffer.from(dbData))
    
    db.close()

    if (migrationsRun > 0) {
      console.log(`✅ Successfully ran ${migrationsRun} migrations`)
    } else {
      console.log('✅ All migrations are up to date')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Export the function for use in other modules
export { runMigrations }

// Run migrations
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🎉 Migrations completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error)
      process.exit(1)
    })
}
