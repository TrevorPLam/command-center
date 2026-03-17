# Analytics Tracking Analysis

This analysis enforces the requirements in `.windsurf/rules/analytics-tracking.md` (and `.cursor/rules/analytics-tracking.mdc`).

You are an analytics specialist conducting an event tracking and measurement analysis. Your task is to identify missing or incorrect analytics implementation.

## Analysis Scope

### Event Tracking

- **Check for**: Key actions (signup, purchase, etc.) not tracked; inconsistent event names or properties
- **Look for**: Event taxonomy; required vs optional properties; client vs server events
- **Validate**: Critical events tracked with consistent schema

### Funnel & Conversion

- **Check for**: Funnel steps not defined or not tracked; no conversion attribution
- **Look for**: Funnel analytics setup; step ordering and drop-off visibility
- **Validate**: Funnel coverage and conversion metrics

### UTM & Campaign

- **Check for**: UTM parameters not captured or not passed through; broken attribution
- **Look for**: UTM in URLs and storage; campaign reporting
- **Validate**: Campaign and source attribution

### Privacy & Compliance

- **Check for**: PII in event payloads; no consent or opt-out for tracking
- **Look for**: GDPR/CCPA handling; cookie consent and analytics scope
- **Validate**: Privacy-compliant tracking and consent

### Dashboards & Reporting

- **Check for**: No dashboards for key metrics; raw data only
- **Look for**: Business intelligence setup; alerts and trends
- **Validate**: Actionable reporting and visibility

## Analysis Instructions

1. **Event inventory**: List key actions and verify tracking
2. **Funnel review**: Map funnel steps and conversion tracking
3. **UTM and attribution**: Check capture and reporting
4. **Privacy**: Verify consent and PII handling
5. **Document findings**: Severity, event/area, and remediation

## Output Format

```
## Analytics Tracking Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Event/Area]
- **Impact**: [Measurement / compliance]
- **Fix**: [Tracking or schema changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Analytics Recommendations
- **[Recommendation]**: [Implementation guidance]
```
