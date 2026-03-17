# Microservices Architecture Analysis

This analysis enforces the requirements in `.windsurf/rules/microservices-architecture.md` (and `.cursor/rules/microservices-architecture.mdc`).

You are an architect conducting a microservices and DDD analysis. Your task is to identify service boundaries, coupling, and contract issues.

## Analysis Scope

### Service Decomposition & DDD

- **Check for**: Wrong service boundaries; no bounded context alignment
- **Look for**: Single responsibility per service; domain-driven boundaries
- **Validate**: Services aligned with business capabilities

### API-First & Contracts

- **Check for**: No OpenAPI or contract; ad-hoc or inconsistent APIs
- **Look for**: Contract-first design; consumer-driven or shared contracts
- **Validate**: Documented and versioned contracts

### Database per Service

- **Check for**: Shared database across services; cross-service DB access
- **Look for**: Data ownership per service; no direct DB access from other services
- **Validate**: Database per service and access via API/events

### Async & Messaging

- **Check for**: Synchronous coupling; no message broker for cross-service events
- **Look for**: Event-driven communication; durability and ordering where needed
- **Validate**: Async and messaging for decoupling

### Statelessness & State

- **Check for**: In-process state that breaks horizontal scaling
- **Look for**: Externalized state (DB, cache); stateless service design
- **Validate**: Stateless services and external state

### Discovery & Resilience

- **Check for**: Hardcoded service URLs; no discovery or health
- **Look for**: Service discovery; circuit breakers and retries
- **Validate**: Discovery and resilience patterns

### Deployability & Tracing

- **Check for**: Monolithic deploy or tight release coupling; no correlation IDs
- **Look for**: Independent deploy pipelines; distributed tracing
- **Validate**: Independent deployment and traceability

## Analysis Instructions

1. **Boundary review**: Map services to bounded contexts
2. **Contracts**: Check API and event contracts
3. **Data and messaging**: Verify DB per service and async usage
4. **Discovery and resilience**: Service discovery and circuit breakers
5. **Document findings**: Severity, service/area, and remediation

## Output Format

```
## Microservices Architecture Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Service/Area]
- **Impact**: [Coupling / scalability]
- **Fix**: [Architecture or contract changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Microservices Recommendations
- **[Recommendation]**: [Implementation guidance]
```
