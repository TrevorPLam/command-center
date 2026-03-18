# Local Security Posture Guide

## Overview

The Command Center provides multiple security postures to protect your local AI deployment. This guide explains each security level and helps you choose the appropriate configuration for your environment.

## Security Postures

### 1. Default Secure (Recommended for Single Users)

**Configuration:**
- Network binding: Localhost only (127.0.0.1)
- Authentication: Disabled
- Network isolation: Enabled
- Outbound access: Restricted to approved domains

**Use Case:** Personal development machine or single-user deployment

**Security Features:**
- Services only accessible from localhost
- Network access monitoring and filtering
- Capability-based access control for tools
- Audit logging for all operations

**Trade-offs:**
- Lower security than shared-machine mode
- No user authentication
- Suitable for trusted environments

---

### 2. Shared Machine (Multi-User Environments)

**Configuration:**
- Network binding: Localhost only (127.0.0.1)
- Authentication: Required
- Network isolation: Enabled
- Outbound access: Disabled for security

**Use Case:** Shared workstations, lab environments, family computers

**Security Features:**
- User authentication with session management
- Stricter capability restrictions
- Path sandboxing per user
- Enhanced audit logging

**Trade-offs:**
- Requires login credentials
- More restrictive tool access
- No external network access

---

### 3. Air-Gapped (Maximum Security)

**Configuration:**
- Network binding: Localhost only (127.0.0.1)
- Authentication: Required
- Network isolation: Complete
- Outbound access: Disabled

**Use Case:** High-security environments, classified systems, isolated networks

**Security Features:**
- Complete network isolation
- No external dependencies
- Maximum capability restrictions
- Full audit trail

**Trade-offs:**
- No internet connectivity
- Manual model/dependency management
- Most restrictive environment

## Security Controls

### Network Security

#### Binding Modes

1. **Localhost Only** (Recommended)
   - Services bind to 127.0.0.1 only
   - Cannot be accessed from network
   - Maximum security for local access

2. **LAN Access**
   - Services accessible from local network
   - Requires firewall configuration
   - Use only when network access is needed

3. **All Interfaces** (Not Recommended)
   - Services bind to 0.0.0.0
   - Accessible from any network
   - Significant security risk

#### Network Isolation

When enabled, the Command Center:
- Monitors all network requests
- Blocks unauthorized domains
- Logs network access attempts
- Enforces domain allowlists/blocklists

### Authentication

#### User Credentials

Default credentials for demonstration:
- **Admin:** `admin` / `admin123`
- **Operator:** `operator` / `operator123`

**Security Notes:**
- Change default passwords in production
- Use strong passwords (8+ chars, mixed case, numbers, symbols)
- Sessions expire after 30 minutes of inactivity
- All login attempts are logged

#### Session Management

- JWT-based session tokens
- Secure, HTTP-only cookies
- Automatic session expiration
- Manual logout support

### Capability-Based Access Control

The Command Center uses fine-grained capabilities to control tool access:

#### Filesystem Capabilities

- **filesystem-read**: Read files and directories
- **filesystem-write**: Write, modify, delete files

#### Network Capabilities

- **network-egress**: Make outbound network requests

#### Database Capabilities

- **database-read**: Query database contents
- **database-write**: Modify database contents

#### System Capabilities

- **runtime-query**: Query AI runtime status
- **system-info**: Read system information
- **process-exec**: Execute system processes (forbidden by default)

#### Capability Enforcement

Each tool declares required capabilities, which are:
- Validated against security policy
- Checked at execution time
- Logged for audit purposes
- Enforced with resource limits

## Security Best Practices

### Environment Configuration

1. **Use Environment Variables**
   ```bash
   # Security settings
   ENABLE_AUTH=true
   JWT_SECRET=your-secret-key
   NETWORK_ISOLATION=true
   AIR_GAPPED=false
   ```

2. **Secure Network Binding**
   ```bash
   # Bind to localhost only
   HOSTNAME=127.0.0.1
   PORT=3000
   ```

3. **Restrict Outbound Access**
   ```bash
   # Allow only specific domains
   ALLOWED_DOMAINS=registry.npmjs.org,github.com,ollama.ai
   BLOCKED_DOMAINS=malware-example.com
   ```

### Operational Security

1. **Regular Security Checks**
   - Run preflight checks before starting
   - Monitor security logs
   - Review tool execution audit trails

2. **Update Management**
   - Keep dependencies updated
   - Review security advisories
   - Test updates in non-production first

3. **Access Control**
   - Use principle of least privilege
   - Regularly review user access
   - Disable unused capabilities

### Monitoring and Logging

1. **Security Events**
   - All capability violations logged
   - Network access monitored
   - Authentication attempts tracked

2. **Audit Trails**
   - Tool execution logged with metadata
   - User actions recorded
   - Security events preserved

## Threat Model

### Common Attack Vectors

1. **Network Exposure**
   - **Risk:** Services exposed beyond localhost
   - **Mitigation:** Localhost-only binding, network isolation

2. **Unauthorized Access**
   - **Risk:** Unauthorized tool execution
   - **Mitigation:** Authentication, capability guards

3. **Path Traversal**
   - **Risk:** Access to sensitive files
   - **Mitigation:** Path restrictions, sandboxing

4. **Network Exfiltration**
   - **Risk:** Data sent to external systems
   - **Mitigation:** Network filtering, air-gapped mode

5. **Resource Exhaustion**
   - **Risk:** System resource depletion
   - **Mitigation:** Resource limits, monitoring

### Defense in Depth

1. **Network Layer**
   - Localhost binding
   - Network isolation
   - Domain filtering

2. **Application Layer**
   - Authentication
   - Capability guards
   - Input validation

3. **Data Layer**
   - Path restrictions
   - Resource limits
   - Audit logging

## Incident Response

### Security Event Types

1. **Critical**
   - Capability violations
   - Authentication failures
   - Network access violations

2. **High**
   - Resource limit exceeded
   - Suspicious tool usage
   - Configuration changes

3. **Medium**
   - Network access to new domains
   - User permission changes
   - System resource warnings

### Response Procedures

1. **Immediate Response**
   - Review security logs
   - Identify affected systems
   - Contain if necessary

2. **Investigation**
   - Analyze audit trails
   - Determine root cause
   - Document findings

3. **Recovery**
   - Apply security patches
   - Update configurations
   - Monitor for recurrence

## Troubleshooting

### Common Issues

1. **Authentication Not Working**
   - Check JWT_SECRET is set
   - Verify ENABLE_AUTH=true
   - Restart application

2. **Network Access Blocked**
   - Check domain allowlists
   - Verify network isolation settings
   - Review security logs

3. **Tool Execution Denied**
   - Check capability requirements
   - Verify user permissions
   - Review security policy

### Debug Commands

```bash
# Check security configuration
pnpm run preflight

# View security logs
tail -f data/logs/security-validation.log

# Test authentication
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## Compliance Considerations

### Data Protection

- Local data storage only
- No telemetry in air-gapped mode
- User data isolation
- Audit trail retention

### Access Control

- Role-based permissions
- Session management
- Capability enforcement
- Resource monitoring

### Monitoring

- Security event logging
- Access pattern analysis
- Anomaly detection
- Regular security reviews

## Getting Help

### Security Questions

- Review this documentation
- Check security logs
- Run preflight validation
- Consult security settings UI

### Reporting Issues

- Document security events
- Include system configuration
- Provide reproduction steps
- Share relevant logs

### Additional Resources

- [Network Security Guide](./network-security.md)
- [Authentication Guide](./authentication.md)
- [Capability System Guide](./capabilities.md)
- [Audit Logging Guide](./audit-logging.md)
