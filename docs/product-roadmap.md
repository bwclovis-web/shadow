# Product roadmap — next loops (no new hubs)

How we ship the ideas from the feature discussion **without** a second product, a second marketplace, or a second how-to.

**Customer how-to:** [The Collector’s Guide](/the-collectors-guide) (`app/the-collectors-guide`). Update that page when a loop becomes user-visible.  
**Backlog IDs:** [CUSTOMER_FEATURES_BACKLOG.md](./CUSTOMER_FEATURES_BACKLOG.md)  
**Decant copy source:** [user-guide-decants.md](./user-guide-decants.md)

---

## Binding decisions

1. **No new top-level navigation.** Archive, Houses, Journal, Community, Exchange stay the public map. Ledger items stay under the profile menu.
2. **No new nouns for jobs that already have a name.**

   | Job | Existing name | Do not invent |
   |-----|----------------|---------------|
   | I want this bottle | Wishlist | ISO board, looking-for list |
   | Ping me when filters match | Saved search + Alerts | Watchlist, radar, hunt |
   | I own this | My Scents (inventory) | Vault, stash |
   | I offer ml | Exchange listing | Shop, storefront |
   | Several people, one pour | Group split | Circle, decant club |
   | Curated set | Community tray / shelf | Showcase, lookbook |
   | Today’s wear | Wear journal (+ optional feed share) | SOTD page |
   | Try later | Sampling queue (digest / My Scents) | Sample lab |
   | Timed destash | Community challenge type | Event marketplace |
   | Notice something happened | User alert (bell) | Second inbox |

3. **One alert spine.** Saved-search hits, wishlist matches, split/trade events, follows, and security already exist as separate pipes. Phase 1 makes them **one inbox + one preference sheet**, not three “Alerts” UIs.
4. **Payments stay off-platform.** Checklists, photos, tracking fields, and disputes — never checkout.
5. **Premium accelerates; it does not gate trading.** Messaging, listings, splits, wishlist, and trades stay in the paid-participation model you already have. Saved searches, instant alerts, insights, digest, and extra compare slots stay Premium/Collector.

---

## What already overlaps (do not rebuild)

| Proposed idea | Already in the product | Attach here |
|---------------|------------------------|-------------|
| Saved searches + alerts | `SavedSearch`, matcher cron, Save button on Archive + Exchange, Community → Alerts, mute toggle, Premium entitlement | Finish rules, snooze, frequency, merge into the bell |
| Wishlist re-engagement | Wishlist notifications, My Scents “traders wanting your listings” | Same inbox; digest card |
| ISO / looking-for | Public wishlist pages + wishlist matching | Visibility + region on **wishlist**, not a new board |
| Region matching | `User.region`, trade-match reason `same_region` | Exchange **filter** + optional wishlist “ships to” |
| Sample queue | `SamplingQueueItem` API; digest already lists it | UI on digest + My Scents “Try next” |
| Destash from neglect | Collection insights (rotation / neglected bottles) | CTA “list on The Exchange” on that card |
| Layering / what to wear | `/wear-suggestions`, `/seasonal-planning`, wear journal | Extra suggestion line, not a new app |
| SOTD | Wear journal + follow feed | “Share this wear” checkbox |
| Decant circles (CF-073) | Group splits | Invite-only or **repeat this split** — keep calling them splits |
| Destash events | Community challenges | Challenge **type** + Exchange banner |
| Trade safety | Trade events; splits already have claimed / paid / shipped / received | Same status language on 1:1 trades |
| Note explorer | `NoteMaterial` + aliases used in scoring | Public pages under **Archive**, not a nav item until content exists |
| Bulk inventory | My Scents | Same page |
| Affiliate / boosts | Membership + entitlements | Labeled modules later; never silent rank |

**Confusion already in flight (Phase 1 must shrink this):**

- Community → Alerts (saved searches only) vs header **bell** (UserAlert) vs **Alert preferences** vs **digest** vs **push**
- Wishlist vs saved search vs sampling queue vs tray vs `UserList` (API exists; do not promote a fifth list type)
- Wear suggestions vs seasonal planning vs collection insights vs digest (related, but four doors)

---

## Phase 0 — Clarify (now)

**Goal:** People can explain the product in four sentences.

- Update The Collector’s Guide: map of the Hollow, inventory vs listing vs split, wishlist vs saved search, off-platform payment, links into real routes.
- Keep [user-guide-decants.md](./user-guide-decants.md) as **source copy** for splits; do not turn it into a second public page.
- Correspondence FAQ: later, **trim** so it answers short questions and links the Guide. Do not maintain two manuals.
- Mark CF-020 as shipped-with-polish (save + matcher exist).

**Done when:** A new collector can find Archive, Exchange, Community, and ledger tools from the Guide without a walkthrough from us.

---

## Phase 1 — Alert spine (CF-020–023, CF-062, CF-074)

**Goal:** One reason to come back tomorrow.

Ship on **existing** surfaces only:

- Keep **Save this search** on Archive and Exchange.
- Keep **management** under Community → Alerts (not a new Alerts site section).
- Route matcher output through **UserAlert** so the header bell is the inbox.
- Add mute / snooze / instant vs daily (daily can reuse `/digest` + email).
- Wishlist “someone listed this” and “your listing matches their wishlist” use the **same** inbox.
- Copy: “Saved search” = filters; “Wishlist” = named bottles. Never “watchlist.”

**Do not:** a second Alert Center page, price-history charts, or alerting on every keystroke.

**Premium:** `saved_searches` + `instant_alerts` already. Free users keep wishlist notifications if they already have them.

**Guide update:** one paragraph under Step three (already drafted in Phase 0; tighten after snooze ships).

---

## Phase 2 — Liquidity without new nouns (CF-075)

**Goal:** More matches, same vocabulary.

- Exchange filter: **region / ships to** (field already on the user).
- Wishlist: optional **public looking-for** (you already have public wishlist URLs) + region hint.
- Trade suggestions continue to use `same_region` as an explainable reason.
- Destash-from-neglect: button on collection insights → prefilled listing flow on My Scents.

**Do not:** `/iso`, `/looking-for`, or “ISO” in the UI. Collectors may say ISO in messages; the product says wishlist.

**Guide update:** “Your public wishlist is how others see what you want.”

---

## Phase 3 — Trade safety (still not a shop) (CF-076)

**Goal:** Fewer “what do we do next?” messages; fewer disputes.

- Shared **deal steps** on 1:1 trades: photos / batch if offered, tracking, shipped, received — same words as splits.
- Reputation as an **Exchange filter** (minimum score), using the score you already show.
- Block / mute if anything is still only implicit in reports.

**Do not:** escrow, in-app payment, shipping labels, or a “Deal Center” hub. Disputes stay on the trade + `/community-policy`.

**Guide update:** Step four already points at recording the trade and Collector Standards.

---

## Phase 4 — Collector loops on hubs you have (CF-077)

**Goal:** Journal and shelf data feed the Exchange, not a lifestyle app.

| Loop | Where it lives |
|------|----------------|
| Sampling / try-next | Digest + My Scents (model exists) |
| Bulk edit ml / price / trade-ready | My Scents |
| Cost per wear / ml remaining | Collection insights (Collector entitlement) |
| Layering | Wear suggestions |
| Gift from public DNA + wishlist | Public profile / public wishlist only |
| Travel kit | Wear suggestions or seasonal planning — **no `/travel`** |
| SOTD | Journal entry “share to followers” |
| Tray comments | Tray detail only |

**Do not:** sampling page, SOTD page, travel page, gift shop.

**Guide update:** “Collector tools” box (Phase 0) — add a line only when a loop is actually tappable.

---

## Phase 5 — Discovery that is still the Archive (CF-078)

- `/notes/[slug]` (or house-like note pages) linked from perfume notes. **Not** in main nav until a critical mass of pages exist.
- “New to the Archive this week” rail on digest + house radar (scraper already produces new rows).
- Optional community **reformulation / vintage** tag as a filter chip — not a chemistry product.

**Guide update:** one line under The Archive on the map: “Notes in the catalog link to material pages.”

---

## Phase 6 — Later, still no new identity

| Idea | How to ship it | When |
|------|----------------|------|
| Decant circles (CF-073) | Invite-only or recurring **group split** | After Phases 1–3 are habitual |
| Destash Sunday | Challenge type + Exchange banner | After challenges have regular participation |
| Affiliate fallback | Perfume detail module, labeled, only if **no** Exchange listing | After trust copy is solid |
| Listing boosts | Time-boxed, badged, density-capped | Last; kill if report rate rises |
| House analytics | House page for verified houses | When catalog traffic exists |

**Do not:** in-app checkout, paid search that looks organic, or a Houses CMS portal that outranks recommendations.

---

## Suggested order (calendar is elastic)

1. Phase 0 Guide + backlog hygiene  
2. Phase 1 alerts (highest retention)  
3. Phase 2 region + public wishlist (highest unique marketplace value)  
4. Phase 3 trade checklist  
5. Phase 4 sampling UI + destash CTA + bulk edit  
6. Phase 5 note pages + new-catalog rail  
7. Phase 6 splits-as-circles, challenge destash, affiliate, boosts  

Skip or stop if a phase does not move its metric (below). Do not start Phase 6 while Phase 1 still has two inboxes.

---

## Invite-beta launch sequence (A–E)

Execution overlay for invite beta. Maps to Phases 0–4 above; ops run in parallel. **Locked decisions:** defer CF-021 price-movement (no listing price history); ship standalone `/privacy`; Community → Alerts = rules, header bell = inbox.

| Launch phase | Roadmap | Work |
|--------------|---------|------|
| **A Clarify** (Week 1) | Phase 0 | Guide pass; FAQ trim → Guide links; empty-state CTAs; onboarding nouns |
| **B Liquidity** (Weeks 2–3) | Phases 2 + 4 | Looking-for polish + region hint (CF-075); region filter copy; destash CTA on neglected insights; sampling-queue UI (CF-077) |
| **C Trade safety** (Weeks 3–4) | Phase 3 | Deal checklist photos/tracking/shipped/received (CF-076); reputation min filter; block/mute; `/privacy` |
| **D Retention** (Week 4) | Phase 1 remainder | Alert vocabulary pass; wishlist re-engagement (CF-062); CF-021 deferred in backlog |
| **E Ops** (parallel) | — | Sentry; Stripe live smoke; early-adopter backfill; SEO Console; Sorce journal; email/push smoke; incident one-pager; CSP stays Report-Only |
| **F After invite** | Phases 5–6 | Note pages, split circles, boosts/affiliates — do not start while A–E open |

**Invite-beta acceptance:** Guide + empty states pass four-sentence test; public wishlist + region E2E; destash opens listing draft; sampling queue on digest + My Scents; trade checklist uses split language; `/privacy` linked; Sentry test event; Stripe live verified; early adopters backfilled; sitemap in Search Console; one featured Journal story; email/push smoke green.

**Ship rules:** one phase theme per PR series; Guide update in same PR as user-visible loops; check CF IDs in backlog; Prisma Migrate only (additive); Premium accelerates — never gates messaging/listings/splits/trades.

---

## Metrics

| Phase | Primary signal |
|-------|----------------|
| 1 / D | Alert click-through; return visits within 7 days |
| 2 / B | Wishlist → conversation; region-filtered Exchange sessions that message |
| 3 / C | Trade completion rate; dispute rate |
| 4 / B | Sampling-queue → listing or wear; neglected-bottle list rate |
| 5 | Note-page search impressions; new-catalog rail CTR |
| 6 | Boost complaints; affiliate CTR with **no** drop in Exchange trust |

---

## Docs policy for each ship

| Surface | Role |
|---------|------|
| Collector’s Guide | The only customer **how-to**. Narrative + map + links. No unshipped features. |
| Correspondence FAQ | Short answers; link the Guide for procedures. |
| Collector Standards | Rules, not tutorials. |
| `user-guide-decants.md` | Internal/source copy for splits; paste into Guide/FAQ when splits change. |
| This roadmap | Sequencing and IA freeze. |
| Customer backlog | Checkboxes. |

When a phase ships, update the Guide **in the same PR** as the UI. If the Guide needs a new section, the IA probably grew too much — attach the feature to an existing section instead.
