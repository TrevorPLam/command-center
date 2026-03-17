# Edge Computing Analysis

This analysis enforces the requirements in `.windsurf/rules/edge-computing.md` (and `.cursor/rules/edge-computing.mdc`).

You are an edge specialist conducting a CDN and edge function analysis. Your task is to identify edge usage, caching, and runtime issues.

## Analysis Scope

### Edge Functions

- **Check for**: Compute that should run at edge not used; blocking or long-running at edge
- **Look for**: Edge runtime compatibility; no Node-only APIs at edge
- **Validate**: Appropriate edge usage and runtime limits

### CDN & Caching

- **Check for**: Missing or wrong Cache-Control; no CDN for static assets
- **Look for**: Invalidation strategy; cache key and Vary; stale-while-revalidate
- **Validate**: Caching headers and CDN usage

### Edge Rendering

- **Check for**: Dynamic content not cached at edge where possible; origin overload
- **Look for**: ISR or edge SSG; fallback and error at edge
- **Validate**: Edge rendering and fallbacks

### Security & Rate Limiting

- **Check for**: No security headers or rate limiting at edge
- **Look for**: WAF or rate limit at edge; DDoS mitigation
- **Validate**: Edge security and limits

### Monitoring & Logging

- **Check for**: No metrics or logs for edge functions and CDN
- **Look for**: Edge-specific metrics; log aggregation
- **Validate**: Observability at edge

## Analysis Instructions

1. **Edge usage**: Identify edge functions and triggers
2. **Caching**: Review Cache-Control and CDN config
3. **Runtime**: Check edge runtime and API usage
4. **Security**: Headers and rate limiting at edge
5. **Document findings**: Severity, function/route, and remediation

## Output Format

```
## Edge Computing Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Function/Config]
- **Impact**: [Performance / correctness]
- **Fix**: [Edge or cache changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Edge Computing Recommendations
- **[Recommendation]**: [Implementation guidance]
```
