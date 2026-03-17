import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './src/lib/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? './data/command-center.db',
  },
  verbose: true,
  strict: true,
  // Note: We'll handle migrations manually since we're using sql.js
})
