---
description: Run Bug Debugging and Troubleshooting Workflow
---

# Bug Debugging Workflow

This workflow helps you systematically debug and fix bugs in the codebase.

## Step 1: Understand the Problem

First, gather all available information about the bug:

1. **Error Details**: Collect the full error message, stack trace, and any error codes
2. **Reproduction Steps**: Document exactly how to reproduce the issue
3. **Environment**: Note the browser, OS, Node.js version, and any relevant environment details
4. **Recent Changes**: Check if the issue started after recent deployments or code changes

## Step 2: Locate the Source

Find where the error is occurring in the code:

1. **Analyze Stack Trace**: Parse the stack trace to identify the exact file and line number
2. **Search Logs**: Look for related error messages in application logs
3. **Check Recent Commits**: Use `git log` to see recent changes that might be related
4. **Reproduce Locally**: Try to reproduce the issue in your development environment

## Step 3: Isolate the Issue

Create a minimal test case to isolate the problem:

1. **Write a Failing Test**: Create a test that reproduces the bug
2. **Simplify the Code**: Remove unnecessary code to focus on the problematic area
3. **Check Dependencies**: Verify if the issue is related to a specific dependency version
4. **Test Edge Cases**: Try different inputs and conditions to understand the boundaries

## Step 4: Investigate Root Cause

Dig deeper to understand why the bug is happening:

1. **Data Flow**: Trace the data flow from input to where the error occurs
2. **State Issues**: Check if there are any state management problems
3. **Async Issues**: Look for race conditions, unhandled promises, or callback issues
4. **External Factors**: Check if external APIs, databases, or services are causing issues

## Step 5: Implement a Fix

Develop and test the solution:

1. **Write the Fix**: Implement the minimal change needed to resolve the issue
2. **Add Tests**: Ensure the fix is covered by tests to prevent regression
3. **Test Thoroughly**: Verify the fix works in various scenarios
4. **Check Side Effects**: Ensure the fix doesn't break other functionality

## Step 6: Verify and Deploy

Make sure the fix is complete and ready:

1. **Code Review**: Have the fix reviewed following the PR review workflow
2. **Integration Test**: Test the fix in a staging environment
3. **Monitor**: After deployment, monitor for any related issues
4. **Document**: Update documentation if the bug revealed a need for better docs

## Debugging Commands and Tools

### Common Debugging Commands

```bash
# Check recent changes
git log --oneline -10

# Search for specific patterns
grep -r "error message" src/

# Check logs
tail -f logs/application.log

# Run specific tests
npm test -- --testNamePattern="failing test"
```

### Browser Debugging

- Use browser DevTools to set breakpoints
- Check Network tab for API failures
- Use Console to log intermediate values
- Check Memory and Performance tabs for resource issues

### Node.js Debugging

```bash
# Run with debugger
node --inspect-brk src/app.js

# Use VS Code debugger
# Set breakpoints in VS Code and press F5
```

## Common Bug Patterns

### 1. Null/Undefined Errors

- Check for optional chaining (`?.`)
- Verify default values are set
- Add null checks where needed

### 2. Async/Await Issues

- Ensure all async calls use await or .catch()
- Check for unhandled promise rejections
- Verify proper error handling in try/catch blocks

### 3. Type Errors

- Check TypeScript types match runtime values
- Verify API response shapes
- Add type guards for dynamic data

### 4. Environment Issues

- Check environment variables are set
- Verify different configs for dev/prod
- Check for hardcoded paths or URLs

Remember: The goal is not just to fix the bug, but to understand why it happened and prevent similar issues in the future.
