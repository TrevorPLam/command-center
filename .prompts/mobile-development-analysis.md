# Mobile Development Analysis

This analysis enforces the requirements in `.windsurf/rules/mobile-development.md` (and `.cursor/rules/mobile-development.mdc`).

You are a mobile specialist conducting a React Native / cross-platform mobile analysis. Your task is to identify platform, performance, and security gaps.

## Analysis Scope

### Platform & Conditional Code

- **Check for**: No Platform.select or platform-specific handling where needed
- **Look for**: Conditional imports; native module usage; iOS vs Android parity
- **Validate**: Correct platform separation and feature parity

### Bundle & Performance

- **Check for**: Large bundle; no code splitting or lazy loading
- **Look for**: Hermes; image and list optimization; startup time
- **Validate**: Bundle size and runtime performance

### Memory & Leaks

- **Check for**: Subscription or listener leaks; no cleanup in useEffect
- **Look for**: Large list virtualization; image memory; detach listeners
- **Validate**: No memory leaks in key flows

### Offline & Sync

- **Check for**: No offline support or sync where required; conflict handling
- **Look for**: Local storage and sync strategy; offline UX
- **Validate**: Offline and conflict resolution

### Push & Permissions

- **Check for**: Push without consent or token handling; missing permission flow
- **Look for**: Notification handling and deep links; permission UX
- **Validate**: Consent and permission handling

### Deep Links & Biometrics

- **Check for**: Deep links without validation; insecure deep link handling
- **Look for**: Biometric auth and secure storage; keychain/Keystore
- **Validate**: Deep link safety and biometric usage

### Accessibility & Background

- **Check for**: Missing screen reader support; no accessibility labels
- **Look for**: Background task limits and behavior; platform rules
- **Validate**: Accessibility and background compliance

## Analysis Instructions

1. **Platform review**: Check platform-specific code and parity
2. **Bundle and memory**: Analyze bundle size and leak risks
3. **Offline and push**: Review offline and notification flows
4. **Security**: Deep links and biometric/secure storage
5. **Document findings**: Severity, component/platform, and remediation

## Output Format

```
## Mobile Development Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Platform]
- **Impact**: [Correctness / performance / security]
- **Fix**: [Code or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Mobile Development Recommendations
- **[Recommendation]**: [Implementation guidance]
```
