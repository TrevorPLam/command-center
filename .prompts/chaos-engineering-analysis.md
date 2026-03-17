# Chaos Engineering Analysis

This analysis enforces the requirements in `.windsurf/rules/chaos-engineering.md` (and `.cursor/rules/chaos-engineering.mdc`).

You are an SRE conducting a chaos engineering and resilience testing analysis. Your task is to identify blast radius, experiment design, and learning gaps.

## Analysis Scope

### Experiment Design

- **Check for**: No chaos experiments; no hypothesis or steady-state metrics
- **Look for**: Hypothesis-driven experiments; defined steady state and success criteria
- **Validate**: Structured chaos experiments

### Environment & Blast Radius

- **Check for**: Chaos in production without controls; large blast radius
- **Look for**: Non-prod first; blast radius limits and safeguards
- **Validate**: Safe environment and blast radius

### Monitoring & Response

- **Check for**: No monitoring during chaos; no rollback or abort
- **Look for**: Alerting during experiments; automated or manual abort
- **Validate**: Visibility and control during chaos

### CI/CD Integration

- **Check for**: Chaos not in pipeline; no regular resilience testing
- **Look for**: Automated chaos in CI or staging; game days
- **Validate**: Regular chaos and game days

### Documentation

- **Check for**: No record of experiments or results
- **Look for**: Runbooks and post-mortems; fault injection catalog
- **Validate**: Documented experiments and outcomes

## Analysis Instructions

1. **Experiment review**: Check for chaos experiments and hypotheses
2. **Blast radius**: Verify environment and scope controls
3. **Monitoring**: Alerting and abort during chaos
4. **Pipeline and docs**: Automation and documentation
5. **Document findings**: Severity, area, and remediation

## Output Format

```
## Chaos Engineering Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Area]
- **Impact**: [Resilience / safety]
- **Fix**: [Experiment or process changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Chaos Engineering Recommendations
- **[Recommendation]**: [Implementation guidance]
```
