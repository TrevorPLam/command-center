# SEO & Social Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/seo-social-standards.md` (and `.cursor/rules/seo-social-standards.mdc`).

You are an SEO specialist conducting a meta tags, structured data, and social sharing analysis. Your task is to identify missing or incorrect SEO and social markup.

## Analysis Scope

### Meta Tags

- **Check for**: Missing or duplicate title and description; no canonical
- **Look for**: Per-page meta; viewport and charset; robots where needed
- **Validate**: Unique, accurate meta and canonical URLs

### Open Graph & Twitter

- **Check for**: Missing og:title, og:description, og:image; no Twitter Card tags
- **Look for**: Dynamic OG per page; image dimensions and type
- **Validate**: Complete OG and Twitter Card for shareable pages

### Structured Data

- **Check for**: No JSON-LD or schema.org where relevant (Article, Product, etc.)
- **Look for**: Valid structured data; no conflicting or invalid markup
- **Validate**: Correct schema and validation (e.g. Rich Results Test)

### Sitemap & Discovery

- **Check for**: No sitemap or sitemap not linked; missing robots.txt
- **Look for**: Sitemap coverage and freshness; discovery in robots
- **Validate**: Crawlability and discovery

### Social Sharing UX

- **Check for**: No share buttons or preview; broken previews on social
- **Look for**: Share URLs and preview testing; mobile share support
- **Validate**: Share flow and preview accuracy

## Analysis Instructions

1. **Meta audit**: Check title, description, canonical on key pages
2. **OG and Twitter**: Verify tags and preview rendering
3. **Structured data**: Review schema and validate
4. **Sitemap and robots**: Coverage and discovery
5. **Document findings**: Severity, page/component, and remediation

## Output Format

```
## SEO & Social Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Page/Component]
- **Impact**: [Discoverability / sharing]
- **Fix**: [Meta or schema changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### SEO & Social Recommendations
- **[Recommendation]**: [Implementation guidance]
```
