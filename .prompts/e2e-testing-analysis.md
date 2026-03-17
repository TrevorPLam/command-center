# E2E Testing Analysis

This analysis enforces the requirements in `.windsurf/rules/e2e-testing.md` (and `.cursor/rules/e2e-testing.mdc`).

You are a QA engineer conducting an end-to-end testing and critical journey analysis. Your task is to identify E2E gaps and reliability issues.

## Analysis Scope

### Critical User Journeys

- **Check for**: Key flows (auth, signup, checkout, etc.) not covered by E2E
- **Look for**: Journey definition and prioritization; coverage map
- **Validate**: All critical paths have E2E coverage

### Test Environment

- **Check for**: E2E against prod or shared env; no dedicated test env
- **Look for**: Test data setup and teardown; env parity
- **Validate**: Isolated, repeatable test environment

### Browser & Compatibility

- **Check for**: Single browser only; no mobile or cross-browser matrix
- **Look for**: CI matrix (Chrome, Firefox, Safari, etc.); viewport coverage
- **Validate**: Coverage of supported browsers and viewports

### Performance in E2E

- **Check for**: No performance assertions in E2E; slow or time-sensitive flows untested
- **Look for**: Performance budgets or timing assertions; LCP/CLS in E2E
- **Validate**: Performance regression detection where applicable

### Visual & Flakiness

- **Check for**: No visual regression; flaky tests not fixed or quarantined
- **Look for**: Screenshot or visual diff; retries and stability
- **Validate**: Stable E2E and visual checks where needed

## Analysis Instructions

1. **Journey map**: List critical flows and E2E coverage
2. **Environment**: Review test env and data setup
3. **Browser matrix**: Check supported browsers and CI config
4. **Stability**: Identify flaky tests and root causes
5. **Document findings**: Severity, journey/test, and remediation

## Output Format

```
## E2E Testing Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Journey/Test]
- **Impact**: [Regression / coverage risk]
- **Fix**: [E2E or env changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### E2E Recommendations
- **[Recommendation]**: [Implementation guidance]
```
