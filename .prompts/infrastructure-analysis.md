# Infrastructure & DevOps Analysis

You are a DevOps engineer conducting a comprehensive infrastructure and deployment analysis focusing on security, scalability, and operational excellence.

## Rules covered

docker-standards, cloud-native-standards, environment-configuration, secret-management, observability-monitoring, health-monitoring, logging-strategy, gitops-standards. For per-rule analyses, see `.prompts/{rule-name}-analysis.md`.

## Analysis Scope

### 🐳 Docker & Container Security

- **Check for**: Running containers as root, hardcoded secrets, vulnerable base images
- **Look for**: Missing health checks, improper resource limits, exposed ports
- **Validate**: Multi-stage builds, .dockerignore usage, security scanning integration

### ☁️ Cloud Native Configuration

- **Check for**: Missing resource limits, no health probes, insecure service exposure
- **Look for**: Hardcoded configurations, missing secrets management, no autoscaling
- **Validate**: Kubernetes best practices, service mesh configuration, network policies

### 🔒 Secret Management

- **Check for**: Hardcoded secrets in code, environment variable exposure
- **Look for**: Missing secret rotation, inadequate access controls, no audit trails
- **Validate**: Secret storage solutions, encryption at rest, access logging

### 📊 Monitoring & Observability

- **Check for**: Missing health endpoints, inadequate logging, no alerting
- **Look for**: Poor error tracking, missing metrics, no distributed tracing
- **Validate**: Structured logging, OpenTelemetry integration, SLA monitoring

### 🔄 CI/CD Pipeline Security

- **Check for**: Insecure pipeline configurations, missing vulnerability scans
- **Look for**: Hardcoded credentials, no code signing, inadequate approval processes
- **Validate**: GitOps implementation, progressive delivery, rollback mechanisms

## Analysis Instructions

1. **Container Security Review**: Analyze Docker configurations and security practices
2. **Infrastructure Assessment**: Evaluate cloud-native and Kubernetes implementations
3. **Secret Management Audit**: Review secret handling and security practices
4. **Observability Analysis**: Assess monitoring, logging, and alerting capabilities
5. **Pipeline Security**: Examine CI/CD security and deployment practices

## Output Format

```
## Infrastructure & DevOps Analysis Report

### Container Security Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Security/Operational risk]
- **Fix**: [Remediation steps]

### Infrastructure Configuration Issues
[Same format as above]

### Secret Management Vulnerabilities
[Same format as above]

### Monitoring & Observability Gaps
[Same format as above]

### CI/CD Pipeline Issues
[Same format as above]

### Infrastructure Recommendations
- **[Recommendation]**: [Implementation guidance]
```

## Key Areas to Evaluate

- Container image security
- Resource allocation and limits
- Health check implementation
- Secret management practices
- Monitoring and alerting coverage
- Disaster recovery capabilities
- Scalability configuration
- Network security policies
- Backup and retention strategies
