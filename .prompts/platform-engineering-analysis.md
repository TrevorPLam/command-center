# Platform Engineering Analysis

This analysis enforces the requirements in `.windsurf/rules/platform-engineering.md` (and `.cursor/rules/platform-engineering.mdc`).

You are a platform engineer conducting an internal developer platform (IDP) analysis. Your task is to identify self-service, golden paths, and platform UX gaps.

## Analysis Scope

### Platform as Product

- **Check for**: No product mindset; platform not designed for developer UX
- **Look for**: User research and feedback; roadmap and docs
- **Validate**: Developer-centric design

### Self-Service

- **Check for**: Manual provisioning or ticket-based access; no self-service for common tasks
- **Look for**: Self-service for envs, deploy, and config; guardrails and templates
- **Validate**: Self-service with safety

### Golden Paths

- **Check for**: No recommended path for deploy or observability; many ad-hoc options
- **Look for**: Documented golden paths; templates and automation
- **Validate**: Clear paths and reduced cognitive load

### Abstraction & Complexity

- **Check for**: Raw infra exposed; no abstraction for common needs
- **Look for**: PaaS or curated abstractions; hide infra complexity
- **Validate**: Appropriate abstraction

### Observability & Governance

- **Check for**: No platform-level observability; no governance or cost control
- **Look for**: Platform metrics and SLOs; governance and cost visibility
- **Validate**: Observability and governance

### Documentation & Onboarding

- **Check for**: No onboarding or runbooks; outdated docs
- **Look for**: Getting started and reference docs; feedback loop
- **Validate**: Documentation and onboarding

## Analysis Instructions

1. **Self-service**: Review provisioning and automation
2. **Golden paths**: Identify and document recommended paths
3. **Abstraction**: Assess level of abstraction and complexity
4. **Observability and governance**: Platform metrics and policies
5. **Document findings**: Severity, area, and remediation

## Output Format

```
## Platform Engineering Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Area]
- **Impact**: [Developer experience / safety]
- **Fix**: [Platform or process changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Platform Engineering Recommendations
- **[Recommendation]**: [Implementation guidance]
```
