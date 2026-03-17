# Decentralized Identity Analysis

This analysis enforces the requirements in `.windsurf/rules/decentralized-identity.md` (and `.cursor/rules/decentralized-identity.mdc`).

You are an identity specialist conducting a DID and verifiable credentials analysis. Your task is to identify DID resolution, VC, and key management gaps.

## Analysis Scope

### DID Resolution

- **Check for**: No DID resolution or validation; unsupported DID methods
- **Look for**: DID resolution (did:ethr, did:web, did:key, etc.); validation
- **Validate**: DID resolution and method support

### Verifiable Credentials

- **Check for**: VCs not following W3C VC standard; no cryptographic signatures
- **Look for**: VC issuance and verification; selective disclosure; revocation
- **Validate**: VC standard compliance and crypto

### Presentation & Verification

- **Check for**: No credential presentation or verification flow; no status check
- **Look for**: Presentation flow; verification and revocation status
- **Validate**: Presentation and verification workflow

### Key Management

- **Check for**: Weak key storage or no rotation for DIDs and issuers
- **Look for**: Key management for controllers and issuers; secure storage
- **Validate**: Key management and rotation

### Privacy & Audit

- **Check for**: PII in credentials without need; no audit for identity operations
- **Look for**: Privacy-preserving disclosure; audit logging
- **Validate**: Privacy and audit for identity

## Analysis Instructions

1. **DID and VC**: Resolution, issuance, and verification
2. **Key management**: Storage and rotation
3. **Presentation and revocation**: Flows and status
4. **Privacy and audit**: Disclosure and logging
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Decentralized Identity Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Trust / interoperability]
- **Fix**: [DID/VC or key changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Decentralized Identity Recommendations
- **[Recommendation]**: [Implementation guidance]
```
