# API Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/api-standards.md` (and `.cursor/rules/api-standards.mdc`).

You are a backend specialist conducting a REST API design and standards analysis. Your task is to identify deviations from REST and API best practices.

## Analysis Scope

### HTTP Methods & Semantics

- **Check for**: Incorrect use of GET for mutations; POST used where PUT/PATCH/DELETE apply
- **Look for**: Non-idempotent GET; missing or wrong method for resource operations
- **Validate**: GET safe/idempotent; POST for create; PUT/PATCH for update; DELETE for remove

### Response Envelope & Status Codes

- **Check for**: Inconsistent response shape; missing standard envelope (e.g. { data, error, meta })
- **Look for**: Wrong status codes (e.g. 200 for errors); missing 201/204/400/401/403/404/500
- **Validate**: Consistent JSON envelope and appropriate status codes

### Pagination

- **Check for**: List endpoints without pagination; offset/limit or cursor consistency
- **Look for**: Missing total count or next-page info; unbounded list responses
- **Validate**: Pagination for all collection endpoints

### Versioning & Compatibility

- **Check for**: No versioning strategy; breaking changes without version
- **Look for**: Version in path vs header; deprecated endpoints and sunset headers
- **Validate**: Backward compatibility and deprecation policy

### Documentation

- **Check for**: Missing OpenAPI/Swagger or equivalent; outdated specs
- **Look for**: Examples and error response documentation
- **Validate**: API discovery and docs match implementation

## Analysis Instructions

1. **Route review**: Map routes to resources and HTTP methods
2. **Response audit**: Check envelope, status codes, and error format
3. **Pagination check**: Verify list endpoints are paginated
4. **Versioning review**: Document versioning approach and breaks
5. **Document findings**: Severity, endpoint, and recommended changes

## Output Format

```
## API Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Endpoint]
- **Impact**: [Developer experience / interoperability]
- **Fix**: [Standards compliance steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### API Standards Recommendations
- **[Recommendation]**: [Implementation guidance]
```
