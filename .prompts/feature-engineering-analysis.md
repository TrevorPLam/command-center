# Feature Engineering Analysis

This analysis enforces the requirements in `.windsurf/rules/feature-engineering.md` (and `.cursor/rules/feature-engineering.mdc`).

You are a data engineer conducting a feature store and feature pipeline analysis. Your task is to identify validation, versioning, and drift gaps.

## Analysis Scope

### Feature Validation & Schema

- **Check for**: Features without schema or validation; inconsistent types
- **Look for**: Feature schema enforcement; validation at compute and serve
- **Validate**: Validated features and schema

### Versioning & Compatibility

- **Check for**: No feature versioning; breaking changes without compatibility
- **Look for**: Feature version in store; backward compatibility in pipelines
- **Validate**: Versioning and compatibility

### Drift & Freshness

- **Check for**: No drift or freshness monitoring for features
- **Look for**: Drift detection; staleness and SLA for feature pipelines
- **Validate**: Drift and freshness monitoring

### Transformation & Lineage

- **Check for**: Inconsistent transforms between train and serve; no lineage
- **Look for**: Same transform code or contract; feature lineage and metadata
- **Validate**: Consistency and lineage

### Access & Privacy

- **Check for**: No access control on features; PII in feature store
- **Look for**: RBAC; data classification and privacy compliance
- **Validate**: Access control and privacy

### Quality & Documentation

- **Check for**: No feature quality metrics; no business context
- **Look for**: Quality metrics and monitoring; documentation and ownership
- **Validate**: Quality and documentation

## Analysis Instructions

1. **Schema and validation**: Feature schema and validation
2. **Versioning and drift**: Versioning and drift/freshness
3. **Transform and lineage**: Consistency and lineage
4. **Access and quality**: RBAC and quality metrics
5. **Document findings**: Severity, feature/pipeline, and remediation

## Output Format

```
## Feature Engineering Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Feature/Pipeline]
- **Impact**: [Correctness / reproducibility]
- **Fix**: [Schema or pipeline changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Feature Engineering Recommendations
- **[Recommendation]**: [Implementation guidance]
```
