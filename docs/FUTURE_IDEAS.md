## Future Ideas (Next.js Platform Roadmap)

This document reframes future product ideas now that Shadows is fully on Next.js.  
Focus areas: monetization, quality of life, and customer-facing improvements while building on features we already have.

## Related planning docs

- `docs/ROADMAP_90_DAYS.md` - execution plan by phase
- `docs/MONETIZATION_PLAYBOOK.md` - revenue strategy and experiments
- `docs/CUSTOMER_FEATURES_BACKLOG.md` - customer-facing roadmap
- `docs/QOL_AND_OPERATIONS_PLAN.md` - quality-of-life and internal operations improvements

---

## What We Already Have (Foundation to Build On)

- [x] Personalized scent profiles
- [x] Smart recommendations
- [x] "Because you liked..." similarity suggestions
- [x] Trader messaging flow
- [x] User alerts and notification patterns
- [x] App Router architecture with modern server/client split

These should be treated as multipliers, not replaced.

---

## Product Direction (Next 6-12 Months)

### 1) Monetization (Primary)

1. **Shadows Plus subscription**
   - Premium filters, advanced recommendation depth, saved search bundles
   - Early access to rare drops and curated lists
   - Monthly "profile refresh" insights with trend snapshots

2. **Boosted marketplace visibility**
   - Optional paid boosts for trader listings
   - Time-boxed placements ("featured for 24h/72h")
   - Soft limits and relevance safeguards to keep trust

3. **Affiliate and partner revenue**
   - Verified retailer links where available
   - "Best match in stock" modules with transparent labeling
   - Campaign pages for launches/seasonal collections

4. **Creator and house tools (future monetization lane)**
   - Sponsored collection pages
   - House analytics dashboard for profile engagement

### 2) Customer Features (Engagement + Retention)

1. **Compare mode (high value)**
   - Side-by-side perfume compare (notes, longevity, sillage, value, reviews)
   - Shareable comparison links

2. **Advanced discovery**
   - Layered filters (notes, season, house, budget, availability)
   - Saved searches + instant alerts
   - Explainable recommendations ("why this is shown")

3. **Trust and reputation**
   - Trader reputation score (response speed, completion, reliability)
   - Verified trade/purchase badges on reviews
   - Review helpfulness voting and top contributor badges

4. **Social-lite features**
   - Follow houses, traders, and reviewers
   - Activity feed for followed entities

### 3) Quality of Life (User + Team)

1. **User QoL**
   - Better profile and inventory editing UX
   - Draft autosave for long reviews/messages
   - Better empty states with guided next actions

2. **Reliability and speed**
   - Smarter caching for high-traffic reads
   - Progressive loading + streaming for heavy pages
   - Background jobs for long-running tasks

3. **Operations and support**
   - Admin data quality dashboard
   - Error monitoring with correlation IDs
   - Moderation queue and dispute workflow

4. **Security and safety**
   - Optional 2FA for high-trust accounts/admins
   - Suspicious activity detection
   - Trust-tiered rate limiting

---

## Prioritized Backlog

### Now (0-2 months)

- [ ] Compare mode MVP
- [ ] Advanced filter v1 on major browse pages
- [ ] Saved searches + alert subscriptions
- [ ] Baseline error monitoring + alerting
- [ ] Trader reputation v1 (simple score)

### Next (2-4 months)

- [ ] Shadows Plus v1 (feature-gated perks)
- [ ] Boosted listings with placement rules
- [ ] Follow system (houses/traders)
- [ ] Review helpfulness voting + badges
- [ ] PWA improvements (push alerts, install polish)

### Later (4+ months)

- [ ] Affiliate marketplace modules
- [ ] House/creator sponsored pages
- [ ] Dispute resolution center
- [ ] ML-assisted moderation and anomaly detection
- [ ] A/B experimentation framework

---

## Monetization Principles

- Monetization must not reduce trust in search/recommendations
- Paid visibility must be labeled clearly
- Core discovery remains useful for free users
- Premium should feel like acceleration, not paywalling basics

---

## Success Metrics

- **Revenue:** subscription conversion, boost adoption, affiliate CTR/revenue
- **Retention:** D30 retention, returning sessions, alert engagement
- **Marketplace health:** message-to-trade conversion, reply time, dispute rate
- **Product quality:** page speed, error rate, support tickets, moderation turnaround

---

## Working Checklist

### Existing strengths (keep improving)
- [x] Personalized scent profiles
- [x] Smart recommendations
- [x] Similarity-based suggestions

### New focus areas
- [ ] Compare + advanced discovery
- [ ] Trust/reputation layer
- [ ] Subscription + boosts monetization
- [ ] Affiliate channel
- [ ] QoL and operational tooling

