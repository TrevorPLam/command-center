# Web3 Security Analysis

This analysis enforces the requirements in `.windsurf/rules/web3-security.md` (and `.cursor/rules/web3-security.mdc`).

You are a smart contract security specialist conducting a Web3 and smart contract analysis. Your task is to identify reentrancy, access control, and oracle gaps.

## Analysis Scope

### Smart Contract Security

- **Check for**: Reentrancy; overflow/underflow; unchecked external calls
- **Look for**: Checks-effects-interactions; SafeMath or solidity 0.8+; OpenZeppelin
- **Validate**: Reentrancy and arithmetic safety

### Access Control

- **Check for**: Missing role-based or owner checks; centralized admin risk
- **Look for**: OpenZeppelin AccessControl or equivalent; role and ownership
- **Validate**: Access control on sensitive functions

### External Calls & Oracles

- **Check for**: Unsafe external calls; oracle without validation or delay
- **Look for**: CEI pattern; oracle validation and delay; circuit breakers
- **Validate**: Safe external calls and oracle usage

### Gas & Events

- **Check for**: Gas griefing or DoS; no events for critical actions
- **Look for**: Gas optimization; event logging for transparency and indexing
- **Validate**: Gas safety and event coverage

### Upgradeability & Testing

- **Check for**: Upgradeable contracts without safe proxy pattern; no tests
- **Look for**: Proxy pattern if upgradeable; tests including edge cases and attacks
- **Validate**: Upgrade safety and test coverage

## Analysis Instructions

1. **Contract review**: Reentrancy, arithmetic, and access control
2. **External and oracle**: External calls and oracle security
3. **Gas and events**: Gas usage and event logging
4. **Upgrade and tests**: Proxy pattern and test coverage
5. **Document findings**: Severity, contract/function, and remediation

## Output Format

```
## Web3 Security Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Contract:Function]
- **Impact**: [Loss / integrity]
- **Fix**: [Contract or pattern changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Web3 Security Recommendations
- **[Recommendation]**: [Implementation guidance]
```
