---
description: Run Pull Request Code Review Workflow
---

# Pull Request Code Review

This workflow guides you through a comprehensive code review process to ensure quality, security, and maintainability.

## Step 1: Analyze the Changes

First, examine what files have been modified and understand the scope of the changes.

1. Get the git diff to see all changes:

```bash
git diff main...HEAD --name-only
git diff main...HEAD --stat
```

2. Read the full diff for each changed file to understand the implementation.

## Step 2: Check Against Rules

Review each changed file against the relevant rules in our library:

- For TypeScript files: Check `typescript-standards.mdc`
- For API routes: Check `api-standards.mdc` and `input-validation.mdc`
- For React components: Check `accessibility-standards.mdc` and `i18n-standards.mdc`
- For database changes: Check `database-schema-integrity.mdc`
- For security changes: Check `auth-standards.mdc` and `security-headers.mdc`
- For performance changes: Check `frontend-performance.mdc` and `backend-performance.mdc`

## Step 3: Verify Tests

Ensure adequate test coverage for the changes:

1. Check if new functions/classes have corresponding test files
2. Verify existing tests still pass
3. Look for edge cases that might not be covered
4. Check if integration tests are needed for API changes

## Step 4: Security Review

Pay special attention to security implications:

1. Check for any exposed secrets or credentials
2. Verify proper authentication/authorization
3. Look for potential XSS, SQL injection, or other vulnerabilities
4. Review any changes to permissions or access controls

## Step 5: Performance Impact

Assess the performance implications:

1. Check for potential N+1 queries in database changes
2. Look for missing indexes on new query patterns
3. Verify proper caching implementation
4. Check for bundle size impact in frontend changes

## Step 6: Documentation

Ensure proper documentation:

1. Check if README needs updates
2. Verify inline documentation is accurate
3. Look for outdated comments
4. Check if API documentation needs updates

## Step 7: Final Review

Provide a structured review summary with:

### ✅ What looks good

- List well-implemented changes

### ⚠️ Areas for improvement

- Specific issues with line numbers
- Suggestions for fixes
- Rule violations found

### 🚫 Blocking issues (if any)

- Security vulnerabilities
- Breaking changes
- Missing critical functionality

### 💡 Additional suggestions

- Performance optimizations
- Code style improvements
- Architectural considerations

Remember to be constructive and specific in your feedback. The goal is to improve the codebase, not to criticize the author.
