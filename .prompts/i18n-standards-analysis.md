# Internationalization (i18n) Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/i18n-standards.md` (and `.cursor/rules/i18n-standards.mdc`).

You are an i18n specialist conducting an internationalization and localization analysis. Your task is to identify hardcoded strings and locale gaps.

## Analysis Scope

### Text Externalization

- **Check for**: Hardcoded user-facing strings; no translation keys or namespace
- **Look for**: Use of i18n library (react-i18next, next-intl, etc.); key structure
- **Validate**: All UI strings externalized and keys consistent

### Date, Time, Number

- **Check for**: Raw Date or number formatting; locale-independent formatting
- **Look for**: Intl.DateTimeFormat, Intl.NumberFormat, or library; timezone handling
- **Validate**: Locale-aware dates, times, numbers, currency

### RTL & Layout

- **Check for**: Layout that doesn’t support RTL; hardcoded left/right or margin/padding
- **Look for**: logical properties or RTL-aware CSS; dir attribute
- **Validate**: RTL support where required

### Key Organization

- **Check for**: Flat or chaotic key structure; no namespace or feature grouping
- **Look for**: Key naming convention; fallbacks and missing key handling
- **Validate**: Discoverable keys and fallback strategy

### Pluralization & Context

- **Check for**: Manual plural handling; no context for ambiguous strings
- **Look for**: Plural rules and context in translation system
- **Validate**: Correct pluralization and context for translators

## Analysis Instructions

1. **String audit**: Find hardcoded user-facing text
2. **i18n usage**: Check library usage and key coverage
3. **Formatting**: Review date, time, number, currency
4. **RTL**: Check layout and logical properties
5. **Document findings**: Severity, file/key, and remediation

## Output Format

```
## i18n Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Key]
- **Impact**: [Localization / accessibility]
- **Fix**: [Externalization or format changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### i18n Recommendations
- **[Recommendation]**: [Implementation guidance]
```
