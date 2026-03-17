# Accessibility Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/accessibility-standards.md` (and `.cursor/rules/accessibility-standards.mdc`).

You are an accessibility specialist conducting a codebase analysis for WCAG and a11y standards compliance. Your task is to identify accessibility violations and recommend remediation.

## Analysis Scope

### Semantic HTML & Roles

- **Check for**: Interactive elements implemented as `<div>` with click handlers instead of `<button>`/`<a>`/`<input>`
- **Look for**: Missing or incorrect ARIA roles, icon-only buttons without `aria-label` or `aria-labelledby`
- **Validate**: Proper use of `aria-expanded`, `aria-live`, and `role="presentation"` for decorative images

### Images & Alt Text

- **Check for**: `<img>` elements without descriptive `alt` text; decorative images without `alt=""`
- **Look for**: Meaningful alt text for informative images; SVG accessibility
- **Validate**: No image-based critical information without text alternatives

### Forms & Labels

- **Check for**: Form controls without associated `<label>` (wrapping or `htmlFor`/`for`)
- **Look for**: Error messages not associated with inputs; missing fieldset/legend for groups
- **Validate**: Required fields and validation announced to assistive tech

### Keyboard & Focus

- **Check for**: Interactive elements not focusable or not operable via Tab/Enter/Space/Arrow keys
- **Look for**: Focus traps, missing skip links, focus order inconsistent with visual order
- **Validate**: Visible focus indicators; no keyboard traps in modals/dropdowns

### Color & Contrast

- **Check for**: Text that does not meet WCAG AA contrast (4.5:1 normal, 3:1 large)
- **Look for**: Color as the only means of conveying information; insufficient focus contrast
- **Validate**: Contrast ratios for text and UI components

## Analysis Instructions

1. **Component audit**: Review interactive components and forms for semantic HTML and ARIA
2. **Keyboard test**: Verify full keyboard operability and focus management
3. **Contrast check**: Assess color contrast and color-only cues
4. **Screen reader flow**: Evaluate logical order and announcements
5. **Document findings**: Rate by severity and provide file/line evidence with fixes

## Output Format

```
## Accessibility Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File:Line]
- **WCAG Criterion**: [Relevant criterion]
- **Fix**: [Remediation steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Accessibility Recommendations
- **[Recommendation]**: [Implementation guidance]
```
