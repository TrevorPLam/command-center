# Database Schema Integrity Analysis

This analysis enforces the requirements in `.windsurf/rules/database-schema-integrity.md` (and `.cursor/rules/database-schema-integrity.mdc`).

You are a database architect conducting a schema design and migration safety analysis. Your task is to identify schema risks and migration issues.

## Analysis Scope

### Migrations & Backward Compatibility

- **Check for**: Breaking migrations (drops, renames) without multi-step strategy; no rollback path
- **Look for**: Data loss risk; migrations that block or long-lock tables
- **Validate**: Backward-compatible migration patterns and rollback scripts

### Data Drift & Consistency

- **Check for**: Schema drift between environments; manual changes outside migrations
- **Look for**: Missing migration versioning or tracking; divergent schemas
- **Validate**: Single source of truth and migration history

### Referential Integrity

- **Check for**: Missing foreign keys; orphaned rows; inconsistent references
- **Look for**: Soft deletes without referential handling; cascade rules
- **Validate**: FK constraints and referential consistency

### Soft Delete & Critical Data

- **Check for**: Hard deletes on critical data; missing soft-delete or audit trail
- **Look for**: PII or compliance-sensitive tables without retention or purge policy
- **Validate**: Soft-delete and retention where required

### Connection Pooling & Serverless

- **Check for**: Connection exhaustion in serverless; no connection pooling or proxy
- **Look for**: Prisma or ORM config for serverless (connection limits, timeouts)
- **Validate**: Pool configuration and serverless best practices

### Prisma / ORM Configuration

- **Check for**: Unsafe or outdated Prisma config; missing indexes in schema
- **Look for**: Generator and datasource settings; migration workflow
- **Validate**: Schema quality and migration hygiene

## Analysis Instructions

1. **Migration review**: Audit migration history and backward compatibility
2. **Schema review**: Check FKs, indexes, and critical data handling
3. **Environment consistency**: Compare schema state across environments
4. **Pool and serverless**: Review connection and ORM config
5. **Document findings**: Severity, migration/schema location, and remediation

## Output Format

```
## Database Schema Integrity Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Migration/Schema]
- **Impact**: [Data integrity / availability risk]
- **Fix**: [Migration or schema changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Schema & Migration Recommendations
- **[Recommendation]**: [Implementation guidance]
```
