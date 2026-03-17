# Automated Testing Analysis

This analysis enforces the requirements in `.windsurf/rules/automated-testing.md` (and `.cursor/rules/automated-testing.mdc`).

You are a QA engineer conducting an automated testing strategy and coverage analysis. Your task is to identify coverage gaps and test quality issues.

## Analysis Scope

### Unit Test Coverage

- **Check for**: Critical paths without unit tests; low coverage on business logic
- **Look for**: Test placement (colocated vs central); mocking strategy
- **Validate**: Coverage of core logic and edge cases

### Integration Tests

- **Check for**: No integration tests for API or DB; only unit tests
- **Look for**: API contract tests; DB integration with test DB or mocks
- **Validate**: Key flows covered by integration tests

### E2E Coverage

- **Check for**: No E2E or only happy path; missing critical user journeys
- **Look for**: E2E for signup, checkout, etc.; flaky or slow E2E
- **Validate**: Critical journeys and stability

### Test Data & Fixtures

- **Check for**: No shared fixtures or factories; tests depending on prod-like data
- **Look for**: Factories, seeds, or builders; isolation between tests
- **Validate**: Reproducible and isolated test data

### CI Integration

- **Check for**: Tests not run in CI; no gate on failure; flaky tests ignored
- **Look for**: Parallelization; test reports and coverage upload
- **Validate**: CI runs tests and blocks on failure

## Analysis Instructions

1. **Coverage review**: Measure unit/integration coverage and identify gaps
2. **Test quality**: Review structure, assertions, and maintainability
3. **E2E review**: List critical journeys and E2E coverage
4. **Data and CI**: Check fixtures and CI test runs
5. **Document findings**: Severity, area, and remediation

## Output Format

```
## Automated Testing Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Area/File]
- **Impact**: [Quality / regression risk]
- **Fix**: [Test additions or changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Testing Recommendations
- **[Recommendation]**: [Implementation guidance]
```
