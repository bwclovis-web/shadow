# Subscribe paid signup

## 2026-08-23 — Model A: paid participation + tiered annual prices

- All new signups require Stripe Checkout first (`/subscribe?tier=member|premium|collector`).
- Annual prices: Member $5 / Premium $7 / Collector $10.
- Env: `STRIPE_PRICE_ID_MEMBER`, `STRIPE_PRICE_ID_PREMIUM`, `STRIPE_PRICE_ID_COLLECTOR` (see `.env.example`).
- Checkout session + subscription metadata include `membership_tier` (`member` | `premium` | `collector`).
- DB stores Member as `MembershipTier.free`; UI label is “Member”.
- Early adopters (`isEarlyAdopter`) are grandfathered for participation without payment.
- Participation APIs/pages require `subscriptionStatus === "paid"` or `isEarlyAdopter`.

## 2026-07-22 — `/subscribe` Stripe Checkout path shipped

- Signup redirected to `/subscribe?redirect=/sign-up` when free slots were exhausted (`FREE_USER_LIMIT`).
- Pages live under `app/(auth)/subscribe`: email form → `createCheckoutSession` → Stripe Checkout → `/subscribe/success` → `/sign-up?session_id=&email=`.
- Env (legacy): `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
- i18n: `subscribe` / `subscribeSuccess` keys in en/es/fr/it.
