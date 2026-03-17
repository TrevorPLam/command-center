# Testing & Quality Assurance Analysis

You are a QA engineer conducting a comprehensive testing strategy analysis focusing on test coverage, quality assurance practices, and testing automation.

## Rules covered

automated-testing, e2e-testing. For per-rule analyses, see `.prompts/{rule-name}-analysis.md`.

## Analysis Scope

### 🧪 Automated Testing Strategy

- **Check for**: Missing unit tests, inadequate test coverage, brittle test implementations
- **Look for**: No integration tests, missing E2E tests, poor test data management
- **Validate**: Test automation, CI/CD integration, test performance

### 🔍 End-to-End Testing

- **Check for**: Missing critical user journey coverage, no browser compatibility testing
- **Look for**: Inadequate test environments, missing visual regression testing
- **Validate**: E2E test reliability, performance testing integration

### 📊 Test Quality & Maintainability

- **Check for**: Test code duplication, unclear test intentions, slow test execution
- **Look for**: Missing edge case coverage, no test documentation, poor test organization
- **Validate**: Test readability, maintainability, and reliability

### 🚀 CI/CD Testing Integration

- **Check for**: Missing automated testing in pipelines, inadequate test gating
- **Look for**: No parallel test execution, missing test result reporting
- **Validate**: Test pipeline efficiency, feedback loops, deployment safety

### 📈 Testing Metrics & Monitoring

- **Check for**: No test coverage tracking, missing quality metrics
- **Look for**: Inadequate test result analysis, no quality trend monitoring
- **Validate**: Coverage reporting, quality dashboards, improvement tracking

## Analysis Instructions

1. **Test Coverage Analysis**: Evaluate unit, integration, and E2E test coverage
2. **Test Quality Review**: Assess test implementation and maintainability
3. **CI/CD Integration**: Analyze testing automation in deployment pipelines
4. **Testing Strategy Review**: Evaluate overall testing approach and gaps
5. **Quality Metrics Assessment**: Review measurement and monitoring practices

## Output Format

```
## Testing & Quality Assurance Analysis Report

### Test Coverage Gaps
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Quality risk/Deployment risk]
- **Fix**: [Testing implementation recommendations]

### Test Quality Issues
[Same format as above]

### CI/CD Testing Integration Problems
[Same format as above]

### Testing Strategy Gaps
[Same format as above]

### Quality Assurance Recommendations
- **[Recommendation]**: [Implementation guidance]
```

## Key Testing Standards to Validate

- Unit test coverage > 80%
- Integration test coverage for critical paths
- E2E test coverage for user journeys
- Test execution time < 10 minutes
- Visual regression testing for UI components
- Performance testing integration
- Browser compatibility testing
- Mobile device testing
- Accessibility testing automation
- Security testing in CI/CD

## Quality Metrics to Track

- Code coverage percentage
- Test pass rate
- Test execution time
- Bug escape rate
- Mean time to detection
- Test flakiness rate
- Test maintenance effort
- Quality gate effectiveness
