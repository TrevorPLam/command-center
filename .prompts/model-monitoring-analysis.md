# Model Monitoring Analysis

This analysis enforces the requirements in `.windsurf/rules/model-monitoring.md` (and `.cursor/rules/model-monitoring.mdc`).

You are an MLOps specialist conducting a model performance and explainability monitoring analysis. Your task is to identify drift, bias, and alerting gaps.

## Analysis Scope

### Performance Metrics

- **Check for**: No accuracy/precision/recall/F1 monitoring in production
- **Look for**: Metrics over time; segment-level performance; degradation alerts
- **Validate**: Performance monitoring and alerting

### Data Drift

- **Check for**: No data drift detection; no statistical or visual checks
- **Look for**: Drift tests and dashboards; alerting on significant drift
- **Validate**: Data drift detection and response

### Explainability

- **Check for**: No explainability (SHAP, LIME, etc.) for interpretability or compliance
- **Look for**: Explainability for high-stakes decisions; documentation
- **Validate**: Explainability where required

### Bias & Fairness

- **Check for**: No bias or fairness monitoring across protected attributes
- **Look for**: Fairness metrics and monitoring; mitigation and documentation
- **Validate**: Bias and fairness monitoring

### Anomaly & Alerts

- **Check for**: No anomaly detection for predictions or inputs; no incident response
- **Look for**: Anomaly detection and alerting; runbooks for model degradation
- **Validate**: Anomaly detection and response

### Cost & Feedback

- **Check for**: No cost monitoring for inference; no user feedback loop
- **Look for**: Inference cost and usage; feedback collection and model improvement
- **Validate**: Cost and feedback loops

## Analysis Instructions

1. **Performance**: Metrics and degradation detection
2. **Drift and explainability**: Data drift and explainability
3. **Bias and anomaly**: Fairness and anomaly detection
4. **Alerts and feedback**: Alerting and feedback loops
5. **Document findings**: Severity, model/component, and remediation

## Output Format

```
## Model Monitoring Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Model/Component]
- **Impact**: [Correctness / fairness / compliance]
- **Fix**: [Monitoring or model changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Model Monitoring Recommendations
- **[Recommendation]**: [Implementation guidance]
```
