# API & Backend Standards Analysis

You are a backend development specialist conducting a comprehensive API design and implementation analysis focusing on standards compliance and best practices.

## Rules covered

api-standards, api-security, query-architecture, background-jobs, database-schema-integrity. For per-rule analyses, see `.prompts/{rule-name}-analysis.md`.

## Analysis Scope

### 🌐 REST API Standards

- **Check for**: Improper HTTP method usage, inconsistent response formats
- **Look for**: Missing status codes, no pagination, poor error handling
- **Validate**: API versioning, backward compatibility, endpoint naming conventions

### 🔐 API Security Implementation

- **Check for**: Missing authentication, inadequate rate limiting, exposed endpoints
- **Look for**: Insecure API key handling, missing request validation, poor CORS configuration
- **Validate**: Authorization patterns, input validation, security headers

### 📊 Database Query Architecture

- **Check for**: N+1 query problems, missing database indexes, inefficient queries
- **Look for**: Cartesian products, suboptimal joins, connection pool issues
- **Validate**: Query optimization, caching strategies, transaction management

### ⚡ Background Job Processing

- **Check for**: Missing queue implementation, improper error handling
- **Look for**: No retry logic, dead letter queue issues, idempotency problems
- **Validate**: Job scheduling, monitoring, failure recovery mechanisms

### 🔄 API Design Patterns

- **Check for**: Inconsistent data models, poor error responses
- **Look for**: Missing envelope formats, inadequate pagination, no versioning
- **Validate**: OpenAPI documentation, response consistency, request validation

## Analysis Instructions

1. **API Design Review**: Evaluate REST API compliance and design patterns
2. **Security Assessment**: Analyze authentication, authorization, and validation
3. **Database Analysis**: Review query performance and data access patterns
4. **Background Processing**: Assess job queue implementation and reliability
5. **Documentation Review**: Evaluate API documentation and developer experience

## Output Format

```
## API & Backend Analysis Report

### API Standards Violations
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Developer experience/Reliability effect]
- **Fix**: [Standards compliance steps]

### Security Implementation Issues
[Same format as above]

### Database Performance Issues
[Same format as above]

### Background Job Processing Issues
[Same format as above]

### API Design Recommendations
- **[Recommendation]**: [Implementation guidance]
```

## Key Standards to Validate

- HTTP method compliance (GET, POST, PUT, DELETE)
- Standard JSON envelope responses ({ data, error, meta })
- Appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Pagination implementation for collections
- API versioning strategies
- Request/response validation
- Error handling consistency
- Rate limiting implementation
