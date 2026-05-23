# Live testing — transactional email

Manual steps to verify Resend and all email alert paths in perfumer's hollow. Automated unit tests live in `utils/alert-email.server.test.ts` and `utils/email.server.test.ts`.

## Prerequisites

1. **Environment** (`.env` or hosting env vars):
   - `RESEND_API_KEY` — API key from [Resend](https://resend.com)
   - `EMAIL_FROM` — verified sender, e.g. `perfumer's hollow <alerts@yourdomain.com>` or `alerts@yourdomain.com`
   - `NEXT_PUBLIC_APP_URL` — base URL for links in emails (e.g. `http://localhost:3000` locally)

2. **Database migration** (after pulling trade-email changes):
   ```bash
   npx prisma migrate deploy
   npm run db:generate
   ```
   Restart the dev server so the Prisma client includes `emailTradeAlerts`.

3. **Resend sandbox note:** Until your domain is verified, Resend often only delivers to the email address on your Resend account. Use that address for smoke tests.

---

## 1. Resend smoke test (no app flow)

Confirms API key and `EMAIL_FROM` without going through alerts or trades.

```bash
npx tsx scripts/test-resend-email.ts your@email.com
```

**Expected:** Console shows `Result: { sent: true, id: '...' }` and the inbox receives “perfumer's hollow — Resend smoke test”.

**If it fails:**
- `RESEND_API_KEY` or `EMAIL_FROM` missing → set both and restart the dev server
- Invalid `EMAIL_FROM` format → use plain `email@domain.com` or `Name <email@domain.com>`
- Resend API error → check Resend dashboard logs; unverified domains may block recipients

---

## 2. Wishlist availability email (IMP-061)

**Trigger:** A trader lists a perfume that another user has on their wishlist (with alerts enabled).

**Setup (recipient):**
1. Sign in as User B.
2. Open **My Alerts** → **Alert Preferences** → Edit.
3. Enable **Wishlist Alerts** and **Email Wishlist Alerts** → Save.

**Steps:**
1. As User B, add a perfume to the wishlist (public if decant flow matters elsewhere).
2. As User A, list that same perfume on the exchange (available, not `0` ml).
3. Wait for the wishlist alert job to run (listing create / availability update path in `models/user-alerts.server.ts`).

**Expected:**
- In-app alert in **My Alerts** for User B.
- Email to User B’s account address with subject containing the perfume name and a link to the perfume page.
- Dev console: `[email] Sent wishlist email to ...` when `NODE_ENV=development`.

**Skip conditions:** `emailWishlistAlerts` off, `wishlistAlertsEnabled` off, or invalid/deleted email → no send (debug log only in dev).

---

## 3. Decant interest email (IMP-062)

**Trigger:** Someone adds a perfume to a **public** wishlist; decanters who hold that perfume get notified.

**Setup (recipient — decanter):**
1. Enable **Decant Interest Alerts** and **Email Decant Alerts** in preferences.

**Steps:**
1. User A has the perfume listed as available.
2. User B adds the same perfume to a **public** wishlist.

**Expected:**
- In-app alert for User A.
- Email subject like “Someone wants your {perfume}!” with listing link.

---

## 4. Trade milestone emails (IMP-063)

**Trigger:** Trade status transitions in `models/trade.server.ts` → `sendTradeAlert` → `sendTradeEventEmail`.

**Milestones that send email** (when `emailTradeAlerts` is on):

| Action | Alert type | Typical recipient |
|--------|------------|-------------------|
| Submit offer | `trade_received` | Counterparty |
| Accept | `trade_accepted` | Initiator |
| Mark shipped | `trade_shipped` | Other party |
| Complete | `trade_completed` | Other party |

Decline/cancel (`trade_cancelled`) creates in-app alerts only — **no email**.

**Setup (recipient):**
1. Sign in as the user who should receive emails.
2. **Alert Preferences** → enable **Email Trade Updates** → Save.

**Steps (two accounts, A and B):**
1. A proposes a trade to B (exchange or trader profile → trade composer → submit).
2. B accepts → A should get email (if A has email trade alerts on and was the recipient of that transition).
3. Either party marks shipped → email to the other party.
4. Complete the trade after both mark received → completion email.

Use two browsers or incognito + normal, or two machines.

**Expected per step:**
- In-app alert in **My Alerts** (always, for milestone types above).
- Email with subject matching the in-app title (e.g. “Jane accepted your trade”), body with perfume context and link: `{APP_URL}/messages/{actorUserId}`.
- Preferences link at bottom of plain-text body.

**Push vs email:** Web push does **not** fire for `trade_received` (only accept/shipped/complete). Email **does** include new offers when enabled.

**Dev logs:** `[email] Sent trade email to ...` or `Skipped trade email ... emailTradeAlerts=false`.

---

## 5. Alert preferences API

Verify the new toggle persists:

1. Enable **Email Trade Updates** and save.
2. Refresh the page — toggle should stay on.
3. Optional: `GET /api/user-alerts/{userId}/preferences` (authenticated as that user) should include `"emailTradeAlerts": true`.

---

## 6. What does not send email

| Scenario | Reason |
|----------|--------|
| `RESEND_API_KEY` / `EMAIL_FROM` unset | `sendTransactionalEmail` returns `{ sent: false }` |
| Deleted account email (`deleted_*`) | `isSendableRecipientEmail` rejects |
| Email toggles off | Gating in `shouldSendWishlistEmail` / `shouldSendDecantEmail` / `shouldSendTradeEmail` |
| Wishlist/decant email with in-app type disabled | Wishlist/decant require both in-app + email flags |
| `trade_cancelled` / decline | Not in trade email allowlist |
| `receive` transition | No alert type, no email |

---

## 7. Production checklist

- [ ] Domain verified in Resend; `EMAIL_FROM` uses that domain
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set in production env
- [ ] `NEXT_PUBLIC_APP_URL` matches the public site URL
- [ ] Migration `20260518120000_add_email_trade_alerts` applied
- [ ] Smoke test script run against a real inbox on production-like config
- [ ] One full trade path tested with email enabled on a test account

---

## Related docs

- Web push (separate channel): `docs/testing-web-push.md`
- Env setup: `docs/new computer set up.md` (Resend section)
- Improvements backlog: IMP-063 shipped — see Wave A3 in `docs/improvements-v2.md`
