# API Security Analysis

This analysis enforces the requirements in `.windsurf/rules/api-security.md` (and `.cursor/rules/api-security.mdc`).

You are a security analyst conducting an API security and rate-limiting analysis. Your task is to identify API-level vulnerabilities and missing protections.

## Analysis Scope

### Rate Limiting

- **Check for**: Endpoints without rate limiting; no user-specific or endpoint-specific limits
- **Look for**: Brute-force or abuse potential; missing throttling on auth and sensitive endpoints
- **Validate**: Per-user and per-endpoint limits and backoff

### API Key & Auth

- **Check for**: API keys in code or logs; missing rotation or revocation
- **Look for**: Keys with excessive scope; no expiration or rotation policy
- **Validate**: Secure storage, rotation, and least-privilege scopes

### Request Validation

- **Check for**: Requests not validated with schemas; mass assignment or parameter pollution
- **Look for**: Missing size limits; malformed payloads causing errors or DoS
- **Validate**: Schema validation and allowlists for all inputs

### CORS & WAF

- **Check for**: Overly permissive CORS origins or methods; credentials with wildcard
- **Look for**: Missing WAF or attack-pattern rules; insufficient logging of suspicious requests
- **Validate**: Specific CORS config and security logging

### API Versioning & Discovery

- **Check for**: Breaking changes without versioning; no OpenAPI/Swagger or discovery
- **Look for**: Deprecated endpoints still exposed; version in path or header
- **Validate**: Versioning strategy and documentation

### Logging & Monitoring

- **Check for**: No request/response logging for security review; sensitive data in logs
- **Look for**: Missing audit trail for auth failures and privileged actions
- **Validate**: Security-relevant logging without PII where not needed

## Analysis Instructions

1. **Endpoint inventory**: List all API routes and auth requirements
2. **Rate limit audit**: Verify limits on auth, write, and expensive endpoints
3. **Validation review**: Check schema validation and input handling
4. **CORS and headers**: Review CORS and security headers on API responses
5. **Document findings**: Severity, endpoint, and remediation

## Output Format

```
## API Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Endpoint]
- **Impact**: [Security risk]
- **Fix**: [Remediation steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### API Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```
