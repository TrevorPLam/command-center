# Event Sourcing Analysis

This analysis enforces the requirements in `.windsurf/rules/event-sourcing.md` (and `.cursor/rules/event-sourcing.mdc`).

You are an architect conducting an event sourcing and CQRS implementation analysis. Your task is to identify event design, storage, and replay issues.

## Analysis Scope

### Event Log & Immutability

- **Check for**: Mutable or deletable event log; events that don’t capture full change
- **Look for**: Append-only store; event content sufficient for replay
- **Validate**: Immutable, complete events

### Versioning & Schema

- **Check for**: No event versioning; breaking schema changes
- **Look for**: Version in events; backward-compatible evolution
- **Validate**: Versioning and schema evolution

### Storage & Durability

- **Check for**: Non-durable or non-ordered event store
- **Look for**: Durable append-only store; ordering guarantees
- **Validate**: Durability and ordering

### Snapshots & Replay

- **Check for**: No snapshot strategy; slow or impossible replay
- **Look for**: Snapshots for read model rebuild; replay and time-travel
- **Validate**: Snapshot and replay strategy

### Serialization & Metadata

- **Check for**: Breaking serialization changes; no correlation/causation
- **Look for**: Backward-compatible serialization; correlation and causation IDs
- **Validate**: Serialization and metadata

### GDPR & Deletion

- **Check for**: No strategy for event deletion or anonymization for GDPR
- **Look for**: Retention and right-to-erasure handling; sensitive data in events
- **Validate**: Compliance with deletion and retention

## Analysis Instructions

1. **Event design**: Review event content and immutability
2. **Storage**: Durability, ordering, and versioning
3. **Snapshots and replay**: Snapshot strategy and replay capability
4. **Serialization and GDPR**: Compatibility and deletion strategy
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Event Sourcing Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Replay / consistency]
- **Fix**: [Event or store changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Event Sourcing Recommendations
- **[Recommendation]**: [Implementation guidance]
```
