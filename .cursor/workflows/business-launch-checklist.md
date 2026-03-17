# [BUSINESS READINESS: Launch Checklist]

Launch: [Feature/Campaign Name]

Analytics:

- [ ] Events instrumented for new user flows
- [ ] Funnel steps defined in analytics platform
- [ ] UTM parameter tracking configured
- [ ] Dashboard created for launch metrics

Performance:

- [ ] RUM monitoring active for new routes
- [ ] Load testing passed (can handle 10x expected traffic?)
- [ ] Database queries optimized for new features

Business Logic:

- [ ] Pricing calculations tested with edge cases (free, 100% discount, international)
- [ ] Email templates reviewed and tested
- [ ] Notification triggers firing correctly

Compliance:

- [ ] Privacy policy updated if collecting new data
- [ ] Consent flows updated for new tracking

If Analytics or Business Logic checks fail: LAUNCH DELAYED.
You cannot optimize what you cannot measure.

---

**Escalation Triggers** (Stop launch):

- **No event tracking on new checkout flow** (Can't measure conversion)
- **Price calculation discrepancy** (Revenue loss/gain)
- **Missing email delivery for critical user actions** (Support nightmare)
- **RUM showing >5s load times on mobile** (SEO + conversion death)

---

**Category**: Pre-Flight Check  
**Purpose**: Business intelligence readiness for launches  
**Frequency**: Every major feature/marketing launch  
**Priority**: HARD GATE - Analytics and business logic essential
