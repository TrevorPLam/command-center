# Real-Time Security Analysis

This analysis enforces the requirements in `.windsurf/rules/real-time-security.md` (and `.cursor/rules/real-time-security.mdc`).

You are a security specialist conducting a real-time and streaming security analysis. Your task is to identify auth, encryption, and audit gaps in streaming pipelines.

## Analysis Scope

### Auth for Producers/Consumers

- **Check for**: No auth for stream producers or consumers; anonymous access
- **Look for**: Auth for publish and subscribe; ACLs and identity
- **Validate**: Auth on all stream access

### Encryption

- **Check for**: Sensitive stream data in plaintext; no TLS or encryption at rest
- **Look for**: TLS in transit; encryption at rest for sensitive topics
- **Validate**: Encryption for sensitive streams

### Input Validation

- **Check for**: Events not validated before processing; injection or malformed data
- **Look for**: Schema validation; sanitization at ingress
- **Validate**: Validation for all stream events

### Rate & Quota

- **Check for**: No rate limit or quota for producers; DoS or cost abuse
- **Look for**: Per-user or per-app quotas; throttling and alerts
- **Validate**: Rate and quota management

### Audit & Privacy

- **Check for**: No audit log for stream access or publish/subscribe
- **Look for**: PII in streams without need; audit for access and mutations
- **Validate**: Audit trail and PII handling

### Key Management

- **Check for**: Weak or shared keys for stream encryption; no rotation
- **Look for**: Key management and rotation; secure state for stream processors
- **Validate**: Key management and secure state

## Analysis Instructions

1. **Auth**: Verify producer and consumer authentication
2. **Encryption**: Transit and rest encryption for sensitive data
3. **Validation and rate**: Event validation and quotas
4. **Audit and keys**: Audit logging and key management
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Real-Time Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Security / compliance]
- **Fix**: [Auth or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Real-Time Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```
