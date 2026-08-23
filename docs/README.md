# Documentation hub

Single entry point for perfumer's hollow (Shadows) docs. Prefer updating these living pages over adding one-off completion notes under `docs/`.

**Schema policy:** Prisma Migrate only — see [database.md](./database.md).

---

## Start here

| Doc | Purpose |
|-----|---------|
| [getting-started.md](./getting-started.md) | New machine setup, env, first migrate deploy |
| [database.md](./database.md) | Schema changes, local/prod migrate, backups, legacy scripts |
| [architecture.md](./architecture.md) | Server layers (`models` / `services` / `utils` / client queries) |
| [quality.md](./quality.md) | Unit tests, Playwright, performance targets, release gates |

Root [README.md](../README.md) stays short: product blurb + common commands + link here.

---

## Ops runbooks

| Doc | Purpose |
|-----|---------|
| [scraper-troubleshooting.md](./scraper-troubleshooting.md) | Scraper connection resets, delays, headed mode |
| [seo-post-deploy.md](./seo-post-deploy.md) | robots/sitemap/Search Console after deploy |
| [seo-journal-growth.md](./seo-journal-growth.md) | Editorial checklist for journal SEO |
| [live-testing.md](./live-testing.md) | Resend / transactional email smoke paths |
| [testing-web-push.md](./testing-web-push.md) | VAPID + browser push manual QA |
| [smoke-test-decant-splits.md](./smoke-test-decant-splits.md) | Short decant-split smoke checklist |

---

## Product & strategy

| Doc | Purpose |
|-----|---------|
| [CUSTOMER_FEATURES_BACKLOG.md](./CUSTOMER_FEATURES_BACKLOG.md) | Customer-facing backlog (open items first) |
| [MONETIZATION_PLAYBOOK.md](./MONETIZATION_PLAYBOOK.md) | Subscription / revenue experiments |
| [user-guide-decants.md](./user-guide-decants.md) | Decants / inventory / splits (copy for Help/FAQ) |

---

## Domain specs (code must match)

| Doc | Purpose |
|-----|---------|
| [reputation-v1-spec.md](./reputation-v1-spec.md) | Trader reputation score + badges thresholds |
| [contributor-badges-spec.md](./contributor-badges-spec.md) | Contributor badge rules (Phase 1) |
| [trade-match-score-v1.md](./trade-match-score-v1.md) | Explainable trade-match reasons |

---

## Related repo docs (outside this folder)

| Location | Purpose |
|----------|---------|
| [`context/`](../context/) | Dated decisions / research (e.g. database workflow preference) |
| [`scripts/COMMANDS-REFERENCE.md`](../scripts/COMMANDS-REFERENCE.md) | Script inventory |
| [`components/Containers/DataQualityDashboard/DOCS.md`](../components/Containers/DataQualityDashboard/DOCS.md) | Data quality dashboard |
| [`.cursor/rules/`](../.cursor/rules/) | Always-on agent conventions |
| [`.cursor/skills/`](../.cursor/skills/) | Repeatable workflows (e.g. sync translations) |

---

## Archive

Historical plans, superseded checklists, and one-off completion notes live under [`archive/`](./archive/README.md). Do not treat archive docs as current policy.

---

## Doc conventions

1. **One hub** — link from here; don’t invent a parallel “plan” tree for the same topic.
2. **Living > completion notes** — no new `COMPLETION_SUMMARY` / `REFACTORING_SUMMARY` files under `docs/`.
3. **Policy conflicts** — if a doc disagrees with this hub or Cursor rules, update the doc (or move it to archive).
4. **Schema** — always Prisma Migrate; never document `db push` as the default apply step.
