# Dependency Management Analysis

This analysis enforces the requirements in `.windsurf/rules/dependency-management.md` (and `.cursor/rules/dependency-management.mdc`).

You are a dependency and supply-chain specialist conducting a package dependency analysis. Your task is to identify vulnerabilities, bloat, and policy violations.

## Analysis Scope

### Vulnerabilities & Patching

- **Check for**: Known vulnerabilities in lock file; outdated or unpatched dependencies
- **Look for**: No Dependabot/Snyk or equivalent; ignored advisories without justification
- **Validate**: Regular scanning and patch policy

### Licenses

- **Check for**: Incompatible or restricted licenses in production deps
- **Look for**: No license check in CI; copyleft in proprietary code paths
- **Validate**: License allowlist and compliance

### Unused & Bloat

- **Check for**: Dependencies never imported; duplicate packages (lodash vs lodash-es)
- **Look for**: Large transitive trees; optional deps that could be peer
- **Validate**: Regular pruning and bundle impact review

### Version Pinning & Reproducibility

- **Check for**: Ranges that allow breaking changes; no lock file or committed lock
- **Look for**: Inconsistent versions across monorepo packages
- **Validate**: Lock file committed; reproducible installs

### Supply Chain & Provenance

- **Check for**: No SBOM or provenance; unsigned or unverified packages
- **Look for**: Scripts in install that could be malicious; registry integrity
- **Validate**: Supply chain practices and allowlist where applicable

## Analysis Instructions

1. **Audit and scan**: Run npm audit / equivalent and review results
2. **License check**: List licenses and flag policy violations
3. **Usage review**: Identify unused or redundant dependencies
4. **Pinning and lock**: Verify lock file and version strategy
5. **Document findings**: Severity, package, and remediation

## Output Format

```
## Dependency Management Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Package/File]
- **Impact**: [Security / compliance / size]
- **Fix**: [Upgrade / remove / replace steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Dependency Recommendations
- **[Recommendation]**: [Implementation guidance]
```
