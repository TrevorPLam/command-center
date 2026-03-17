# IoT Security Analysis

This analysis enforces the requirements in `.windsurf/rules/iot-security.md` (and `.cursor/rules/iot-security.mdc`).

You are an IoT security specialist conducting a device and firmware security analysis. Your task is to identify device auth, firmware, and lifecycle gaps.

## Analysis Scope

### Device Authentication

- **Check for**: No unique device identity or cert; shared or default credentials
- **Look for**: Device certificates or unique IDs; mutual auth
- **Validate**: Device authentication and identity

### Firmware Updates

- **Check for**: Unsigned or unverified firmware; no rollback
- **Look for**: Signed firmware; integrity check; rollback capability
- **Validate**: Secure firmware update and rollback

### Communication

- **Check for**: Device-to-device or device-to-cloud in plaintext; no TLS
- **Look for**: Encrypted channels; certificate or key management
- **Validate**: Encrypted communication

### Lifecycle & Monitoring

- **Check for**: No provisioning or decommissioning process; no device monitoring
- **Look for**: Lifecycle from provision to decommission; anomaly detection
- **Validate**: Lifecycle and monitoring

### Secure Boot & TEE

- **Check for**: No secure boot or trusted execution; firmware tampering risk
- **Look for**: Secure boot chain; TEE where appropriate
- **Validate**: Secure boot and TEE

### Network & Patching

- **Check for**: No device segmentation; no patch or vulnerability management
- **Look for**: Network isolation; patch management and vulnerability process
- **Validate**: Segmentation and patching

## Analysis Instructions

1. **Device auth**: Identity and authentication
2. **Firmware**: Update and rollback security
3. **Communication and lifecycle**: Encryption and lifecycle
4. **Secure boot and network**: TEE and segmentation
5. **Document findings**: Severity, device/component, and remediation

## Output Format

```
## IoT Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Device/Component]
- **Impact**: [Security / integrity]
- **Fix**: [Firmware or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### IoT Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```
