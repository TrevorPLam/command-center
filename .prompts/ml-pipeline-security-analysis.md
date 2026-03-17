# ML Pipeline Security Analysis

This analysis enforces the requirements in `.windsurf/rules/ml-pipeline-security.md` (and `.cursor/rules/ml-pipeline-security.mdc`).

You are a security and ML specialist conducting an ML pipeline and model security analysis. Your task is to identify data poisoning, validation, and access gaps.

## Analysis Scope

### Data Poisoning

- **Check for**: No detection or mitigation for poisoned training data
- **Look for**: Data validation and anomaly detection; provenance
- **Validate**: Poisoning detection and mitigation

### Model Validation & Robustness

- **Check for**: No adversarial or robustness testing; no validation before deploy
- **Look for**: Adversarial testing; robustness checks; validation gate
- **Validate**: Model validation and robustness

### Inference Security

- **Check for**: Inference endpoint without input validation; no rate limit
- **Look for**: Input sanitization and validation; rate limiting and auth
- **Validate**: Secure inference API

### Model Integrity

- **Check for**: No integrity check or tamper detection for models
- **Look for**: Signing or checksum; tamper detection; secure storage
- **Validate**: Model integrity and tamper detection

### Access & Audit

- **Check for**: No access control for training or deploy; no audit log
- **Look for**: RBAC for pipeline and model; audit for training and deploy
- **Validate**: Access control and audit

### Privacy & Federated

- **Check for**: PII in training data; no differential privacy or federated safeguards
- **Look for**: Differential privacy; federated learning security; aggregation security
- **Validate**: Privacy and federated security

## Analysis Instructions

1. **Data and poisoning**: Data validation and poisoning mitigation
2. **Model validation**: Adversarial and robustness testing
3. **Inference and integrity**: Inference security and model integrity
4. **Access and privacy**: RBAC, audit, and privacy techniques
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## ML Pipeline Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Security / integrity]
- **Fix**: [Validation or access changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### ML Pipeline Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```
