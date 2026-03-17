# AI Agent Security Analysis

This analysis enforces the requirements in `.windsurf/rules/ai-agent-security.md` (and `.cursor/rules/ai-agent-security.mdc`).

You are a security specialist conducting an AI agent and agentic system security analysis. Your task is to identify tool misuse, prompt injection, and audit gaps.

## Analysis Scope

### Prompt Injection

- **Check for**: Agent prompts modifiable by user; no instruction separation or sanitization
- **Look for**: System prompt protection; input/output separation; advanced injection defenses
- **Validate**: Prompt integrity and injection mitigation

### Tool Use & Validation

- **Check for**: Agent tools that can do more than intended; no validation of tool args
- **Look for**: Sandboxed execution; allowlist of tools and parameters; no arbitrary code
- **Validate**: Least-privilege tools and validation

### Output & Exfiltration

- **Check for**: Agent output not validated; possible data exfiltration via output
- **Look for**: Output filtering and length limits; no sensitive data in responses
- **Validate**: Output validation and data loss prevention

### Rate & Cost

- **Check for**: No rate or cost limit on agent runs; runaway loops
- **Look for**: Per-user and per-session limits; cost alerts and caps
- **Validate**: Rate and cost controls

### Capability & Scope

- **Check for**: Agent with excessive permissions or scope; no human approval for high-risk
- **Look for**: Scoped capabilities; human-in-the-loop for sensitive actions
- **Validate**: Bounded capability and approval flows

### Audit & Configuration

- **Check for**: No audit log of agent decisions or tool calls
- **Look for**: Logging of prompts, tools, and outcomes; config not in version control
- **Validate**: Audit trail and secure config

## Analysis Instructions

1. **Prompt and tools**: Review system prompt and tool definitions
2. **Validation**: Check input/output and tool argument validation
3. **Rate and scope**: Verify limits and human-in-the-loop
4. **Audit**: Logging and config security
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## AI Agent Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Security / safety risk]
- **Fix**: [Validation or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### AI Agent Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```
