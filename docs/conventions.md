# Repository Conventions

This document outlines the coding conventions, project structure, and development practices for the Command Center project.

## Project Structure

```
command-center/
├── docs/
│   ├── adr/                    # Architecture Decision Records
│   └── planning/               # Planning documents
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (command-center)/  # Main application route group
│   │   ├── api/               # API routes
│   │   └── globals.css        # Global styles
│   ├── components/            # Reusable UI components
│   │   ├── ui/               # shadcn/ui components
│   │   └── layout/           # Layout components
│   ├── lib/                  # Core libraries
│   │   ├── config/           # Configuration and environment
│   │   ├── db/               # Database setup and schema
│   │   ├── runtime/          # Runtime adapters
│   │   └── utils/            # Utility functions
│   ├── types/                # TypeScript type definitions
│   └── test/                 # Test setup and utilities
├── scripts/                  # Build and utility scripts
├── data/                     # Local data directory
├── logs/                     # Log files
└── .github/                  # GitHub workflows
```

## Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer `interface` for object shapes, `type` for unions and computed types
- Use `satisfies` operator for type-safe object creation
- Export types explicitly with `export type`
- Use const type parameters where appropriate

```typescript
// Good
interface User {
  id: string
  name: string
}

const config = {
  apiUrl: 'http://localhost:3000',
  timeout: 5000,
} satisfies Record<string, string | number>

// Avoid
const user: User = { id: '1', name: 'John' } // Unnecessary type annotation
```

### Component Patterns

- Use React Server Components by default
- Use Client Components (`'use client'`) only when necessary
- Prefer composition over inheritance
- Use shadcn/ui components as base

```typescript
// Server Component (default)
export default function UserList() {
  const users = await getUsers()
  return <div>{/* ... */}</div>
}

// Client Component (when needed)
'use client'
import { useState } from 'react'

export default function InteractiveComponent() {
  const [state, setState] = useState()
  return <div>{/* ... */}</div>
}
```

### File Naming

- Use PascalCase for components: `UserProfile.tsx`
- Use camelCase for utilities: `formatDate.ts`
- Use kebab-case for directories: `command-center/`
- Use descriptive names: `useRuntimeAdapter.ts` not `useHook.ts`

### Import Organization

```typescript
// 1. React/Next.js imports
import { useState } from 'react'
import { redirect } from 'next/navigation'

// 2. Third-party libraries
import { z } from 'zod'
import { create } from 'zustand'

// 3. Internal imports (absolute paths)
import { Button } from '@/components/ui/button'
import { validateEnv } from '@/lib/config/env'
import type { User } from '@/types'

// 4. Relative imports (for co-located files)
import './styles.css'
```

## Development Practices

### Environment Configuration

- Always validate environment variables with Zod
- Use `.env.example` as template
- Never commit `.env.local`
- Provide sensible defaults

```typescript
// lib/config/env.ts
import { z } from 'zod'

const envSchema = z.object({
  API_URL: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export const env = envSchema.parse(process.env)
```

### Error Handling

- Use Result type for operations that can fail
- Never use `any` - use `unknown` instead
- Provide meaningful error messages
- Log errors with context

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

function safeParse<T>(input: unknown): Result<T> {
  try {
    const parsed = JSON.parse(input as string)
    return { ok: true, value: parsed }
  } catch (error) {
    return { ok: false, error: error as Error }
  }
}
```

### Testing

- Write tests for all public APIs
- Use Vitest with jsdom environment
- Mock external dependencies
- Test error cases, not just happy paths

```typescript
import { describe, it, expect, vi } from 'vitest'
import { validateEnv } from '@/lib/config/env'

describe('validateEnv', () => {
  it('should validate correct environment', () => {
    const result = validateEnv()
    expect(result).toBeDefined()
  })

  it('should throw on invalid environment', () => {
    vi.stubEnv('NODE_ENV', 'invalid')
    expect(() => validateEnv()).toThrow()
  })
})
```

## Git Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Feature development
- `fix/*`: Bug fixes

### Commit Messages

Use conventional commits:

```
feat: add user authentication
fix: resolve database connection issue
docs: update API documentation
refactor: simplify runtime adapter
test: add unit tests for config validation
```

### Pull Requests

- Include tests for new functionality
- Update documentation
- Ensure CI passes
- Request review from at least one team member

## Code Review Guidelines

### What to Review

1. **Correctness**: Does the code work as intended?
2. **Type Safety**: Are TypeScript types used correctly?
3. **Performance**: Are there obvious performance issues?
4. **Security**: Are there security vulnerabilities?
5. **Maintainability**: Is the code easy to understand and modify?

### Review Process

1. Automated checks (lint, type-check, tests)
2. Peer review of code changes
3. Review of documentation updates
4. Verification of issue resolution

## Release Process

### Versioning

Use semantic versioning:

- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes

### Release Checklist

- [ ] All tests pass
- [ ] Documentation is updated
- [ ] Version is bumped
- [ ] Changelog is updated
- [ ] Git tag is created
- [ ] Release is deployed

## Performance Guidelines

### Next.js Optimization

- Use Server Components for static content
- Implement proper caching strategies
- Optimize images with Next.js Image component
- Use dynamic imports for heavy components

### Database Optimization

- Use prepared statements
- Implement proper indexing
- Use transactions for multi-step operations
- Monitor query performance

### Bundle Optimization

- Analyze bundle size regularly
- Remove unused dependencies
- Use code splitting for large features
- Optimize import patterns

## Security Practices

### Input Validation

- Validate all user input with Zod schemas
- Sanitize data before database operations
- Use parameterized queries
- Implement proper error handling

### Authentication & Authorization

- Use secure authentication methods
- Implement proper session management
- Validate permissions on every request
- Log security events

### Data Protection

- Never log sensitive information
- Use environment variables for secrets
- Implement proper data retention
- Encrypt sensitive data at rest

---

These conventions ensure consistency, maintainability, and quality across the Command Center codebase.
