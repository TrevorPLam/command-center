# [PRODUCTION HARDENING: Final Safety Check]

Deploy: [Description]

File Uploads:

- [ ] File type whitelist enforced (magic numbers, not extensions)
- [ ] SVG sanitization active (if SVGs allowed)
- [ ] Size limits server-side (5-10MB max)
- [ ] Filenames randomized (UUID)
- [ ] EXIF data stripped from images

Background Jobs:

- [ ] Redis queue configured (not setTimeout)
- [ ] Retry logic with exponential backoff
- [ ] Dead letter queue for failures
- [ ] Webhooks acknowledged immediately, processed async
- [ ] Idempotency keys preventing duplicates

Integrations:

- [ ] API keys rotated within last 90 days
- [ ] No hardcoded secrets in codebase
- [ ] Webhook signatures verified
- [ ] npm audit clean (no critical vulnerabilities)
- [ ] Rate limiting respected (Resend, Sanity, Supabase)

If File Upload or Integration checks fail: DEPLOYMENT BLOCKED.
These are breach vectors.

---

**Escalation Triggers** (Stop everything):

- **SVG upload without sanitization** (Stored XSS)
- **Service role key in client bundle** (Full database access)
- **Synchronous email sending without retry** (Data loss on failure)
- **npm audit critical vulnerabilities** (Supply chain breach)

---

**Category**: Pre-Flight Check  
**Purpose**: Production hardening for uploads, jobs, and integrations  
**Frequency**: Every deployment touching uploads, emails, or integrations  
**Priority**: HARD GATE - Upload and integration failures are breach vectors
