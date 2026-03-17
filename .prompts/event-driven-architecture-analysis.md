# Event-Driven Architecture Analysis

This analysis enforces the requirements in `.windsurf/rules/event-driven-architecture.md` (and `.cursor/rules/event-driven-architecture.mdc`).

You are an architect conducting an event-driven and CQRS analysis. Your task is to identify event design, consistency, and broker usage issues.

## Analysis Scope

### Event Sourcing & Immutability

- **Check for**: Mutable event log; events that don’t capture full state change
- **Look for**: Append-only event store; event versioning and schema
- **Validate**: Immutable events and replayability

### CQRS Separation

- **Check for**: Command and query mixed in same model; no read model separation
- **Look for**: Command vs query handlers; eventual consistency acceptance
- **Validate**: Clear CQRS boundaries

### Event Content & Versioning

- **Check for**: Events missing data needed for replay; no version or schema evolution
- **Look for**: Event versioning; backward-compatible evolution
- **Validate**: Complete events and versioning strategy

### Broker & Durability

- **Check for**: No message broker or non-durable; no ordering where required
- **Look for**: Kafka, RabbitMQ, or equivalent; partitioning and ordering
- **Validate**: Durability and ordering guarantees

### Idempotency & DLQ

- **Check for**: Handlers not idempotent; no dead letter handling
- **Look for**: Idempotency keys; DLQ and retry
- **Validate**: Safe replay and failure handling

### Correlation & Consistency

- **Check for**: No correlation IDs; no causation tracking
- **Look for**: Correlation and causation in event metadata; eventual consistency strategy
- **Validate**: Traceability and consistency model

## Analysis Instructions

1. **Event design**: Review event schema and immutability
2. **CQRS**: Map command vs query and read models
3. **Broker**: Durability, ordering, and DLQ
4. **Idempotency and correlation**: Handler safety and tracing
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Event-Driven Architecture Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Consistency / replay]
- **Fix**: [Event or handler changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Event-Driven Recommendations
- **[Recommendation]**: [Implementation guidance]
```
