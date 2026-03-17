# Query Architecture Analysis

This analysis enforces the requirements in `.windsurf/rules/query-architecture.md` (and `.cursor/rules/query-architecture.mdc`).

You are a database specialist conducting a query and data access architecture analysis. Your task is to identify N+1 queries, missing indexes, and inefficient patterns.

## Analysis Scope

### N+1 and Batching

- **Check for**: Loops that trigger one query per item; missing DataLoader or batch loading
- **Look for**: ORM usage without eager loading or join strategy; repeated same query in loop
- **Validate**: Batched or joined queries for list and relation loading

### Indexes & Execution Plans

- **Check for**: Queries on unindexed columns; full table scans on large tables
- **Look for**: Composite index alignment with filters and sorts; index usage in plans
- **Validate**: Index coverage for hot queries and filters

### Connection & Pooling

- **Check for**: Connection leaks; pool too small or too large for workload
- **Look for**: Serverless connection handling; long-held connections
- **Validate**: Pool size, timeouts, and serverless-friendly usage

### Caching of Results

- **Check for**: Repeated identical queries without caching; no cache layer for read-heavy data
- **Look for**: Cache key design; invalidation on writes
- **Validate**: Query result caching where appropriate

### Monitoring & Observability

- **Check for**: No slow-query logging or metrics; missing query performance visibility
- **Look for**: APM or DB metrics integration; alerting on degradation
- **Validate**: Query performance monitoring and alerting

## Analysis Instructions

1. **Trace data access**: Map API and service layer to queries
2. **N+1 detection**: Identify loops and single-item queries
3. **Index review**: Check filters and sorts against indexes
4. **Connection and pool review**: Verify pool config and leak risks
5. **Document findings**: Severity, file/line, query, and remediation

## Output Format

```
## Query Architecture Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Latency / scalability]
- **Fix**: [Query or schema changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Query Architecture Recommendations
- **[Recommendation]**: [Implementation guidance]
```
