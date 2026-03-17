# TypeScript Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/typescript-standards.md` (and `.cursor/rules/typescript-standards.mdc`).

You are a TypeScript specialist conducting a type safety and strictness analysis. Your task is to identify `any` usage, weak typing, and error-handling gaps.

## Analysis Scope

### Strictness & Any

- **Check for**: Explicit or implicit `any`; disabled strict options (strictNullChecks, etc.)
- **Look for**: Type assertions instead of validation; `as unknown as T` without guards
- **Validate**: Strict mode and no-any policy; Zod or validation for boundaries

### Null Safety

- **Check for**: Unchecked null/undefined access; missing optional chaining
- **Look for**: Non-null assertions without guarantees; optional props not handled
- **Validate**: Optional chaining and nullish coalescing; defensive checks

### Error Boundaries & Promises

- **Check for**: Unhandled promise rejections; missing error boundaries in React
- **Look for**: Swallowed errors; floating promises; no try/catch in async paths
- **Validate**: Error boundaries for UI; promise handling and logging

### Runtime Validation

- **Check for**: Trust of external data without Zod or schema validation
- **Look for**: Type assertions on API responses or config; no runtime checks
- **Validate**: Validate at boundaries; use inferred types from schemas

### Code Quality

- **Check for**: Disabled ESLint rules for TypeScript; inconsistent typing style
- **Look for**: Redundant types; missing return types on public APIs
- **Validate**: ESLint/TypeScript config and team conventions

## Analysis Instructions

1. **Config review**: Check tsconfig strict options and no-any rules
2. **Any and assertions**: Search for `any` and unsafe casts
3. **Null and async**: Review null handling and promise/async patterns
4. **Error handling**: Check error boundaries and catch blocks
5. **Document findings**: Severity, file/line, and remediation

## Output Format

```
## TypeScript Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Type safety / runtime risk]
- **Fix**: [Typing or validation steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### TypeScript Recommendations
- **[Recommendation]**: [Implementation guidance]
```
