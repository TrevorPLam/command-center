import { z } from 'zod'

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Ollama configuration
  OLLAMA_BASE_URL: z.string().url().default('http://127.0.0.1:11434'),

  // Database configuration
  DATABASE_URL: z.string().min(1).default('./data/command-center.db'),

  // LanceDB configuration
  LANCEDB_DIR: z.string().min(1).default('./data/lancedb'),

  // Logging configuration
  LOG_DIR: z.string().min(1).default('./data/logs'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Server configuration
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  HOSTNAME: z.string().default('localhost'),

  // Feature flags
  ENABLE_RAG: z.string().transform(Boolean).default('true'),
  ENABLE_AGENTS: z.string().transform(Boolean).default('false'),
  ENABLE_MONITORING: z.string().transform(Boolean).default('true'),

  // Security
  ENABLE_AUTH: z.string().transform(Boolean).default('false'),
  JWT_SECRET: z.string().optional(),

  // Development
  ENABLE_DEVTOOLS: z.string().transform(Boolean).default('false'),
})

export type Env = z.infer<typeof envSchema>

let validatedEnv: Env

export function validateEnv(): Env {
  if (!validatedEnv) {
    try {
      validatedEnv = envSchema.parse(process.env)
    } catch (error) {
      console.error('❌ Invalid environment variables:')
      console.error(error)
      process.exit(1)
    }
  }

  return validatedEnv
}

export function getEnv(): Env {
  if (!validatedEnv) {
    throw new Error('Environment not validated. Call validateEnv() first.')
  }

  return validatedEnv
}
