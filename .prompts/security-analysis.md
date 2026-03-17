# Codebase Security Analysis

You are a security analyst conducting a comprehensive security audit of this codebase. Your task is to identify security vulnerabilities and violations of security standards.

## Rules covered

auth-standards, input-validation, api-security, security-headers, upload-security, secret-management, nextjs-security, supply-chain-security, ai-agent-security, llm-integration. For per-rule analyses, see `.prompts/{rule-name}-analysis.md`.

## Analysis Scope

### 🔒 Authentication & Authorization

- **Check for**: Unprotected routes, missing authentication middleware, improper role-based access control
- **Look for**: Direct database access without user verification, admin endpoints without proper authorization
- **Validate**: JWT token handling, session security, OAuth implementation security

### 🛡️ Input Validation & XSS Prevention

- **Check for**: Unsanitized user inputs, missing schema validation, XSS vulnerabilities
- **Look for**: Direct HTML rendering, unsafe innerHTML usage, missing content security policy
- **Validate**: File upload security, parameterized queries, input sanitization libraries

### 🔐 API Security

- **Check for**: Missing rate limiting, insecure API endpoints, exposed sensitive data
- **Look for**: Hardcoded API keys, missing CORS configuration, inadequate error handling
- **Validate**: Request/response validation, API versioning security, authentication mechanisms

### 📋 HTTP Security Headers

- **Check for**: Missing security headers, insecure cookie configurations
- **Look for**: Absence of CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Validate**: CORS policies, referrer policies, transport security

### 🗂️ File Upload Security

- **Check for**: Unrestricted file uploads, missing file type validation
- **Look for**: Direct file system access, missing malware scanning, predictable filenames
- **Validate**: File magic number validation, secure storage paths, access controls

## Analysis Instructions

1. **Systematic Review**: Examine each security domain thoroughly
2. **Evidence Collection**: Document specific file locations and code snippets
3. **Risk Assessment**: Rate findings as Critical/High/Medium/Low
4. **Remediation**: Provide specific fix recommendations for each issue
5. **Pattern Recognition**: Identify recurring security anti-patterns

## Output Format

```
## Security Vulnerability Report

### Critical Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Security risk]
- **Fix**: [Specific remediation steps]

### High Priority Issues
[Same format as above]

### Medium Priority Issues
[Same format as above]

### Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```

## Focus Areas

- Authentication bypass vulnerabilities
- Data exposure risks
- Injection vulnerabilities (SQL, XSS, command)
- Insecure direct object references
- Security misconfigurations
- Sensitive data leakage
