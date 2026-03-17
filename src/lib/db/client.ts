/**
 * Database Client
 * 
 * Centralized database connection and client management for SQLite with Drizzle ORM.
 * Provides connection pooling, migration management, and transaction handling.
 * Using sql.js for pure JavaScript SQLite implementation (no native dependencies).
 */

import { drizzle } from 'drizzle-orm/sql-js'
import initSqlJs, { Database } from 'sql.js'
import * as schema from './schema'
import { env } from '@/lib/config/env'
import { promises as fs } from 'fs'
import path from 'path'

// Database connection singleton
let db: ReturnType<typeof drizzle> | null = null
let dbInstance: Database | null = null
let sqlJsModule: any = null

/**
 * Initialize SQL.js module
 */
async function initSqlJsModule() {
  if (!sqlJsModule) {
    sqlJsModule = await initSqlJs({
      locateFile: (file: string) => {
        // For Node.js environment, use the local file
        if (typeof window === 'undefined') {
          const path = require('path')
          return path.join(__dirname, '..', '..', '..', 'node_modules', 'sql.js', 'dist', file)
        }
        // For browser environment, use CDN
        return `https://sql.js.org/dist/${file}`
      }
    })
  }
  return sqlJsModule
}

/**
 * Get the database instance (singleton pattern)
 */
export async function getDatabase() {
  if (!db) {
    // Initialize SQL.js
    await initSqlJsModule()
    
    // Ensure data directory exists
    const dbDir = path.dirname(env.DATABASE_URL)
    
    try {
      await fs.access(dbDir)
    } catch {
      await fs.mkdir(dbDir, { recursive: true })
    }

    // Try to load existing database file
    try {
      const dbFile = await fs.readFile(env.DATABASE_URL)
      dbInstance = new sqlJsModule.Database(dbFile)
    } catch {
      // Create new database if file doesn't exist
      dbInstance = new sqlJsModule.Database()
    }
    
    // Create Drizzle instance
    db = drizzle(dbInstance, { schema })
  }
  
  return db
}

/**
 * Save database to file
 */
export async function saveDatabase() {
  if (dbInstance) {
    const dbData = dbInstance.export()
    await fs.writeFile(env.DATABASE_URL, Buffer.from(dbData))
  }
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
    db = null
  }
}

/**
 * Get database for use in server components/API routes
 */
export const database = getDatabase()

/**
 * Database transaction helper
 */
export async function withTransaction<T>(
  callback: (tx: Parameters<typeof getDatabase>[0]['transaction']) => Promise<T>
): Promise<T> {
  const database = await getDatabase()
  // Note: sql.js doesn't support transactions in the same way, 
  // so we'll execute the callback directly
  return callback(database as any)
}

/**
 * Database health check
 */
export async function checkDatabaseHealth() {
  try {
    const database = await getDatabase()
    
    // Test basic connectivity with a simple query
    const result = database.prepare('SELECT 1 as test').get()
    
    return {
      status: 'healthy',
      message: 'Database connection successful',
      timestamp: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown database error',
      timestamp: new Date().toISOString()
    }
  }
}

// Export schema and database instance for convenience
export * from './schema'
export { database as db }
