# Supply Chain Security Analysis

This analysis enforces the requirements in `.windsurf/rules/supply-chain-security.md` (and `.cursor/rules/supply-chain-security.mdc`).

You are a supply chain security specialist conducting an SBOM, provenance, and build security analysis. Your task is to identify supply chain and build pipeline risks.

## Analysis Scope

### SBOM & Inventory

- **Check for**: No Software Bill of Materials (SBOM) for builds; missing dependency inventory
- **Look for**: SBOM format (CycloneDX, SPDX); generation in CI and storage
- **Validate**: SBOM for release artifacts and critical images

### Vulnerability Scanning

- **Check for**: No automated scanning (Snyk, Dependabot, etc.); unaddressed high/critical
- **Look for**: Scan in CI and on base images; container image scanning
- **Validate**: Scan frequency and remediation SLA

### Pinning & Lock Files

- **Check for**: No lock file or unpinned transitive deps; lock file not in repo
- **Look for**: Exact versions in lock; integrity hashes
- **Validate**: Reproducible builds and dependency pinning

### Signing & Verification

- **Check for**: Unsigned commits or tags; no signature verification in CI
- **Look for**: Signed releases or artifacts; verification in deployment
- **Validate**: Commit signing and release signing where applicable

### Allowlists & Blocking

- **Check for**: No dependency allowlist or blocklist; unknown or suspicious packages
- **Look for**: Policy for new dependencies; namespace or registry restrictions
- **Validate**: Policy enforcement in CI or package manager

### Containers & Build Pipeline

- **Check for**: Base images not scanned; build tools or CI not secured
- **Look for**: Build provenance; artifact signing and verification
- **Validate**: Container and build pipeline security

## Analysis Instructions

1. **SBOM and inventory**: Check for SBOM generation and coverage
2. **Scanning**: Review vulnerability scanning in CI and for images
3. **Pinning and signing**: Verify lock files and commit/release signing
4. **Policies**: Review allowlist/blocklist and new-dep process
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Supply Chain Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component/Process]
- **Impact**: [Supply chain / integrity risk]
- **Fix**: [Remediation steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Supply Chain Recommendations
- **[Recommendation]**: [Implementation guidance]
```
