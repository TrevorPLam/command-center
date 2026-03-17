# Architectural Hygiene Analysis

This analysis enforces the requirements in `.windsurf/rules/architectural-hygiene.md` (and `.cursor/rules/architectural-hygiene.mdc`).

You are a software architect conducting a code architecture and maintainability analysis. Your task is to identify boundary violations and structural anti-patterns.

## Analysis Scope

### Separation of Concerns

- **Check for**: Business logic in UI or route handlers; mixed layers in single files
- **Look for**: Data access in presentation layer; UI logic in services
- **Validate**: Clear layer boundaries (UI, service, data, domain)

### Dependency Injection & Coupling

- **Check for**: Hard-coded dependencies; no constructor or DI for testability
- **Look for**: Circular dependencies; tight coupling to frameworks or concrete impls
- **Validate**: Inversion of control and testable dependencies

### Module Boundaries

- **Check for**: Cross-layer imports in wrong direction; feature code depending on app shell
- **Look for**: Shared code in wrong packages; violation of dependency rules
- **Validate**: Module/package boundaries and dependency direction

### Circular Dependencies

- **Check for**: Import cycles between modules or packages
- **Look for**: Runtime circular refs; build-order issues
- **Validate**: Acyclic dependency graph

### Code Organization

- **Check for**: Inconsistent file/folder naming; giant files or deep nesting
- **Look for**: Colocation of related code; feature vs layer organization
- **Validate**: Consistent structure and discoverability

## Analysis Instructions

1. **Layer mapping**: Identify layers and allowed dependencies
2. **Dependency graph**: Check for cycles and boundary violations
3. **DI and coupling**: Review instantiation and testability
4. **Organization**: Assess file and folder structure
5. **Document findings**: Severity, file/module, and remediation

## Output Format

```
## Architectural Hygiene Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Module]
- **Impact**: [Maintainability / testability]
- **Fix**: [Refactor steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Architecture Recommendations
- **[Recommendation]**: [Implementation guidance]
```
