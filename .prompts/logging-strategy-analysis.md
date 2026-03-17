# Logging Strategy Analysis

This analysis enforces the requirements in `.windsurf/rules/logging-strategy.md` (and `.cursor/rules/logging-strategy.mdc`).

You are an SRE conducting a logging strategy and log management analysis. Your task is to identify inconsistent or unsafe logging practices.

## Analysis Scope

### Structure & Format

- **Check for**: Unstructured or free-text logs; no consistent format
- **Look for**: JSON or structured format; level, message, timestamp, context
- **Validate**: Machine-parseable and queryable logs

### Log Levels

- **Check for**: Wrong level usage (e.g. ERROR for info); no level consistency
- **Look for**: DEBUG vs INFO vs WARN vs ERROR usage; level in config
- **Validate**: Appropriate level per environment

### Sensitive Data

- **Check for**: Passwords, tokens, or PII in logs; stack traces with secrets
- **Look for**: Redaction or masking; no logging of full request bodies with secrets
- **Validate**: No sensitive data in log output

### Aggregation & Retention

- **Check for**: No log aggregation; logs only on host; no retention policy
- **Look for**: ELK, Loki, or cloud logging; retention and indexing
- **Validate**: Centralized logs and retention compliance

### Debug & Troubleshooting

- **Check for**: No debug logging where needed; excessive log volume in prod
- **Look for**: Correlation IDs; request-scoped context; debug toggle
- **Validate**: Troubleshooting support without log explosion

## Analysis Instructions

1. **Log format audit**: Check structure and level usage
2. **Sensitive data**: Search for secrets and PII in log paths
3. **Aggregation**: Review centralization and retention
4. **Debug usage**: Assess debug logging and volume
5. **Document findings**: Severity, file/component, and remediation

## Output Format

```
## Logging Strategy Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Component]
- **Impact**: [Security / debuggability]
- **Fix**: [Logging or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Logging Recommendations
- **[Recommendation]**: [Implementation guidance]
```
