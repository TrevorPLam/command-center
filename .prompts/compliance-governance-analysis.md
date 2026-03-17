# Compliance & Governance Analysis

This analysis enforces the requirements in `.windsurf/rules/compliance-governance.md` (and `.cursor/rules/compliance-governance.mdc`).

You are a compliance specialist conducting a regulatory and governance analysis. Your task is to identify GDPR, accessibility, and policy gaps.

## Analysis Scope

### GDPR & Data Subject Rights

- **Check for**: No data subject access, rectification, or erasure flow; no consent record
- **Look for**: Consent management; retention and deletion; DPO process
- **Validate**: Data subject rights and consent

### Data Retention & Deletion

- **Check for**: No retention policy; no automated deletion of expired data
- **Look for**: Retention by data type; purge jobs and audit
- **Validate**: Defined retention and deletion

### Privacy by Design

- **Check for**: Data collection without purpose limitation; no minimization
- **Look for**: PIA for new features; default privacy-friendly settings
- **Validate**: Minimization and purpose limitation

### Audit Trail

- **Check for**: No audit log for data access or consent changes
- **Look for**: Logging of access, changes, and consent; retention of audit logs
- **Validate**: Auditability for compliance

### Cookie & Consent

- **Check for**: Non-essential cookies without consent; no ePrivacy/GDPR consent UI
- **Look for**: Consent banner and preferences; cookie list and purpose
- **Validate**: Cookie consent and documentation

### Data Residency & Cross-Border

- **Check for**: Cross-border transfer without adequacy or safeguards
- **Look for**: Data location and transfer mechanism; DPA and SCCs
- **Validate**: Residency and transfer compliance

### Incident & Accessibility

- **Check for**: No breach notification process; no WCAG or accessibility compliance
- **Look for**: Incident response and notification timeline; a11y testing
- **Validate**: Breach process and accessibility for public apps

## Analysis Instructions

1. **Rights and consent**: Review data subject rights and consent flows
2. **Retention and deletion**: Check policy and automation
3. **Audit and cookies**: Verify audit trail and consent UI
4. **Residency and incidents**: Transfer and breach process
5. **Document findings**: Severity, area, and remediation

## Output Format

```
## Compliance & Governance Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Area]
- **Impact**: [Regulatory / legal risk]
- **Fix**: [Process or system changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Compliance Recommendations
- **[Recommendation]**: [Implementation guidance]
```
