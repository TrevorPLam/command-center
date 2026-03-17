# Zero Trust Network Analysis

This analysis enforces the requirements in `.windsurf/rules/zero-trust-network.md` (and `.cursor/rules/zero-trust-network.mdc`).

You are a security architect conducting a zero trust and micro-segmentation analysis. Your task is to identify trust assumptions and network segmentation gaps.

## Analysis Scope

### Zero Trust Principles

- **Check for**: Implicit trust (e.g. network location); no "never trust, always verify"
- **Look for**: Identity-based access; continuous verification; no default trust
- **Validate**: Zero trust principles applied

### Micro-Segmentation

- **Check for**: No segmentation or broad network policies; east-west traffic unrestricted
- **Look for**: Granular policies between services; least privilege network access
- **Validate**: Micro-segmentation and east-west control

### Identity & mTLS

- **Check for**: No identity-based access for network; no mTLS or mutual auth
- **Look for**: mTLS or equivalent; identity for every connection
- **Validate**: Identity-based access and encryption

### Monitoring & Anomaly

- **Check for**: No continuous monitoring or anomaly detection for network
- **Look for**: Traffic monitoring and anomaly detection; automated response
- **Validate**: Continuous monitoring and response

### Device & Session

- **Check for**: No device posture or compliance check; long-lived sessions
- **Look for**: Device posture assessment; short-lived tokens and re-auth
- **Validate**: Device and session management

## Analysis Instructions

1. **Trust model**: Identify implicit trust and verification points
2. **Segmentation**: Network policies and east-west traffic
3. **Identity and mTLS**: Identity-based access and encryption
4. **Monitoring and device**: Anomaly detection and device/session
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Zero Trust Network Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Security risk]
- **Fix**: [Network or policy changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Zero Trust Recommendations
- **[Recommendation]**: [Implementation guidance]
```
