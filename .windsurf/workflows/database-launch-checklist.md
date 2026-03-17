# [PRODUCTION SAFETY: Pre-Deploy Checklist]

Feature: [Name]

Database:

- [ ] Migration reviewed for destructive operations
- [ ] Down migration tested
- [ ] DAL functions updated (not raw queries in routes)
- [ ] Connection pool appropriate for serverless
- [ ] Indexes added for new query patterns

Testing:

- [ ] E2E tests pass for Critical User Journey
- [ ] API contract tests pass (types match)
- [ ] Visual regression tests pass (mobile + desktop)
- [ ] Coverage ≥70% for new business logic

Security:

- [ ] Auth checks in place for new routes
- [ ] No sensitive data logged in tests or code

If any unchecked, DO NOT DEPLOY.

---

**Escalation Triggers** (Stop everything if the AI reports):

- **SQL Injection risk** (Critical)
- **Data loss migration** (Critical)
- **No E2E test for checkout/payment flow** (Critical)
- **Coverage <50% on billing logic** (Critical)
- **Missing auth on API route** (Critical)

---

**Category**: Pre-Flight Check  
**Purpose**: Production safety before deployment  
**Frequency**: Every deployment to production  
**Priority**: HARD GATE - All items must be checked
