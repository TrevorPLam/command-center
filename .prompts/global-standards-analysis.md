# Global Standards & International Compliance Analysis

This analysis enforces the requirements in `.windsurf/rules/global-standards.md` (and `.cursor/rules/global-standards.mdc`).

You are a compliance specialist conducting a global regulatory and international standards analysis. Your task is to identify GDPR, regional, and certification gaps.

## Analysis Scope

### GDPR

- **Check for**: No data subject rights; no privacy by design; no lawful basis
- **Look for**: Access, rectification, erasure, portability; consent and documentation
- **Validate**: GDPR compliance and documentation

### CCPA/CPRA & Regional

- **Check for**: No consumer privacy rights or opt-out; no regional compliance (LGPD, PIPL, PDPB)
- **Look for**: CCPA/CPRA rights; regional privacy laws; data localization
- **Validate**: Regional compliance coverage

### ISO 27001 & SOC 2

- **Check for**: No ISMS or control framework; no SOC 2 or equivalent
- **Look for**: ISO 27001 alignment; SOC 2 controls and attestation
- **Validate**: Security framework and attestation

### HIPAA & PCI DSS

- **Check for**: Healthcare data without HIPAA safeguards; card data without PCI DSS
- **Look for**: HIPAA BAA and safeguards; PCI DSS scope and controls
- **Validate**: HIPAA and PCI where in scope

### Accessibility & Environment

- **Check for**: No WCAG or Section 508; no environmental or carbon tracking where committed
- **Look for**: WCAG 2.1 AA; Section 508; carbon or environmental metrics
- **Validate**: Accessibility and environmental commitments

### International Transfer

- **Check for**: Cross-border transfer without adequacy or safeguards
- **Look for**: Adequacy decisions; SCCs or equivalent; transfer documentation
- **Validate**: International transfer compliance

## Analysis Instructions

1. **GDPR and regional**: Data subject rights and regional laws
2. **Certifications**: ISO 27001, SOC 2, HIPAA, PCI scope
3. **Accessibility and environment**: WCAG and environmental
4. **Transfer**: International transfer mechanism and docs
5. **Document findings**: Severity, area, and remediation

## Output Format

```
## Global Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Area]
- **Impact**: [Regulatory / legal risk]
- **Fix**: [Process or control changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Global Standards Recommendations
- **[Recommendation]**: [Implementation guidance]
```
