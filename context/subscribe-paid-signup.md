# Subscribe paid signup

## 2026-08-23 — Model A: paid participation + tiered annual prices

- After **100 total users**, new signups require Stripe Checkout first (`/subscribe?tier=member|premium|collector`).
- While under 100 users: free signup at `/sign-up` (no checkout); new users get `isEarlyAdopter: true`.
- Participation (profile, APIs): `subscriptionStatus === "paid"`, `isEarlyAdopter`, **or** total users still under `FREE_USER_LIMIT` (100).
- Run `npm run backfill:early-adopters` once on prod to grandfather existing users before the limit is hit.
- Annual prices: Member $5 / Premium $7 / Collector $10.
- Env: `STRIPE_PRICE_ID_MEMBER`, `STRIPE_PRICE_ID_PREMIUM`, `STRIPE_PRICE_ID_COLLECTOR` (see `.env.example`).
- Checkout session + subscription metadata include `membership_tier` (`member` | `premium` | `collector`).
- DB stores Member as `MembershipTier.free`; UI label is “Member”.
- Early adopters (`isEarlyAdopter`) are grandfathered for participation without payment after the free window closes.
- Participation APIs/pages require `subscriptionStatus === "paid"` or `isEarlyAdopter`.

## 2026-07-22 — `/subscribe` Stripe Checkout path shipped

- Signup redirected to `/subscribe?redirect=/sign-up` when free slots were exhausted (`FREE_USER_LIMIT`).
- Pages live under `app/(auth)/subscribe`: email form → `createCheckoutSession` → Stripe Checkout → `/subscribe/success` → `/sign-up?session_id=&email=`.
- Env (legacy): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
- i18n: `subscribe` / `subscribeSuccess` keys in en/es/fr/it.
