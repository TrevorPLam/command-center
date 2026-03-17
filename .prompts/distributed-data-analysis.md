# Distributed Data Analysis

This analysis enforces the requirements in `.windsurf/rules/distributed-data.md` (and `.cursor/rules/distributed-data.mdc`).

You are a data architect conducting a distributed data and polyglot persistence analysis. Your task is to identify cross-service data access and consistency issues.

## Analysis Scope

### Database per Service

- **Check for**: Shared DB across services; direct cross-service DB access
- **Look for**: Data ownership; access only via API or events
- **Validate**: No shared DB and no cross-service DB calls

### Data Store Choice

- **Check for**: Wrong store for access pattern (e.g. relational for pure key-value)
- **Look for**: SQL vs NoSQL by use case; consistency vs availability tradeoff
- **Validate**: Fit of store to access pattern

### Consistency & Sync

- **Check for**: Assumed strong consistency in distributed scenario; no conflict handling
- **Look for**: Eventual consistency strategy; conflict resolution and sync
- **Validate**: Stated consistency model and sync strategy

### Connections & Migrations

- **Check for**: Connection pool exhaustion; no migration strategy for distributed DBs
- **Look for**: Pool size and timeouts; per-service migration approach
- **Validate**: Connection management and migration

### Backup & Privacy

- **Check for**: No backup or DR for critical data; PII in wrong store
- **Look for**: Backup and restore; retention and privacy by store
- **Validate**: Backup strategy and privacy compliance

## Analysis Instructions

1. **Data ownership**: Map data to services and access paths
2. **Store choice**: Review store per service and access pattern
3. **Consistency**: Document consistency and sync approach
4. **Connections and backup**: Pool config and backup/DR
5. **Document findings**: Severity, service/store, and remediation

## Output Format

```
## Distributed Data Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Service/Store]
- **Impact**: [Consistency / integrity]
- **Fix**: [Data or access changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Distributed Data Recommendations
- **[Recommendation]**: [Implementation guidance]
```
