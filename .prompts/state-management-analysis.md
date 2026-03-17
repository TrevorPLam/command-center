# State Management Analysis

This analysis enforces the requirements in `.windsurf/rules/state-management.md` (and `.cursor/rules/state-management.mdc`).

You are a frontend architect conducting a client-side state management analysis. Your task is to identify inappropriate or fragile state patterns.

## Analysis Scope

### Library & Pattern Choice

- **Check for**: Wrong tool for the problem (global store for local state, etc.)
- **Look for**: Consistent pattern (Context, Zustand, Redux, etc.); server state vs client state
- **Validate**: Fit for purpose and team consistency

### Component vs Global State

- **Check for**: Global state for UI that could be local; prop drilling vs over-globalization
- **Look for**: Colocation of state; server state in React Query or similar
- **Validate**: Minimal global state; clear ownership

### Synchronization

- **Check for**: Stale client state after server updates; no invalidation or refetch
- **Look for**: Optimistic updates; cache invalidation strategy
- **Validate**: Server and client state consistency

### Performance

- **Check for**: Broad subscriptions causing unnecessary re-renders; missing selectors or split
- **Look for**: Memoization and subscription granularity
- **Validate**: Render cost and subscription scope

### Debugging & DevEx

- **Check for**: No devtools or traceability for state changes
- **Look for**: Time-travel or logging; predictable update paths
- **Validate**: Debuggability and maintainability

## Analysis Instructions

1. **State map**: Identify global vs local and server vs client state
2. **Pattern review**: Check consistency and fit (library, placement)
3. **Sync and invalidation**: Review server/client sync and cache behavior
4. **Performance**: Check subscriptions and re-renders
5. **Document findings**: Severity, component/store, and remediation

## Output Format

```
## State Management Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Component]
- **Impact**: [Correctness / performance]
- **Fix**: [State structure or library usage]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### State Management Recommendations
- **[Recommendation]**: [Implementation guidance]
```
