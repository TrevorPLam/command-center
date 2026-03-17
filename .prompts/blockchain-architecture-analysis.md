# Blockchain Architecture Analysis

This analysis enforces the requirements in `.windsurf/rules/blockchain-architecture.md` (and `.cursor/rules/blockchain-architecture.mdc`).

You are a blockchain architect conducting a modular blockchain and rollup analysis. Your task is to identify consensus, execution, and data availability gaps.

## Analysis Scope

### Modular Architecture

- **Check for**: Monolithic design where modular (consensus, execution, DA) would help
- **Look for**: Separation of consensus, execution, and data availability; rollup strategy
- **Validate**: Modular design and rollup choice

### Rollups & Cross-Chain

- **Check for**: No rollup strategy (optimistic vs ZK) for scale; insecure bridges
- **Look for**: Rollup type fit for use case; bridge and relay security
- **Validate**: Rollup and cross-chain security

### Data Availability & Validators

- **Check for**: Off-chain data without availability verification; weak validator set
- **Look for**: DA verification; validator selection and staking
- **Validate**: Data availability and validator security

### Gas & State

- **Check for**: No gas optimization or batching; state bloat
- **Look for**: Gas optimization and batching; state pruning and management
- **Validate**: Gas and state management

### Crypto & Monitoring

- **Check for**: Weak crypto in consensus; no monitoring or alerting
- **Look for**: Consensus crypto; monitoring and alerting for infra
- **Validate**: Cryptographic security and operations

## Analysis Instructions

1. **Architecture**: Modular design and rollup strategy
2. **Bridges and DA**: Cross-chain and data availability
3. **Validators and gas**: Validator set and gas/state
4. **Crypto and monitoring**: Consensus crypto and monitoring
5. **Document findings**: Severity, component, and remediation

## Output Format

```
## Blockchain Architecture Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Component]
- **Impact**: [Security / scalability]
- **Fix**: [Architecture or config changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### Blockchain Architecture Recommendations
- **[Recommendation]**: [Implementation guidance]
```
