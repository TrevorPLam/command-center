# Git Conventions Analysis

This analysis enforces the requirements in `.windsurf/rules/git-conventions.md` (and `.cursor/rules/git-conventions.mdc`).

You are a DevOps specialist conducting a Git workflow and repository conventions analysis. Your task is to identify branch, commit, and PR practice gaps.

## Analysis Scope

### Branch Strategy

- **Check for**: No defined strategy (main/develop, trunk-based, etc.); long-lived branches
- **Look for**: Branch naming; protection rules; release branches
- **Validate**: Clear strategy and protection

### Commit Messages

- **Check for**: Unclear or inconsistent commit messages; no conventional format where adopted
- **Look for**: Conventional commits or similar; scope and description
- **Validate**: Readable history and changelog potential

### Pull Request & Review

- **Check for**: No PR requirement or bypass; no review criteria
- **Look for**: Required reviewers; CI must pass; template and checklist
- **Validate**: PR as gate and documentation

### Tags & Releases

- **Check for**: No version tags or release process; inconsistent tagging
- **Look for**: Semantic versioning; release automation; changelog
- **Validate**: Traceability from tag to deploy

### Merge & History

- **Check for**: Merge strategy unclear (merge vs squash vs rebase); messy history
- **Look for**: Linear history preference; conflict resolution process
- **Validate**: Consistent merge strategy and clean history

## Analysis Instructions

1. **Branch and protection**: Review default branch and protection rules
2. **Commit sample**: Review recent commits for message quality
3. **PR process**: Check requirements and templates
4. **Tags and releases**: Verify tagging and release workflow
5. **Document findings**: Severity, area, and remediation

## Output Format

```
## Git Conventions Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Area]
- **Impact**: [Collaboration / traceability]
- **Fix**: [Process or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Git Conventions Recommendations
- **[Recommendation]**: [Implementation guidance]
```
