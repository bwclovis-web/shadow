# Testing Web Push Notifications

Guide for manually testing **Wave 2G** browser push (trade updates, new messages, nav badges). Push is **additive**: in-app alerts in **My Alerts** still work; push is an extra channel when the user opts in.

Related code: `public/sw.js`, `app/api/push/*`, `components/Containers/UserAlerts/PushNotificationSection.tsx`, `utils/push-notification.server.ts`.

---

## Prerequisites

### 1. Database schema

Push needs tables from `prisma/schema.prisma` (`UserPushSubscription`, `UserConversationPresence`, push columns on `UserAlertPreferences`).

If you have not migrated yet:

```bash
npx prisma migrate deploy
# or when authoring a new migration:
# npx prisma migrate dev --name add_web_push_subscriptions
npm run db:generate
```

See [database.md](./database.md) — this project uses **Prisma Migrate only**, not `db push`.

### 2. VAPID keys

Generate keys and add them to `.env`:

```bash
node scripts/generate-vapid-keys.mjs
```

Required variables:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser subscription |
| `VAPID_PRIVATE_KEY` | Server signing (secret) |
| `VAPID_SUBJECT` | `mailto:you@domain.com` or `https://your-site.com` |

Restart the app after changing `.env`.

Verify configuration:

```bash
curl http://localhost:3000/api/push/vapid-public-key
```

Expect `{ "publicKey": "...", "configured": true }`. If `configured` is `false`, keys are missing or invalid.

### 3. Browser

Use **Chrome** or **Edge** on desktop for the simplest experience. Firefox works; Safari has extra constraints (installed PWA / newer Safari versions).

Allow notifications for your origin when prompted (`http://localhost:3000` is fine).

### 4. How to run the app

The service worker is **disabled in `npm run dev` by default** (it previously broke Next.js navigation). Use one of:

| Mode | Command | Service worker |
|------|---------|----------------|
| **Recommended** | `npm run build && npm run start` | On |
| Dev with push | Add `NEXT_PUBLIC_ENABLE_PUSH_DEV=true` to `.env`, then `npm run dev` | On |

Open **http://localhost:3000** (HTTPS required in production; localhost is allowed for push).

### 5. Two test accounts

Most flows need **User A** and **User B** (two browsers, or one normal window + one incognito).

---

## Enable push (opt-in)

1. Sign in as **User A**.
2. Go to **Profile** → **My Alerts** → **Alert Preferences** → **Edit**.
3. Under **Push Notifications**, click **Enable push notifications**.
4. Click **Allow** in the browser permission dialog.
5. Confirm toggles:
   - **Trade updates** — `trade_accepted`, `trade_shipped`, `trade_completed`
   - **New messages** — when you are not active in that conversation

**Verify subscription saved**

| Check | Expected |
|-------|----------|
| Network: `POST /api/push/subscribe` | `200` |
| DevTools → Application → Service Workers | `sw.js` activated |
| DB: `UserPushSubscription` | Row for User A with `endpoint`, `p256dh`, `auth` |
| DB: `UserAlertPreferences.pushEnabled` | `true` |

**Disable push:** same section → **Disable push notifications** → `POST /api/push/unsubscribe`, `pushEnabled` false.

---

## Test trade push

Recipient must have push enabled and **Trade updates** on.

1. **A** proposes a trade to **B** (exchange listing or trader profile → trade composer).
2. **B** accepts the trade (thread or `TradeStatusCard`).

**Expected for A (if A has push enabled and is the party who gets the alert):**

- In-app alert in **My Alerts** (`trade_accepted`)
- OS/browser notification with title/body
- Click notification → opens `/messages/{otherUserId}` for that trade

Repeat for:

| Action | Alert type |
|--------|------------|
| Mark as shipped | `trade_shipped` |
| Complete trade | `trade_completed` |

`trade_received` creates an in-app alert; push is sent only for the three types above when prefs allow.

---

## Test message push

Tests **IMP-173**: no push when the recipient is **focused in that thread**; push when they are not.

1. **A** enables push with **New messages** on.
2. **A** and **B** have an existing message thread.

**Scenario A — should NOT push**

1. **A** opens `/messages/{B}` and keeps that tab **visible and focused**.
2. **B** sends a message.

**Expected:** In-app alert may appear; **no** browser push (presence heartbeat reports active conversation).

**Scenario B — should push**

1. **A** switches to another tab, minimizes the window, or navigates away from the thread.
2. Wait a few seconds (presence updates on visibility/focus and every ~30s).
3. **B** sends another message.

**Expected:** Browser push notification; click opens `/messages/{B}`.

Presence is stored in `UserConversationPresence` via `POST /api/push/presence` from `ThreadClient`.

---

## Test nav badge (trade alerts)

1. As a user with **unread** trade alerts (`trade_*` types, not dismissed).

**Expected on main nav → Messages:**

- **Blue** badge — unread direct messages
- **Gold** badge — unread **trade** alerts (separate count)

2. Mark trade alerts read in **My Alerts**.

**Expected:** Gold badge decreases (refresh or within ~30s polling).

---

## Quick checklist

- [ ] Migration applied; `db:generate` run
- [ ] VAPID keys in `.env`; `/api/push/vapid-public-key` returns `configured: true`
- [ ] App running via `build && start` (or dev + `NEXT_PUBLIC_ENABLE_PUSH_DEV=true`)
- [ ] User opted in via Alert Preferences; permission granted
- [ ] Trade accept/shipped/complete → notification to other party
- [ ] Message with thread focused → no push; tab away → push
- [ ] Gold trade badge on Messages when unread trade alerts exist

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| **Push is not configured on this server** | Set all three VAPID env vars; restart server |
| **No service worker in dev** | Use `npm run build && npm run start`, or `NEXT_PUBLIC_ENABLE_PUSH_DEV=true` |
| **Permission denied** | Site settings → Notifications → Allow for localhost |
| **Subscribe returns 503** | VAPID not configured on server |
| **In-app alert works, no push** | User has not enabled push, no `UserPushSubscription` row, or trade/message toggle off |
| **Navigation broken / Failed to fetch** | Old SW with fetch handler: DevTools → Application → Service Workers → **Unregister**, hard refresh. Current `sw.js` does not intercept fetch |
| **Stale SW** | Hard refresh (`Ctrl+Shift+R`); confirm `new-smell-v2` cache name in `sw.js` |
| **Prisma errors on subscribe** | Run pending migrations (`npx prisma migrate deploy` or `migrate dev`) |
| **Safari** | Use supported version; may require Add to Home Screen on iOS |

### Inspect server-side send

Server logs may show `[push] Failed to send notification:` if the subscription expired (404/410 removes the row automatically).

### Unit tests

```bash
npm run test -- utils/push-notification.server.test.ts
```

---

## Production smoke test

1. Deploy with VAPID env vars set on the host (same names as local).
2. Run `npx prisma migrate deploy` on production DB.
3. Opt in on a real HTTPS URL.
4. Run one trade transition and one off-thread message between two test accounts.

---

## Reference: API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/push/vapid-public-key` | GET | Public key for subscribe |
| `/api/push/subscribe` | POST | Save subscription (auth + CSRF) |
| `/api/push/unsubscribe` | POST | Remove subscription |
| `/api/push/presence` | POST | Active conversation (suppress message push) |
