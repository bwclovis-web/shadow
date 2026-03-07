# 90-Day Product Execution Plan

This plan translates `docs/FUTURE_IDEAS.md` into an execution sequence with clear outcomes, owners, and measurable targets.

## Outcomes by Day 90

- A monetization baseline is live (at least one paid lane launched)
- Discovery and trust are visibly better for core users
- Team has better operational confidence (monitoring + support tooling)
- Product decisions are tied to metrics, not guesswork

## North-Star Metrics

- **Revenue:** first paid conversions, ARPU trend, boost purchase rate
- **Engagement:** D30 retention, return visits per week, alert click-through
- **Marketplace quality:** message response time, message-to-deal conversion proxy, dispute incidence
- **Reliability:** production error rate, p95 page interaction times, support ticket volume

## Phase 1 (Days 1-30): Foundation + Fast Wins

### Priorities

- Ship compare mode MVP
- Launch advanced filter v1 on key pages
- Instrument monitoring/analytics for decision quality

### Deliverables

- [ ] **PF-001** Compare mode v1 (`/perfume/compare`) with 2-3 item side-by-side
- [ ] **PF-002** Shareable compare URLs with query-state persistence
- [ ] **DF-001** Advanced filters v1 (notes/house/price/availability)
- [ ] **OP-001** Error monitoring integration with request correlation IDs
- [ ] **AN-001** KPI event taxonomy and dashboard baseline

### Success criteria

- Compare mode used by at least 15% of active weekly users
- Filter usage increases browse-to-detail click-through by 10%
- Error triage time reduced by 30%

## Phase 2 (Days 31-60): Monetization Beta + Trust

### Priorities

- Introduce monetization without harming trust
- Improve confidence signals in trading and reviews

### Deliverables

- [ ] **MZ-001** Shadows Plus beta (feature flags + entitlement checks)
- [ ] **MZ-002** Premium features: saved search bundles + deeper recommendation controls
- [ ] **TR-001** Trader reputation v1 (response speed + completion proxy)
- [ ] **TR-002** Review helpfulness voting + contributor badges
- [ ] **AL-001** Saved searches + alert subscriptions

### Success criteria

- Plus landing page conversion >= 2.5% from eligible traffic
- Reputation visibility improves contact initiation rate by 8%
- Alert subscription adoption >= 12% of active users

## Phase 3 (Days 61-90): Scale + Commercial Expansion

### Priorities

- Expand revenue lanes and optimize funnel
- Improve long-term retention hooks

### Deliverables

- [ ] **MZ-003** Boosted listings v1 with explicit sponsored labeling
- [ ] **MZ-004** Affiliate modules for verified retailers
- [ ] **SO-001** Follow system (houses/traders/reviewers) with feed seed
- [ ] **QO-001** Support tooling: moderation queue + dispute intake
- [ ] **AB-001** Experimentation harness for offer and ranking tests

### Success criteria

- Boost purchase attach rate >= 5% among active traders
- Affiliate CTR >= 3% on surfaced modules
- Follow feature improves weekly return rate by 7%

## Delivery Cadence

- Weekly planning: Monday
- Mid-week ship check: Wednesday
- KPI and experiment review: Friday
- Monthly strategy checkpoint: Day 30, Day 60, Day 90

## Risks and Mitigations

- **Risk:** Monetization reduces trust in discovery  
  **Mitigation:** sponsored labels, ranking guardrails, fairness audits
- **Risk:** Feature sprawl slows delivery  
  **Mitigation:** strict phase gates and kill criteria per feature
- **Risk:** Weak data quality for decisions  
  **Mitigation:** event QA checklist before any rollout
