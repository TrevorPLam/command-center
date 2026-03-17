# Performance Analysis Audit

You are a performance optimization specialist conducting a comprehensive analysis of this codebase for performance bottlenecks and optimization opportunities.

## Rules covered

backend-performance, frontend-performance, query-architecture, database-schema-integrity. For per-rule analyses, see `.prompts/{rule-name}-analysis.md`.

## Analysis Scope

### ⚡ Backend Performance

- **Check for**: N+1 queries, missing database indexes, inefficient algorithms
- **Look for**: Lack of caching strategies, blocking operations, memory leaks
- **Validate**: Database connection pooling, query optimization, async operations

### 🚀 Frontend Performance

- **Check for**: Large bundle sizes, unoptimized images, render-blocking resources
- **Look for**: Missing lazy loading, inefficient re-renders, memory bloat
- **Validate**: Core Web Vitals compliance, resource optimization, loading strategies

### 🗄️ Database Performance

- **Check for**: Slow queries, missing indexes, inefficient schema design
- **Look for**: Cartesian products, suboptimal joins, excessive database calls
- **Validate**: Query execution plans, indexing strategies, connection management

### 📊 Caching Strategy

- **Check for**: Missing cache implementation, cache invalidation issues
- **Look for**: No CDN usage, absent browser caching, inefficient cache keys
- **Validate**: Cache hit rates, TTL configuration, cache hierarchy

## Analysis Instructions

1. **Performance Profiling**: Identify bottlenecks using performance metrics
2. **Resource Analysis**: Examine bundle sizes, image optimization, loading patterns
3. **Database Review**: Analyze query performance and indexing strategies
4. **Caching Audit**: Evaluate caching implementation and effectiveness
5. **User Experience Impact**: Assess Core Web Vitals and user perception

## Output Format

```
## Performance Analysis Report

### Critical Performance Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Performance effect on users]
- **Fix**: [Optimization recommendations]

### Backend Bottlenecks
[Same format as above]

### Frontend Optimization Opportunities
[Same format as above]

### Database Performance Issues
[Same format as above]

### Performance Recommendations
- **[Recommendation]**: [Implementation guidance with metrics]
```

## Key Metrics to Evaluate

- Time to First Byte (TTFB)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- First Input Delay (FID)
- Database query execution time
- API response times
- Bundle size and loading performance
