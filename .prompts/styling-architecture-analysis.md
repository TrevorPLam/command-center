# Styling Architecture Analysis

This analysis enforces the requirements in `.windsurf/rules/styling-architecture.md` (and `.cursor/rules/styling-architecture.mdc`).

You are a frontend specialist conducting a CSS and styling architecture analysis. Your task is to identify inconsistency and maintainability issues.

## Analysis Scope

### Approach Consistency

- **Check for**: Mixed approaches (CSS-in-JS + utility + plain CSS) without clear boundaries
- **Look for**: Design tokens or theme; single primary approach per layer
- **Validate**: Consistent strategy and naming

### Design System

- **Check for**: No shared components or tokens; duplicated colors/spacing
- **Look for**: Theme or design tokens; component library usage
- **Validate**: Reuse and single source of truth

### Responsive & Layout

- **Check for**: Breakpoints inconsistent or magic numbers; no mobile-first where needed
- **Look for**: Container queries vs media queries; layout components
- **Validate**: Responsive strategy and accessibility of layout

### Performance

- **Check for**: Unused CSS; runtime-injected CSS in hot paths; large global CSS
- **Look for**: Critical CSS; tree-shaking; minimal runtime cost
- **Validate**: Bundle size and render impact

### Organization & Naming

- **Check for**: No BEM or naming convention; conflicting class names
- **Look for**: File organization; scoping (modules, scope, etc.)
- **Validate**: Consistent naming and structure

## Analysis Instructions

1. **Approach audit**: Identify CSS-in-JS, utility, and global usage
2. **Design system**: Check tokens and shared components
3. **Responsive review**: Breakpoints and layout patterns
4. **Performance**: Bundle size and runtime cost
5. **Document findings**: Severity, file/component, and remediation

## Output Format

```
## Styling Architecture Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [File/Component]
- **Impact**: [Maintainability / performance]
- **Fix**: [Architecture or refactor steps]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Styling Recommendations
- **[Recommendation]**: [Implementation guidance]
```
