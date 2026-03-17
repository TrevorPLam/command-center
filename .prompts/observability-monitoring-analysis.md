# Observability & Monitoring Analysis

This analysis enforces the requirements in `.windsurf/rules/observability-monitoring.md` (and `.cursor/rules/observability-monitoring.mdc`).

You are an SRE conducting an observability (logs, metrics, traces) analysis. Your task is to identify gaps in structured logging, metrics, and distributed tracing.

## Analysis Scope

### Structured Logging & Correlation

- **Check for**: Unstructured or ad-hoc logs; no correlation IDs across services
- **Look for**: Structured format (JSON); trace ID / correlation ID in logs
- **Validate**: Logs queryable and traceable across services

### OpenTelemetry & Instrumentation

- **Check for**: No automatic or manual instrumentation; no metrics/traces
- **Look for**: OTel SDK; spans for API and DB; metrics for key operations
- **Validate**: Traces and metrics from critical paths

### KPIs & SLOs

- **Check for**: No defined KPIs or SLOs; no error budget or target
- **Look for**: Latency and availability SLOs; dashboards and burn rate
- **Validate**: SLO definition and monitoring

### Error Tracking & Impact

- **Check for**: No error context or user impact; no stack trace aggregation
- **Look for**: Error grouping; impact assessment; linkage to traces
- **Validate**: Actionable error tracking

### Alerting & Escalation

- **Check for**: Missing or noisy alerts; no escalation or on-call
- **Look for**: Thresholds and runbooks; escalation policy
- **Validate**: Alert relevance and response path

### Dependencies & Circuit Breakers

- **Check for**: External calls not monitored; no circuit breaker or health
- **Look for**: Dependency metrics and circuit breaker config
- **Validate**: Resilience and dependency visibility

### Distributed Tracing

- **Check for**: No tracing for API or DB; broken or missing context propagation
- **Look for**: Span attributes and sampling; trace analysis
- **Validate**: End-to-end traceability

### Business Metrics & Log Retention

- **Check for**: No business metrics (conversion, feature use); no retention policy
- **Look for**: Product/analytics metrics in observability stack; retention and indexing
- **Validate**: Business visibility and retention compliance

## Analysis Instructions

1. **Logging review**: Structure, correlation IDs, and retention
2. **Metrics and traces**: OTel usage and coverage
3. **SLOs and alerts**: Definition and alerting
4. **Dependencies**: Circuit breakers and monitoring
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Observability & Monitoring Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Debugging / SRE]
- **Fix**: [Instrumentation or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Observability Recommendations
- **[Recommendation]**: [Implementation guidance]
```
