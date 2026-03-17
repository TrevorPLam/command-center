# Docker Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/docker-standards.md` (and `.cursor/rules/docker-standards.mdc`).

You are a containerization specialist conducting a Docker and image security analysis. Your task is to identify image and Dockerfile anti-patterns.

## Analysis Scope

### Base Images & Tags

- **Check for**: Use of `latest` or unversioned tags; large or non-minimal bases
- **Look for**: Digest pinning; distroless or minimal bases where appropriate
- **Validate**: Specific version tags and reproducible base

### Non-Root & Permissions

- **Check for**: Containers running as root; no USER directive
- **Look for**: File permissions in image; unnecessary capabilities
- **Validate**: Non-root user and least privilege

### Multi-Stage & Size

- **Check for**: Single-stage builds with build tools in final image; large image size
- **Look for**: Multi-stage to separate build and runtime; .dockerignore usage
- **Validate**: Small final image and build hygiene

### Health Checks

- **Check for**: No HEALTHCHECK; health check that doesn’t reflect app readiness
- **Look for**: Liveness vs readiness; health endpoint implementation
- **Validate**: HEALTHCHECK and orchestration alignment

### Secrets & Environment

- **Check for**: Hardcoded secrets in Dockerfile or image; secrets in env at build
- **Look for**: Runtime injection of secrets; use of build args for secrets
- **Validate**: No secrets in image; inject at run

### .dockerignore & Build

- **Check for**: Missing .dockerignore; context including node_modules or .git
- **Look for**: Unnecessary files in context; build cache efficiency
- **Validate**: Minimal context and faster builds

### Resource Limits

- **Check for**: No memory/CPU limits in compose or orchestration
- **Look for**: Limits and reservations; OOM and throttling behavior
- **Validate**: Resource limits in docker-compose or K8s

## Analysis Instructions

1. **Dockerfile review**: Base image, user, stages, and secrets
2. **Image size**: Multi-stage and .dockerignore
3. **Health and security**: HEALTHCHECK and non-root
4. **Compose/orchestration**: Resource limits and env
5. **Document findings**: Severity, file, and remediation

## Output Format

```
## Docker Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Dockerfile/Compose]
- **Impact**: [Security / reliability / size]
- **Fix**: [Configuration changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Docker Recommendations
- **[Recommendation]**: [Implementation guidance]
```
