import { validateEnv, type Env } from './env'

// Placeholder types that will be replaced in future tasks
type DatabaseClient = any // Will be replaced with actual Drizzle client in CC-004
type LanceDBClient = any // Will be replaced with actual LanceDB client in CC-007

export interface RuntimeServices {
  env: Env
  database: DatabaseClient | null
  lancedb: LanceDBClient | null
  logger: Logger
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

class SimpleLogger implements Logger {
  constructor(private env: Env) {}

  debug(message: string, ...args: unknown[]): void {
    if (this.env.LOG_LEVEL === 'debug') {
      console.debug(`[DEBUG] ${message}`, ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    console.info(`[INFO] ${message}`, ...args)
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args)
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args)
  }
}

let runtimeServices: RuntimeServices | null = null

export async function bootstrapRuntime(): Promise<RuntimeServices> {
  if (runtimeServices) {
    return runtimeServices
  }

  // Validate environment variables
  const env = validateEnv()

  // Initialize logger
  const logger = new SimpleLogger(env)
  logger.info('🚀 Bootstrapping Command Center runtime...')

  // Verify prerequisites
  await verifyPrerequisites(env, logger)

  // Initialize database (will be implemented in CC-004)
  logger.info('📊 Database initialization skipped (will be implemented in CC-004)')

  // Initialize LanceDB (will be implemented in CC-007)
  logger.info('🔍 Vector database initialization skipped (will be implemented in CC-007)')

  // Create runtime services object
  runtimeServices = {
    env,
    database: null, // Placeholder
    lancedb: null, // Placeholder
    logger,
  }

  logger.info('✅ Runtime bootstrap complete')
  return runtimeServices
}

export function getRuntimeServices(): RuntimeServices {
  if (!runtimeServices) {
    throw new Error('Runtime not bootstrapped. Call bootstrapRuntime() first.')
  }
  return runtimeServices
}

async function verifyPrerequisites(env: Env, logger: Logger): Promise<void> {
  logger.info('🔍 Verifying prerequisites...')

  // Check Node.js version
  const nodeVersion = process.version
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] || '0')
  if (majorVersion < 20) {
    throw new Error(`Node.js 20+ required, but found ${nodeVersion}`)
  }
  logger.info(`✅ Node.js version: ${nodeVersion}`)

  // Check Ollama connectivity
  try {
    const ollamaResponse = await fetch(`${env.OLLAMA_BASE_URL}/api/version`)
    if (!ollamaResponse.ok) {
      throw new Error(`Ollama responded with ${ollamaResponse.status}`)
    }
    const ollamaVersion = await ollamaResponse.json()
    logger.info(`✅ Ollama connectivity: ${ollamaVersion.version}`)
  } catch (error) {
    logger.warn(`⚠️  Ollama connectivity issue: ${error}`)
    logger.warn('   Make sure Ollama is running on ' + env.OLLAMA_BASE_URL)
  }

  // Check data directories
  const fs = await import('fs/promises')
  const path = await import('path')

  const requiredDirs = [path.dirname(env.DATABASE_URL), env.LANCEDB_DIR, env.LOG_DIR]

  for (const dir of requiredDirs) {
    try {
      await fs.mkdir(dir, { recursive: true })
      logger.info(`✅ Directory ready: ${dir}`)
    } catch (error) {
      logger.warn(`⚠️  Directory issue: ${dir} - ${error}`)
    }
  }

  logger.info('✅ Prerequisite verification complete')
}
