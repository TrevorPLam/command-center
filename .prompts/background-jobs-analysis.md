# Background Jobs Analysis

This analysis enforces the requirements in `.windsurf/rules/background-jobs.md` (and `.cursor/rules/background-jobs.mdc`).

You are a backend specialist conducting a background job and queue architecture analysis. Your task is to identify reliability and operational gaps.

## Analysis Scope

### Queue Implementation

- **Check for**: No queue (e.g. setTimeout or fire-and-forget only); no persistence
- **Look for**: Redis or dedicated queue; job payload and metadata
- **Validate**: Durable queue and retry capability

### Retry & Backoff

- **Check for**: No retry or immediate retry without backoff
- **Look for**: Exponential backoff; max retries; jitter
- **Validate**: Retry policy and failure handling

### Dead Letter & Visibility

- **Check for**: Failed jobs discarded or stuck; no DLQ or visibility
- **Look for**: DLQ and alerting; inspection and replay
- **Validate**: No silent failure; operational visibility

### Async & Webhooks

- **Check for**: Webhooks or callbacks processed synchronously; blocking
- **Look for**: Async processing and idempotency for webhooks
- **Validate**: Non-blocking and idempotent handling

### Idempotency

- **Check for**: Jobs not idempotent; duplicate processing on retry
- **Look for**: Idempotency keys or natural idempotency; duplicate detection
- **Validate**: Safe retries and at-least-once semantics

## Analysis Instructions

1. **Job inventory**: List background jobs and triggers
2. **Queue and retry**: Review queue choice and retry/backoff
3. **Failure handling**: Check DLQ and monitoring
4. **Idempotency**: Verify idempotent handling and keys
5. **Document findings**: Severity, job/queue, and remediation

## Output Format

```
## Background Jobs Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Job]
- **Impact**: [Reliability / data integrity]
- **Fix**: [Queue or code changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Background Jobs Recommendations
- **[Recommendation]**: [Implementation guidance]
```
