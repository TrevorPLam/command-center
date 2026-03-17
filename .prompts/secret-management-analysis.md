# Secret Management Analysis

This analysis enforces the requirements in `.windsurf/rules/secret-management.md` (and `.cursor/rules/secret-management.mdc`).

You are a security specialist conducting a secrets handling and storage analysis. Your task is to identify exposed or mishandled secrets.

## Analysis Scope

### Storage & Access

- **Check for**: Secrets in code, env files, or config in repo; hardcoded keys
- **Look for**: Use of vault, managed secrets, or secure env injection
- **Validate**: No secrets in source; runtime injection

### Rotation

- **Check for**: No rotation policy; long-lived or permanent credentials
- **Look for**: Rotation for API keys, DB credentials, certs; automation
- **Validate**: Documented rotation and automation where possible

### Access Control

- **Check for**: Overly broad access to secret stores; no audit trail
- **Look for**: RBAC on secrets; least privilege; logging of access
- **Validate**: Minimal access and auditability

### Audit & Recovery

- **Check for**: No audit log for secret access or changes
- **Look for**: Backup and recovery for secret stores; incident procedure
- **Validate**: Audit trail and recovery plan

### Application Usage

- **Check for**: Logging or error messages that might expose secrets
- **Look for**: Secrets in client bundles or URLs; secure handling in memory
- **Validate**: No secret leakage in logs, errors, or client

## Analysis Instructions

1. **Secret inventory**: Find all secret types and storage locations
2. **Exposure check**: Search code and config for hardcoded or committed secrets
3. **Rotation and access**: Review rotation policy and access control
4. **Audit and recovery**: Check logging and recovery procedures
5. **Document findings**: Severity, location, and remediation

## Output Format

```
## Secret Management Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Location]
- **Impact**: [Security risk]
- **Fix**: [Remediation steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Secret Management Recommendations
- **[Recommendation]**: [Implementation guidance]
```
