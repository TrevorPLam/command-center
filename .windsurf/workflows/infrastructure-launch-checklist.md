# [INFRASTRUCTURE SAFETY: Production Readiness]

Deployment: [Description]

Build & Deploy:

- [ ] TypeScript build passes with zero errors
- [ ] Environment variables validated against .env.example
- [ ] Database migrations backward compatible (or maintenance window scheduled)
- [ ] Rollback plan documented (how to revert if broken)

Security:

- [ ] Auth routes check resource ownership
- [ ] Admin routes verify role (not just login)
- [ ] Session cookies HttpOnly + Secure + SameSite
- [ ] No sensitive data in logs

Observability:

- [ ] Error tracking active (Sentry/LogRocket)
- [ ] Alerts configured for error rate >1%
- [ ] Health endpoint responding
- [ ] SSL valid >30 days

If Security or Build checks fail: DEPLOYMENT BLOCKED.
If Observability checks fail: DEPLOYMENT BLOCKED until monitoring restored.

---

**Escalation Triggers** (Stop everything):

- **Missing HttpOnly on auth cookie** (Session hijacking risk)
- **No ownership check on API route** (Data breach risk)
- **Database migration not backward compatible** (Downtime risk)
- **No error tracking in production** (Blind deployment)

---

**Category**: Pre-Flight Check  
**Purpose**: Production safety before deployment  
**Frequency**: Every deployment to production  
**Priority**: HARD GATE - All items must be checked
