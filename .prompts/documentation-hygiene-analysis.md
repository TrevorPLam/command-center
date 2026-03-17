# Documentation Hygiene Analysis

This analysis enforces the requirements in `.windsurf/rules/documentation-hygiene.md` (and `.cursor/rules/documentation-hygiene.mdc`).

You are a technical writer and engineer conducting a documentation quality and accuracy analysis. Your task is to identify outdated or missing documentation.

## Analysis Scope

### README & Onboarding

- **Check for**: Missing or empty README; no setup or run instructions
- **Look for**: Outdated env or install steps; no architecture overview
- **Validate**: README completeness and current accuracy

### Inline & Code Comments

- **Check for**: Comments that contradict code; dead code with misleading comments
- **Look for**: Missing comments for non-obvious logic; TODO without owner or ticket
- **Validate**: Comment accuracy and usefulness

### API Documentation

- **Check for**: No OpenAPI/JSDoc or equivalent; missing request/response examples
- **Look for**: Undocumented endpoints or parameters; wrong types in docs
- **Validate**: API docs match implementation and are up to date

### Comment Standards

- **Check for**: Commented-out code; noisy or redundant comments
- **Look for**: JSDoc on public APIs; explanation of why, not what
- **Validate**: Consistent comment style and purpose

### Documentation Process

- **Check for**: No process for updating docs on code change; docs not in version control
- **Look for**: Runbooks or ops docs missing or stale
- **Validate**: Docs as part of PR/release process

## Analysis Instructions

1. **README audit**: Check presence and accuracy of setup and overview
2. **API docs**: Compare docs to routes and types
3. **Inline review**: Sample comments for accuracy and value
4. **Process**: Assess how docs are updated with code
5. **Document findings**: Severity, location, and remediation

## Output Format

```
## Documentation Hygiene Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Location]
- **Impact**: [Onboarding / correctness risk]
- **Fix**: [Documentation updates]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Documentation Recommendations
- **[Recommendation]**: [Implementation guidance]
```
