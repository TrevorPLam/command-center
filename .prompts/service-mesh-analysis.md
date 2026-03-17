# Service Mesh Analysis

This analysis enforces the requirements in `.windsurf/rules/service-mesh.md` (and `.cursor/rules/service-mesh.mdc`).

You are a platform engineer conducting a service mesh and traffic management analysis. Your task is to identify mTLS, traffic, and observability gaps.

## Analysis Scope

### Mesh Configuration

- **Check for**: No service mesh or inconsistent config; missing sidecar or proxy
- **Look for**: Traffic routing and splitting; canary and blue-green
- **Validate**: Mesh adoption and config consistency

### mTLS & Encryption

- **Check for**: Service-to-service traffic not encrypted; no mTLS
- **Look for**: Certificate management and rotation; trust domain
- **Validate**: mTLS for east-west traffic

### Traffic & Resilience

- **Check for**: No circuit breaker or retry policy; missing timeouts
- **Look for**: Retry and timeout config; outlier detection
- **Validate**: Resilience and failure handling

### Observability

- **Check for**: No distributed tracing or metrics from mesh
- **Look for**: Trace propagation; metrics for latency and errors
- **Validate**: Observability from mesh layer

### Access Control

- **Check for**: No service-to-service auth or authorization
- **Look for**: Identity and authorization policy; least privilege
- **Validate**: Access control between services

### Ingress & Egress

- **Check for**: No ingress gateway or insecure edge; egress not controlled
- **Look for**: Ingress/egress policy; TLS termination
- **Validate**: Gateway and egress control

## Analysis Instructions

1. **Mesh and mTLS**: Verify mesh deployment and mTLS
2. **Traffic policies**: Review retry, timeout, circuit breaker
3. **Observability**: Tracing and metrics from mesh
4. **Access and gateways**: Service auth and ingress/egress
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Service Mesh Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Security / reliability]
- **Fix**: [Mesh or policy changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Service Mesh Recommendations
- **[Recommendation]**: [Implementation guidance]
```
