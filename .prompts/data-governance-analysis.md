# Data Governance Analysis

This analysis enforces the requirements in `.windsurf/rules/data-governance.md` (and `.cursor/rules/data-governance.mdc`).

You are a data governance specialist conducting a data catalog, lineage, and quality analysis. Your task is to identify catalog, lineage, and policy gaps.

## Analysis Scope

### Data Catalog & Metadata

- **Check for**: No data catalog or metadata; no business context
- **Look for**: Catalog with metadata and ownership; discoverability
- **Validate**: Catalog and metadata management

### Lineage

- **Check for**: No lineage; can’t trace data flow end-to-end
- **Look for**: Lineage tracking and visualization; upstream/downstream
- **Validate**: Lineage coverage and accuracy

### Data Quality

- **Check for**: No data quality rules or monitoring; no validation
- **Look for**: Quality rules and monitoring; dashboards and alerts
- **Validate**: Data quality monitoring and rules

### Classification & Retention

- **Check for**: No sensitivity classification; no retention policy
- **Look for**: Classification and labeling; retention and automated deletion
- **Validate**: Classification and retention

### Access & Privacy

- **Check for**: No RBAC on data; no privacy controls
- **Look for**: Data access controls; GDPR/CCPA alignment
- **Validate**: Access control and privacy

### Stewardship & Policy

- **Check for**: No data stewardship or ownership; no governance policy
- **Look for**: Stewards and owners; policy and enforcement
- **Validate**: Stewardship and governance policy

## Analysis Instructions

1. **Catalog and lineage**: Catalog coverage and lineage
2. **Quality**: Rules and monitoring
3. **Classification and retention**: Labels and retention
4. **Access and stewardship**: RBAC and ownership
5. **Document findings**: Severity, dataset/area, and remediation

## Output Format

```
## Data Governance Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Dataset/Area]
- **Impact**: [Quality / compliance]
- **Fix**: [Catalog / policy changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Data Governance Recommendations
- **[Recommendation]**: [Implementation guidance]
```
