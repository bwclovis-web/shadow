# Smoke test — Decant splits (D3 / IMP-F01)

Prerequisites: `DECANT_SPLITS_ENABLED` not set to `false`, dev server running, Prisma schema pushed, two test accounts (Host, Claimant).

## 1. Schema and budget

1. Host owns a perfume with ≥ 60 ml in collection (inventory).
2. `GET /api/decant-splits/budget?perfumeId=…` while signed in as Host returns `remainingPourableMl` ≥ 60.

## 2. Create split (Host)

1. **My Scents** → perfume → **Start group split**.
2. Pour 60 ml, 6 slots × 10 ml, accept disclaimer, create.
3. Redirects to `/splits/[id]`; status `open`, six `open` slots.

## 3. Exchange chip

1. Open **The Exchange**; perfume card shows **Group split · N slots open**.
2. Chip links to the same split page.

## 4. Claim slot (Claimant)

1. Sign in as Claimant; open split page.
2. Claim one slot → status `claimed`, host receives **split_slot_claimed** alert.

## 5. Paid and ship (Host)

1. Host marks slot **paid**.
2. Claim all remaining slots (or use second account) — or cancel and recreate for smaller test.
3. Host **Mark entire split shipped** → claimants get **split_shipped** (push if enabled, email if decant email on).

## 6. Receive and complete (Claimant)

1. Each claimant **Confirm received** on their slot.
2. When all slots `received`, split status `completed`.

## 7. Badge

1. Host profile shows **Decant host** contributor badge after first completed split.

## 8. Cancel path

1. New split with no claims → Host **Cancel split** → status `cancelled`, ml reservation released.

## 9. API negative cases

- Claim own split as host → 403.
- Claim when split shipped → 400.
- Create split exceeding pourable ml → 400 with budget message.
