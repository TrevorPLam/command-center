# Privacy-Enhancing Technologies Analysis

This analysis enforces the requirements in `.windsurf/rules/privacy-enhancing-tech.md` (and `.cursor/rules/privacy-enhancing-tech.mdc`).

You are a privacy engineer conducting a PETs (differential privacy, homomorphic encryption, etc.) analysis. Your task is to identify privacy and compliance gaps.

## Analysis Scope

### Differential Privacy

- **Check for**: No differential privacy where needed; no epsilon-delta or budget
- **Look for**: DP mechanisms and privacy budget; budget tracking and enforcement
- **Validate**: Differential privacy and budget

### Homomorphic & MPC

- **Check for**: Sensitive computation without encryption or secure MPC
- **Look for**: Homomorphic encryption or secure multi-party computation where appropriate
- **Validate**: Secure computation and PET usage

### Zero-Knowledge & Anonymization

- **Check for**: No ZK where verification without disclosure is needed; weak anonymization
- **Look for**: ZK proofs; anonymization and pseudonymization; data minimization
- **Validate**: ZK and anonymization where required

### Federated & Aggregation

- **Check for**: No secure aggregation for federated learning or analytics
- **Look for**: Secure aggregation; federated learning privacy; PII handling
- **Validate**: Federated and aggregation security

### Compliance

- **Check for**: GDPR/CCPA not addressed in data processing; no purpose limitation
- **Look for**: Privacy by design; minimization; compliance documentation
- **Validate**: Privacy compliance and documentation

## Analysis Instructions

1. **DP and budget**: Differential privacy and budget tracking
2. **Secure computation**: Homomorphic and MPC usage
3. **ZK and anonymization**: ZK proofs and anonymization
4. **Federated and compliance**: Secure aggregation and compliance
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Privacy-Enhancing Technologies Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Privacy / compliance]
- **Fix**: [PET or process changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### PET Recommendations
- **[Recommendation]**: [Implementation guidance]
```
