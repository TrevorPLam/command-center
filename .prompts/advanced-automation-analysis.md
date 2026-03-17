# Advanced Automation & Autonomous Systems Analysis

This analysis enforces the requirements in `.windsurf/rules/advanced-automation.md` (and `.cursor/rules/advanced-automation.mdc`).

You are a robotics/autonomy specialist conducting an autonomous system and automation analysis. Your task is to identify safety, human-in-the-loop, and ethics gaps.

## Analysis Scope

### Autonomous Decision-Making

- **Check for**: No ethical or safety constraints on autonomous decisions
- **Look for**: Ethical framework and safety boundaries; explainable decisions
- **Validate**: Bounded autonomy and ethics

### Human-in-the-Loop

- **Check for**: No override or human approval for high-risk actions
- **Look for**: Override mechanism; approval flow for critical decisions; monitoring
- **Validate**: Human-in-the-loop and override

### Perception & Sensors

- **Check for**: No sensor fusion or environment model; single sensor dependency
- **Look for**: Multi-sensor fusion; environment representation; update rate
- **Validate**: Perception and fusion

### Fail-Safe & Emergency

- **Check for**: No emergency stop or fail-safe; no defined recovery
- **Look for**: Emergency stop; fail-safe mode; recovery procedures
- **Validate**: Fail-safe and emergency procedures

### Explainability & Learning

- **Check for**: No explainability for autonomous decisions; unsafe exploration
- **Look for**: Explainable AI; safe exploration in learning; continuous learning guardrails
- **Validate**: Explainability and safe learning

### Multi-Agent & Resilience

- **Check for**: No coordination protocol; no graceful degradation
- **Look for**: Multi-agent coordination and communication; resilience and degradation
- **Validate**: Coordination and resilience

### Security & Compliance

- **Check for**: No cyber hardening for autonomous systems; no regulatory consideration
- **Look for**: Adversarial robustness; compliance and certification path
- **Validate**: Security and compliance

## Analysis Instructions

1. **Decision and ethics**: Autonomy bounds and ethical framework
2. **Human-in-the-loop**: Override and approval flows
3. **Perception and fail-safe**: Sensors and emergency procedures
4. **Explainability and multi-agent**: Explainability and coordination
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Advanced Automation Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Safety / compliance]
- **Fix**: [Process or system changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Advanced Automation Recommendations
- **[Recommendation]**: [Implementation guidance]
```
