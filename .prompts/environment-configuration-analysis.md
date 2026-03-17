# Environment Configuration Analysis

This analysis enforces the requirements in `.windsurf/rules/environment-configuration.md` (and `.cursor/rules/environment-configuration.mdc`).

You are a DevOps specialist conducting an environment and configuration management analysis. Your task is to identify config drift and unsafe practices.

## Analysis Scope

### Environment Separation

- **Check for**: Shared config between dev and prod; env-specific values in code
- **Look for**: .env files committed; missing env validation at startup
- **Validate**: Clear env separation and no secrets in repo

### Secret Management

- **Check for**: Secrets in env files or code; no rotation or central store
- **Look for**: Use of vault or managed secrets; access control
- **Validate**: Secrets not in repo; rotation and least access

### Validation & Startup

- **Check for**: No config validation on boot; app starts with invalid config
- **Look for**: Schema validation (Zod or similar) for env; fail-fast
- **Validate**: Validated config and type-safe access

### Parity & Safety

- **Check for**: Dev/prod parity issues; different behavior by env
- **Look for**: Feature flags and env-specific toggles; config documentation
- **Validate**: Parity where needed and documented differences

### Type Safety

- **Check for**: Env vars read as strings without parsing or validation
- **Look for**: Typed config object; default values and required vars
- **Validate**: Single config module with types and validation

## Analysis Instructions

1. **Config inventory**: Map all env vars and config sources
2. **Secrets**: Verify no secrets in repo and use of secret store
3. **Validation**: Check startup validation and schema
4. **Parity**: Compare dev vs prod config and behavior
5. **Document findings**: Severity, location, and remediation

## Output Format

```
## Environment Configuration Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Config]
- **Impact**: [Security / correctness]
- **Fix**: [Configuration changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Configuration Recommendations
- **[Recommendation]**: [Implementation guidance]
```
