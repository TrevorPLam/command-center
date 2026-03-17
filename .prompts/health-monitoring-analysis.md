# Health Monitoring Analysis

This analysis enforces the requirements in `.windsurf/rules/health-monitoring.md` (and `.cursor/rules/health-monitoring.mdc`).

You are an SRE conducting a health check and availability monitoring analysis. Your task is to identify missing or inadequate health and uptime monitoring.

## Analysis Scope

### Health Endpoints

- **Check for**: No /health or /ready endpoint; endpoint doesn’t reflect app state
- **Look for**: Liveness vs readiness; dependency checks (DB, cache, external)
- **Validate**: Health endpoints used by orchestrator and load balancer

### Performance Monitoring

- **Check for**: No APM or metrics; no latency/error rate visibility
- **Look for**: Instrumentation (OpenTelemetry, APM agent); key metrics
- **Validate**: Latency, errors, and throughput observed

### Error Tracking

- **Check for**: No error tracking (e.g. Sentry); unlogged or unaggregated errors
- **Look for**: Stack traces and context; grouping and alerting
- **Validate**: Errors captured and actionable

### Uptime Monitoring

- **Check for**: No external uptime checks; no SLA monitoring
- **Look for**: Synthetic checks; multi-region or external probes
- **Validate**: Uptime visibility and alerting

### Alerting & Thresholds

- **Check for**: No alerts or wrong thresholds; alert fatigue or missed incidents
- **Look for**: Critical path alerts; escalation and on-call
- **Validate**: Actionable alerting and runbooks

## Analysis Instructions

1. **Health audit**: Review health endpoints and dependency checks
2. **Metrics**: Check APM and custom metrics
3. **Errors**: Verify error tracking and aggregation
4. **Uptime and alerts**: Review synthetic checks and alert rules
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Health Monitoring Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Availability / observability]
- **Fix**: [Monitoring or endpoint changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Health Monitoring Recommendations
- **[Recommendation]**: [Implementation guidance]
```
