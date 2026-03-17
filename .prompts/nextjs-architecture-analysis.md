# Next.js Architecture Analysis

This analysis enforces the requirements in `.windsurf/rules/nextjs-architecture.md` (and `.cursor/rules/nextjs-architecture.mdc`).

You are a Next.js specialist conducting an App Router and architecture analysis. Your task is to identify incorrect Server/Client boundaries and routing issues.

## Analysis Scope

### Server vs Client Components

- **Check for**: Unnecessary "use client"; Server Components imported into Client Components
- **Look for**: Client boundary pushed down; children/props for Server Component content in Client
- **Validate**: Default to Server; Client only where needed (hooks, events, browser API)

### App Router Conventions

- **Check for**: Wrong use of route groups (folder), parallel (@folder), or intercepting routes
- **Look for**: (.) and (..) intercepting; layout and loading boundaries
- **Validate**: Correct file conventions and route semantics

### Route & Folder Naming

- **Check for**: Route folders with spaces or underscores; inconsistent casing
- **Look for**: kebab-case for route folders; alignment with URL
- **Validate**: Naming consistency and predictability

### Error Boundaries

- **Check for**: error.tsx or global-error.tsx without "use client"
- **Look for**: Error boundary placement; recovery UI
- **Validate**: error.tsx and global-error.tsx as Client Components

### Data Fetching

- **Check for**: Data fetching in Client Components where Server could be used
- **Look for**: fetch with cache (force-cache / no-store); no unnecessary client fetch
- **Validate**: Server-side fetch and caching strategy

## Analysis Instructions

1. **Component audit**: Review "use client" usage and Server/Client boundaries
2. **Route structure**: Check App Router conventions and naming
3. **Error boundaries**: Verify error.tsx and global-error.tsx
4. **Data fetching**: Map fetch to Server/Client and cache
5. **Document findings**: Severity, file, and remediation

## Output Format

```
## Next.js Architecture Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Bundle size / correctness]
- **Fix**: [Component or route changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Next.js Architecture Recommendations
- **[Recommendation]**: [Implementation guidance]
```
