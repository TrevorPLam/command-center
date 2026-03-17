# File Upload Security Analysis

This analysis enforces the requirements in `.windsurf/rules/upload-security.md` (and `.cursor/rules/upload-security.mdc`).

You are a security analyst conducting a file upload security analysis. Your task is to identify insecure upload handling and storage.

## Analysis Scope

### File Type Validation

- **Check for**: Validation by extension only; missing magic number (content) validation
- **Look for**: Allowlists vs blocklists; double extensions or null-byte tricks
- **Validate**: Server-side type verification before processing or storage

### SVG & XSS

- **Check for**: SVG uploads rendered without sanitization (XSS via script/handlers)
- **Look for**: Inline scripts or event handlers in uploaded SVGs
- **Validate**: SVG sanitization or safe rendering path

### Size & Resource Limits

- **Check for**: Missing or high file size limits; zip bombs or decompression bombs
- **Look for**: Unbounded processing time or memory for uploads
- **Validate**: Limits and timeouts on upload and processing

### Filenames & Storage

- **Check for**: User-controlled or predictable filenames; path traversal in storage
- **Look for**: EXIF or metadata retained when inappropriate; insecure storage paths
- **Validate**: Randomized or UUID filenames; access control on stored files

### Malware & Scanning

- **Check for**: No malware scanning for user uploads; executable content in upload dirs
- **Look for**: Integration points for virus scanning; quarantine until scanned
- **Validate**: Scan-before-serve or quarantine workflow

### Access Control

- **Check for**: Uploaded files served without access checks; direct URL guessing
- **Look for**: Signed URLs or token-based access for private uploads
- **Validate**: Authorization before serving any user upload

## Analysis Instructions

1. **Trace upload flow**: From client to validation, storage, and serving
2. **Verify type checks**: Ensure magic number and allowlist validation
3. **Review storage**: Filenames, paths, and access control
4. **Check SVG and images**: Sanitization and metadata stripping
5. **Document findings**: Severity, file/line, and remediation

## Output Format

```
## File Upload Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File:Line]
- **Impact**: [Security risk]
- **Fix**: [Remediation steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Upload Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```
