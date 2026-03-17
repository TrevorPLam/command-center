# Backend Performance Analysis

This analysis enforces the requirements in `.windsurf/rules/backend-performance.md` (and `.cursor/rules/backend-performance.mdc`).

You are a performance specialist conducting a backend and server-side performance analysis. Your task is to identify latency and scalability bottlenecks.

## Analysis Scope

### Caching

- **Check for**: Missing Redis or application cache for repeated work; no cache for public/read-heavy endpoints
- **Look for**: Cache key design; cache invalidation on mutations; thundering herd
- **Validate**: Cache-Control headers and server-side cache usage

### Database & Queries

- **Check for**: N+1 queries; missing indexes; long-running or blocking queries
- **Look for**: Connection pool exhaustion; no query timeouts; large result sets
- **Validate**: Index usage, batching, and connection management

### External APIs & Timeouts

- **Check for**: Calls to external APIs without timeouts or circuit breakers
- **Look for**: Sequential external calls that could be parallel; no fallback on failure
- **Validate**: Timeouts, retries, and failure handling

### Async & Blocking

- **Check for**: Blocking I/O on hot paths; CPU-heavy work blocking event loop
- **Look for**: Missing async/await or offloading for heavy work
- **Validate**: Non-blocking patterns and worker usage where appropriate

### Deterministic Cache Keys

- **Check for**: Cache keys that vary by irrelevant data; cache poisoning or inefficiency
- **Look for**: User-specific vs shared cache scoping; key stability
- **Validate**: Cache key design and invalidation scope

## Analysis Instructions

1. **Identify hot paths**: Map critical request flows and dependencies
2. **Cache audit**: Review caching strategy and invalidation
3. **Query review**: Check N+1, indexes, and query timeouts
4. **External call review**: Timeouts, parallelism, and fallbacks
5. **Document findings**: Severity, file/line, and optimization steps

## Output Format

```
## Backend Performance Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Latency / scalability effect]
- **Fix**: [Optimization recommendations]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Backend Performance Recommendations
- **[Recommendation]**: [Implementation guidance with metrics]
```
