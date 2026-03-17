# Streaming Architecture Analysis

This analysis enforces the requirements in `.windsurf/rules/streaming-architecture.md` (and `.cursor/rules/streaming-architecture.mdc`).

You are a data engineer conducting a streaming and real-time processing analysis. Your task is to identify backpressure, ordering, and durability gaps.

## Analysis Scope

### Stream Design & Event Sourcing

- **Check for**: No event sourcing or stream design for real-time flows
- **Look for**: Event sourcing where appropriate; stream topology and semantics
- **Validate**: Stream design and event semantics

### Broker & Durability

- **Check for**: Non-durable or non-ordered where required
- **Look for**: Kafka or equivalent; partitioning and ordering guarantees
- **Validate**: Durability and ordering

### Backpressure

- **Check for**: No backpressure; overload or dropped messages
- **Look for**: Flow control and backpressure handling; consumer lag monitoring
- **Validate**: Backpressure and lag handling

### Processing Semantics

- **Check for**: At-most-once where exactly-once needed; no idempotency
- **Look for**: Exactly-once or at-least-once with idempotency; windowing
- **Validate**: Processing semantics and windowing

### State & Monitoring

- **Check for**: No state management for stream processing; no monitoring
- **Look for**: State stores and checkpointing; metrics and alerting
- **Validate**: State and observability

### Security & Scaling

- **Check for**: Unencrypted streams; no scaling or partitioning strategy
- **Look for**: Encryption in transit; partition key and scaling
- **Validate**: Security and scalability

## Analysis Instructions

1. **Stream topology**: Map streams and processing stages
2. **Broker and semantics**: Durability, ordering, and processing guarantees
3. **Backpressure and state**: Flow control and state management
4. **Security and scaling**: Encryption and partitioning
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Streaming Architecture Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Correctness / reliability]
- **Fix**: [Stream or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Streaming Recommendations
- **[Recommendation]**: [Implementation guidance]
```
