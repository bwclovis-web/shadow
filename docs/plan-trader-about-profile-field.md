# Trader About Profile Field (updated)

## Summary

- **Where it's edited:** User profile form at `/[userSlug]/profile`.
- **Where it's shown:** Trader profile at `/trader-profile/[id]`.
- **Constraints:** Nullable, max length from constant `PROFILE_LENGTH` (default 500), sanitized (no scripts/HTML/CSS).

## 1. Constants and validation

- **Add `PROFILE_LENGTH`** in **[utils/constants.ts](utils/constants.ts)** (app-wide constants): e.g. `export const PROFILE_LENGTH = 500`.
- **Validation:** In [utils/validation/fieldSchemas.ts](utils/validation/fieldSchemas.ts), add a reusable schema for trader about: optional string, max length from `PROFILE_LENGTH` (import from `@/utils/constants`), `.trim()`, then `.transform(sanitizeInput)`.
- **Validation key:** In [utils/validation/validationKeys.ts](utils/validation/validationKeys.ts) add e.g. `profileAboutMax`. In [utils/validation/formValidationSchemas.ts](utils/validation/formValidationSchemas.ts), add `traderAbout` to `UpdateProfileSchema` (nullable/optional).
- **i18n:** Add `profile.traderAbout`, `profile.traderAboutHint`, and `validation.profileAboutMax` in `messages/*.json`.

## 2. Database and types

- **Prisma:** In [prisma/schema.prisma](prisma/schema.prisma), add to `User`: `traderAbout String?`.
- **Schema sync:** Use **`npm run db:push`** to apply schema changes (do **not** run `prisma migrate`).
- **Types:** In [models/user.query.ts](models/user.query.ts), add `traderAbout?: string | null` to `UpdateUserProfilePayload` and pass it in `updateUser` `data`.
- **SafeUser:** No change; it will include `traderAbout` after schema update.

## 3. Profile edit flow

- **Action:** [app/[userSlug]/profile/actions.ts](app/[userSlug]/profile/actions.ts) — include `traderAbout` from schema, pass to `updateUser`.
- **Form:** [app/[userSlug]/profile/ProfileClient.tsx](app/[userSlug]/profile/ProfileClient.tsx) — textarea for `traderAbout`, default `user.traderAbout ?? ""`, optional character counter using `PROFILE_LENGTH`.

## 4. Trader profile display and data

- **Select:** [models/user.server.ts](models/user.server.ts) — in `getTraderById` add `traderAbout: true`.
- **TraderResponse:** [lib/queries/user.ts](lib/queries/user.ts) — add `traderAbout?: string | null`.
- **UI:** [app/trader-profile/[id]/TraderProfileClient.tsx](app/trader-profile/[id]/TraderProfileClient.tsx) — "About" section when `trader.traderAbout` is set; render as **plain text** only (no HTML).

## 5. Sanitization

- **Input:** Schema uses `sanitizeInput`. Optionally run through `sanitizeText` in the action before DB write.
- **Output:** Render as text only on trader profile (no `dangerouslySetInnerHTML`).

## Files to touch

| Area | File |
|------|------|
| Constant | **utils/constants.ts** – `PROFILE_LENGTH` |
| Schema | prisma/schema.prisma – `User.traderAbout` |
| Validation | fieldSchemas, validationKeys, formValidationSchemas |
| Profile | user.query (payload + updateUser), profile actions, ProfileClient |
| Trader | user.server (getTraderById select), lib/queries/user (TraderResponse), TraderProfileClient |
| i18n | messages/en.json (and other locales) |

**Database:** After editing `schema.prisma`, run `npm run db:push` (do not run `prisma migrate`).
