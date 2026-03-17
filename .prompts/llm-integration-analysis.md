# LLM Integration Analysis

This analysis enforces the requirements in `.windsurf/rules/llm-integration.md` (and `.cursor/rules/llm-integration.mdc`).

You are a security and ML specialist conducting an LLM/AI API integration analysis. Your task is to identify prompt injection, cost, and safety gaps.

## Analysis Scope

### Prompt Injection & Input

- **Check for**: User input concatenated into prompts without sanitization or structure
- **Look for**: Delimiter and instruction separation; output validation
- **Validate**: Input sanitization and prompt structure

### API Key & Access

- **Check for**: API keys in client or logs; no rotation
- **Look for**: Server-side only usage; key rotation and scope
- **Validate**: Secure key handling and rotation

### Output & Safety

- **Check for**: No output validation or content filter; unsafe content passed through
- **Look for**: PII in prompts or logs; content filtering and guardrails
- **Validate**: Output validation and safety filters

### Rate Limiting & Cost

- **Check for**: No rate limit or budget; unbounded token usage
- **Look for**: Per-user or per-endpoint limits; cost monitoring and alerts
- **Validate**: Rate limits and cost control

### Caching & Fallback

- **Check for**: No caching for repeated prompts; no fallback on provider failure
- **Look for**: Response caching; graceful degradation and retries
- **Validate**: Caching and resilience

### Privacy & Compliance

- **Check for**: PII or sensitive data sent to third-party LLM without agreement
- **Look for**: Data processing terms; minimal data sent; opt-in where required
- **Validate**: Privacy and compliance for LLM usage

### RAG & Vector/Embeddings

- **Check for**: Retrieved context used without validation; no access control on vector DBs or embedding APIs
- **Look for**: Retrieval boundaries and source validation; embedding injection or malicious chunks; trusted-but-unvalidated retrieved content fed to the LLM
- **Validate**: RAG pipeline security; vector store access control; content validation before/after retrieval. Align with OWASP Top 10 for LLM Applications where applicable.

## Analysis Instructions

1. **Prompt and input**: Review prompt construction and user input handling
2. **Keys and output**: Verify key security and output validation
3. **Rate and cost**: Check limits and cost controls
4. **Caching and fallback**: Resilience and caching
5. **Document findings**: Severity, integration point, and remediation

## Output Format

```
## LLM Integration Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Integration]
- **Impact**: [Security / cost / safety]
- **Fix**: [Input/output or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### LLM Integration Recommendations
- **[Recommendation]**: [Implementation guidance]
```
