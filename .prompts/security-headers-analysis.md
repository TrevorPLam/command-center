# Security Headers Analysis

This analysis enforces the requirements in `.windsurf/rules/security-headers.md` (and `.cursor/rules/security-headers.mdc`).

You are a security analyst conducting an HTTP security headers and CORS analysis. Your task is to identify missing or misconfigured security headers.

## Analysis Scope

### Content Security Policy (CSP)

- **Check for**: Missing or overly permissive CSP; `unsafe-inline` or `unsafe-eval` without nonce/hash
- **Look for**: Script and style sources too broad; missing frame-ancestors or default-src
- **Validate**: Strict whitelists; report-only vs enforced CSP

### Frame & Clickjacking

- **Check for**: Missing X-Frame-Options or CSP frame-ancestors
- **Look for**: Pages that may be embedded in malicious frames
- **Validate**: DENY or sameorigin as appropriate

### MIME & Content Type

- **Check for**: Missing X-Content-Type-Options: nosniff
- **Look for**: User-uploaded content served with executable MIME types
- **Validate**: Correct Content-Type for all responses

### Transport Security

- **Check for**: Missing Strict-Transport-Security (HSTS); low max-age or no includeSubDomains
- **Look for**: Mixed content; redirects from HTTPS to HTTP
- **Validate**: HSTS preload eligibility where applicable

### CORS

- **Check for**: CORS with wildcard origin in production; credentials with broad origin
- **Look for**: Missing or permissive Access-Control-Allow-\*; preflight handling
- **Validate**: Specific allowed origins and methods

### Referrer & Other Headers

- **Check for**: Missing or overly permissive Referrer-Policy
- **Look for**: Missing Permissions-Policy (feature policy); sensitive headers exposed
- **Validate**: Referrer-Policy and other privacy/security headers

## Analysis Instructions

1. **Header audit**: Capture and review all HTTP response headers from key routes
2. **CSP review**: Evaluate CSP directives and violation reports
3. **CORS review**: Test cross-origin requests and preflight
4. **HSTS and TLS**: Verify HSTS configuration and mixed content
5. **Document findings**: Severity, affected routes, and recommended header values

## Output Format

```
## Security Headers Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Route]
- **Impact**: [Security risk]
- **Fix**: [Header and configuration recommendations]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Security Headers Recommendations
- **[Recommendation]**: [Implementation guidance]
```
