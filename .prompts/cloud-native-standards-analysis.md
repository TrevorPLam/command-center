# Cloud Native Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/cloud-native-standards.md` (and `.cursor/rules/cloud-native-standards.mdc`).

You are a cloud native specialist conducting a Kubernetes and cloud deployment analysis. Your task is to identify resource, security, and operational gaps.

## Analysis Scope

### Resource Requests & Limits

- **Check for**: Containers without requests/limits; imbalance leading to over/under commit
- **Look for**: CPU and memory for every container; QoS class impact
- **Validate**: All workloads have requests and limits

### Health Checks

- **Check for**: Missing liveness or readiness probes; probes that don’t match app behavior
- **Look for**: Probe timing and failure thresholds; startup vs readiness
- **Validate**: Probes aligned with app lifecycle

### Image & Deployment

- **Check for**: Image tags without digest pinning; no rollback strategy
- **Look for**: Rolling update strategy; pod disruption budgets
- **Validate**: Reproducible images and safe rollout

### Secrets & Config

- **Check for**: Secrets in env as plain text; no Kubernetes Secrets or external store
- **Look for**: Secret rotation; RBAC on secrets; encryption at rest
- **Validate**: Secrets management and least access

### Network & Security Context

- **Check for**: No network policies; runAsNonRoot or readOnlyRootFilesystem not set
- **Look for**: Security context per pod/container; capability drops
- **Validate**: Network segmentation and pod security

### Replicas & Availability

- **Check for**: Single replica for production; no anti-affinity
- **Look for**: Replica count and PDB; spread across zones/nodes
- **Validate**: HA and disruption handling

### GitOps & IaC

- **Check for**: Manual cluster changes; manifests not in version control
- **Look for**: Declarative config; drift detection; audit trail
- **Validate**: GitOps or documented IaC

## Analysis Instructions

1. **Workload review**: Check resources, probes, and security context
2. **Secrets and config**: Verify secrets usage and RBAC
3. **Network and security**: Review network policies and pod security
4. **Availability**: Replicas, PDB, anti-affinity
5. **Document findings**: Severity, resource/file, and remediation

## Output Format

```
## Cloud Native Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Resource/File]
- **Impact**: [Availability / security]
- **Fix**: [Manifest or process changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Cloud Native Recommendations
- **[Recommendation]**: [Implementation guidance]
```
