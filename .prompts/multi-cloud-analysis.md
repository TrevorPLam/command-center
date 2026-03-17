# Multi-Cloud Analysis

This analysis enforces the requirements in `.windsurf/rules/multi-cloud.md` (and `.cursor/rules/multi-cloud.mdc`).

You are a cloud architect conducting a multi-cloud and vendor lock-in analysis. Your task is to identify coupling, consistency, and cost issues.

## Analysis Scope

### Vendor Lock-In

- **Check for**: Heavy use of provider-specific APIs or services without abstraction
- **Look for**: Cloud-agnostic or abstracted layers; multi-cloud capability
- **Validate**: Reduced lock-in and portability

### Networking & Connectivity

- **Check for**: No connectivity between clouds; inconsistent networking
- **Look for**: Inter-cloud networking; VPN or dedicated link; DNS and discovery
- **Validate**: Secure connectivity and discovery

### Data & Consistency

- **Check for**: Data siloed per cloud; no sync or consistency strategy
- **Look for**: Replication and sync; consistency model and conflict handling
- **Validate**: Data strategy across clouds

### Cost & Governance

- **Check for**: No cost visibility or optimization across clouds
- **Look for**: Unified cost view; governance and policy across providers
- **Validate**: Cost management and governance

### DR & Failover

- **Check for**: No cross-cloud DR or failover; single region or cloud
- **Look for**: Failover and RTO/RPO; runbooks and testing
- **Validate**: DR and failover strategy

### Security & Identity

- **Check for**: Inconsistent IAM or security across clouds
- **Look for**: Federated identity; consistent security controls
- **Validate**: Identity and security consistency

## Analysis Instructions

1. **Lock-in**: Review provider-specific usage and abstraction
2. **Networking**: Inter-cloud connectivity and discovery
3. **Data and cost**: Sync strategy and cost visibility
4. **DR and identity**: Failover and IAM
5. **Document findings**: Severity, area, and remediation

## Output Format

```
## Multi-Cloud Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Area]
- **Impact**: [Portability / cost / resilience]
- **Fix**: [Architecture or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Multi-Cloud Recommendations
- **[Recommendation]**: [Implementation guidance]
```
