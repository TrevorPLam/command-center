# NFT Standards Analysis

This analysis enforces the requirements in `.windsurf/rules/nft-standards.md` (and `.cursor/rules/nft-standards.mdc`).

You are a Web3 specialist conducting an NFT and marketplace standards analysis. Your task is to identify ERC compliance, metadata, and marketplace gaps.

## Analysis Scope

### ERC Compliance

- **Check for**: Non-compliant ERC-721 or ERC-1155; custom behavior breaking standard
- **Look for**: Full ERC-721/1155 compliance; transfer and approval semantics
- **Validate**: Standard compliance and interoperability

### Metadata & Royalties

- **Check for**: Metadata not following ERC-721 Metadata or OpenSea; no EIP-2981 royalties
- **Look for**: Metadata standard and IPFS or equivalent; royalty (EIP-2981) implementation
- **Validate**: Metadata and royalty standards

### Access Control & Gas

- **Check for**: Minting/transfer without access control; no gas optimization for batch
- **Look for**: Role-based mint and transfer; batch mint/transfer optimization
- **Validate**: Access control and gas efficiency

### Marketplace & Events

- **Check for**: No standard listing/trading interface; missing events for indexing
- **Look for**: Marketplace integration; event logging for transparency and indexers
- **Validate**: Marketplace compatibility and event coverage

### Security

- **Check for**: Reentrancy or approval exploits; no rarity/attribute validation
- **Look for**: Reentrancy guards; approval patterns; validation of attributes and rarity
- **Validate**: NFT-specific security and validation

## Analysis Instructions

1. **ERC and metadata**: Standard compliance and metadata
2. **Royalties and access**: EIP-2981 and access control
3. **Marketplace and events**: Listing interface and events
4. **Security**: Reentrancy and validation
5. **Document findings**: Severity, contract/area, and remediation

## Output Format

```
## NFT Standards Analysis Report

### Critical Issues
- **[Issue]**: [Description] - [Contract/Area]
- **Impact**: [Compatibility / security]
- **Fix**: [Contract or standard changes]

### High Priority Issues
[Same format as above]

### Medium/Low Priority
[Same format as above]

### NFT Standards Recommendations
- **[Recommendation]**: [Implementation guidance]
```
