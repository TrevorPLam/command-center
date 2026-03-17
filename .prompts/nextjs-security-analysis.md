# Next.js Security Analysis

This analysis enforces the requirements in `.windsurf/rules/nextjs-security.md` (and `.cursor/rules/nextjs-security.mdc`).

You are a security specialist conducting a Next.js-specific security analysis. Your task is to identify Server Actions, route, and serverless security issues.

## Analysis Scope

### Server Actions

- **Check for**: Server Actions without input validation; no CSRF or origin check
- **Look for**: Mutation actions validated and authorized; no sensitive data in client
- **Validate**: Validation, auth, and CSRF for Server Actions

### Route Protection

- **Check for**: Protected routes without middleware or server check; client-only guard
- **Look for**: Middleware or getServerSession for auth; redirect for unauthenticated
- **Validate**: Server-side route protection

### API Routes

- **Check for**: API routes without auth or rate limiting; sensitive logic in route handlers
- **Look for**: Request validation; CORS and security headers
- **Validate**: API route hardening

### Static & Assets

- **Check for**: Sensitive files in public; predictable static paths
- **Look for**: Asset optimization and integrity; no secrets in static
- **Validate**: Safe static and asset handling

### Serverless & Edge

- **Check for**: Cold start handling of secrets; oversized serverless payloads
- **Look for**: Edge vs Node runtime; env and timeout limits
- **Validate**: Serverless and edge security and limits

## Analysis Instructions

1. **Server Actions**: Review validation and auth on mutations
2. **Routes**: Check middleware and server-side protection
3. **API routes**: Auth, validation, and hardening
4. **Static and serverless**: Asset and runtime security
5. **Document findings**: Severity, file/route, and remediation

## Output Format

```
## Next.js Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Route]
- **Impact**: [Security risk]
- **Fix**: [Remediation steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Next.js Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```
