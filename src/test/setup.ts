import { vi } from 'vitest'

/// <reference types="vitest" />
import '@testing-library/jest-dom'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock environment variables
Object.defineProperty(process, 'env', {
  value: {
    ...process.env,
    NODE_ENV: 'test',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    DATABASE_URL: ':memory:',
    LANCEDB_DIR: './test-data/lancedb',
    LOG_DIR: './test-data/logs',
  },
  writable: true,
})
