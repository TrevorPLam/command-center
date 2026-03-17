# Auth Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/auth-standards.md` (and `.cursor/rules/auth-standards.mdc`).

You are a security analyst conducting an authentication and authorization standards analysis. Your task is to identify auth/session vulnerabilities and RBAC violations.

## Analysis Scope

### Resource Ownership & User Data

- **Check for**: APIs that return or modify user data without verifying resource ownership
- **Look for**: Direct object references without ownership checks; admin endpoints without role checks
- **Validate**: User-scoped queries and mutations

### Role-Based Access Control

- **Check for**: Admin or privileged routes without role checks; missing permission enforcement
- **Look for**: Client-only role checks; role escalation paths
- **Validate**: Server-side enforcement of roles and permissions

### OAuth & External Auth

- **Check for**: OAuth flows without PKCE (public clients); missing state parameter validation
- **Look for**: Insecure redirect URIs; token storage in insecure locations
- **Validate**: Scope handling and token exchange security

### Sessions & Cookies

- **Check for**: Session cookies without HttpOnly, Secure, SameSite attributes
- **Look for**: Long-lived sessions; missing session invalidation on logout/password change
- **Validate**: CSRF protection and session fixation prevention

### JWT & Tokens

- **Check for**: Long-lived access tokens; missing token rotation or refresh flow
- **Look for**: JWTs in URLs or localStorage; weak signing or none algorithm
- **Validate**: Short-lived access tokens and secure refresh handling

### Account Linking & Verification

- **Check for**: Email/account linking without verification; missing email verification for sensitive actions
- **Look for**: Unverified identity binding; weak recovery flows
- **Validate**: Verification before linking or privilege changes

## Analysis Instructions

1. **Auth flow review**: Trace login, logout, refresh, and password flows
2. **Authorization audit**: Verify every protected route enforces ownership/role server-side
3. **Session and token review**: Check cookie and token configuration and storage
4. **OAuth/SSO review**: Validate PKCE, state, redirects, and scope
5. **Document findings**: Rate by risk; provide file/line and remediation

## Output Format

```
## Auth Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Security risk]
- **Fix**: [Remediation steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Auth Recommendations
- **[Recommendation]**: [Implementation guidance]
```
