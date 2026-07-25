# Subscribe paid signup

## 2026-07-22 — `/subscribe` Stripe Checkout path shipped

- Signup already redirected to `/subscribe?redirect=/sign-up` when `canSignupForFree()` is false (`FREE_USER_LIMIT` in `utils/server/user-limit.server.ts`).
- Pages live under `app/(auth)/subscribe` (reuses auth noir layout): email form → `createCheckoutSession` → Stripe Checkout → `/subscribe/success` → `/sign-up?session_id=&email=`.
- Env: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` (documented in `.env.example`).
- i18n: `subscribe` / `subscribeSuccess` keys in en/es/fr/it.
