# Quantum Computing Readiness Analysis

This analysis enforces the requirements in `.windsurf/rules/quantum-computing.md` (and `.cursor/rules/quantum-computing.mdc`).

You are a security architect conducting a post-quantum cryptography and quantum readiness analysis. Your task is to identify classical crypto at risk and migration gaps.

## Analysis Scope

### Post-Quantum Cryptography

- **Check for**: Long-term sensitive data protected only by classical crypto (RSA, ECC)
- **Look for**: PQC algorithms (e.g. NIST PQC); migration plan and hybrid where needed
- **Validate**: PQC or migration plan for long-lived secrets

### Algorithm & Key Lifecycle

- **Check for**: No quantum algorithm selection or complexity analysis
- **Look for**: Algorithm choice and key lifecycle; key size and rotation
- **Validate**: Algorithm selection and key management

### Quantum Hardware & Hybrid

- **Check for**: No consideration of cloud quantum or hybrid workflows
- **Look for**: Quantum hardware integration; hybrid classical-quantum where applicable
- **Validate**: Quantum and hybrid strategy

### QKD & Threat Model

- **Check for**: No QKD or alternative for high-assurance channels; no quantum threat model
- **Look for**: QKD where appropriate; threat model including quantum
- **Validate**: Quantum threat model and high-assurance options

### Migration & Testing

- **Check for**: No migration plan or testing for PQC; no error mitigation strategy
- **Look for**: Migration timeline; testing and fallback; error mitigation for quantum
- **Validate**: Migration and testing plan

## Analysis Instructions

1. **Crypto inventory**: Identify long-lived secrets and algorithms
2. **PQC and migration**: PQC adoption and migration plan
3. **Quantum and hybrid**: Hardware and hybrid usage
4. **Threat model and QKD**: Quantum threat model and QKD
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Quantum Computing Readiness Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Future security risk]
- **Fix**: [PQC or migration steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Quantum Readiness Recommendations
- **[Recommendation]**: [Implementation guidance]
```
