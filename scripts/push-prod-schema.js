/**
 * Production schema sync (no row/data migration).
 *
 * This does NOT run `prisma migrate` or `prisma db push`. It executes ONE additive SQL file:
 *   prisma/migrations/APPLY_TO_REMOTE_DB.sql
 * via `prisma db execute` against REMOTE_DATABASE_URL.
 *
 * Regenerating the client (`npx prisma generate`) is optional here: verification uses raw SQL.
 * Run `prisma generate` separately when you need an updated @prisma/client after schema changes
 * (avoid running it while `next dev` / Studio hold the query engine on Windows — EPERM on rename).
 *
 * When you add a new Prisma model locally, append matching DDL to
 * APPLY_TO_REMOTE_DB.sql and/or `supplementalMigrations` below, or production
 * will stay out of sync and Prisma Studio / the app will error on missing columns.
 *
 * The SQL file is additive-only and designed to avoid data loss.
 *
 * Usage:
 *   npm run db:push:prod
 *   npm run db:push:prod:dry
 */

const { execSync } = require("child_process")
const { existsSync, readFileSync } = require("fs")
const { config } = require("dotenv")
const { resolve } = require("path")
const { PrismaClient } = require("@prisma/client")

config({ path: resolve(process.cwd(), ".env") })

const { REMOTE_DATABASE_URL } = process.env
const migrationFile = "prisma/migrations/APPLY_TO_REMOTE_DB.sql"
const dryRun = process.argv.includes("--dry-run")

/** Idempotent DDL applied after APPLY_TO_REMOTE_DB.sql — add entries when schema.prisma changes. */
const supplementalMigrations = [
  {
    label: "User.onboardingMatchesViewedAt",
    sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingMatchesViewedAt" TIMESTAMP(3);`,
  },
  {
    label: "ScentProfile.preferredConcentration, ScentProfile.preferredHouseTier",
    sql: `ALTER TABLE "ScentProfile" ADD COLUMN IF NOT EXISTS "preferredConcentration" TEXT, ADD COLUMN IF NOT EXISTS "preferredHouseTier" TEXT;`,
  },
  {
    label: "UserAlertPreferences push columns",
    sql: `ALTER TABLE "UserAlertPreferences" ADD COLUMN IF NOT EXISTS "pushEnabled" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "pushTradeAlerts" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS "pushMessageAlerts" BOOLEAN NOT NULL DEFAULT true;`,
  },
  {
    label: "UserPushSubscription table",
    sql: `
CREATE TABLE IF NOT EXISTS "UserPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserPushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserPushSubscription_endpoint_key" ON "UserPushSubscription"("endpoint");
CREATE INDEX IF NOT EXISTS "UserPushSubscription_userId_idx" ON "UserPushSubscription"("userId");
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserPushSubscription_userId_fkey'
    ) THEN
        ALTER TABLE "UserPushSubscription"
        ADD CONSTRAINT "UserPushSubscription_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`.trim(),
  },
  {
    label: "UserConversationPresence table",
    sql: `
CREATE TABLE IF NOT EXISTS "UserConversationPresence" (
    "userId" TEXT NOT NULL,
    "counterpartUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserConversationPresence_pkey" PRIMARY KEY ("userId")
);
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserConversationPresence_userId_fkey'
    ) THEN
        ALTER TABLE "UserConversationPresence"
        ADD CONSTRAINT "UserConversationPresence_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`.trim(),
  },
]

const executeSql = (sql, label) => {
  if (dryRun) {
    console.log(`-- ${label}`)
    console.log(sql)
    console.log("")
    return
  }
  console.log(`Applying: ${label}`)
  execSync(`npx prisma db execute --stdin --url "${REMOTE_DATABASE_URL}"`, {
    stdio: ["pipe", "inherit", "inherit"],
    input: sql,
  })
}

if (!REMOTE_DATABASE_URL) {
  console.error("ERROR: REMOTE_DATABASE_URL is not set in .env")
  process.exit(1)
}

if (!existsSync(resolve(process.cwd(), migrationFile))) {
  console.error(`ERROR: Migration file not found: ${migrationFile}`)
  process.exit(1)
}

console.log("Applying safe production schema migration...")
console.log(`Target: ${REMOTE_DATABASE_URL.substring(0, 60)}...`)
console.log(`SQL file: ${migrationFile}`)
console.log("")

if (dryRun) {
  const sql = readFileSync(resolve(process.cwd(), migrationFile), "utf8")
  console.log("DRY RUN: No changes will be applied.")
  console.log("The following SQL would be executed:")
  console.log("")
  console.log(`-- ${migrationFile}`)
  console.log(sql)
  console.log("")
  for (const { label, sql: supplementalSql } of supplementalMigrations) {
    executeSql(supplementalSql, label)
  }
  console.log("Dry run completed.")
  process.exit(0)
}

execSync(
  `npx prisma db execute --file "${migrationFile}" --url "${REMOTE_DATABASE_URL}"`,
  { stdio: "inherit" }
)

console.log("")
for (const { label, sql } of supplementalMigrations) {
  executeSql(sql, label)
}

console.log("")
console.log("Running post-sync verification against production...")

async function verifySchema() {
  const prisma = new PrismaClient({
    datasources: { db: { url: REMOTE_DATABASE_URL } },
  })

  try {
    const checks = await prisma.$queryRawUnsafe(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'ScentProfile'
        ) AS "hasScentProfile",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'TraderContactMessage'
        ) AS "hasTraderContactMessage",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'subscriptionStatus'
        ) AS "hasUserSubscriptionStatus",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'UserPerfumeReview' AND column_name = 'isApproved'
        ) AS "hasReviewIsApproved",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'tokenVersion'
        ) AS "hasUserTokenVersion",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'traderAbout'
        ) AS "hasUserTraderAbout",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'profileSlug'
        ) AS "hasUserProfileSlug",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'UserPerfumeSeasonVote'
        ) AS "hasUserPerfumeSeasonVote",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'DataQualityDailySnapshot'
        ) AS "hasDataQualityDailySnapshot",
        EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'PerfumeType' AND e.enumlabel = 'hairGloss'
        ) AS "hasPerfumeTypeHairGloss",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UserPerfumeWishlist'
            AND column_name = 'bottlePreference'
        ) AS "hasUserPerfumeWishlistBottlePreference",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'User'
            AND column_name = 'avatarImage'
        ) AS "hasUserAvatarImage",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'User'
            AND column_name = 'onboardingMatchesViewedAt'
        ) AS "hasUserOnboardingMatchesViewedAt",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'ScentProfile'
            AND column_name = 'preferredConcentration'
        ) AS "hasScentProfilePreferredConcentration",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'ScentProfile'
            AND column_name = 'preferredHouseTier'
        ) AS "hasScentProfilePreferredHouseTier",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UserAlertPreferences'
            AND column_name = 'pushEnabled'
        ) AS "hasUserAlertPreferencesPushEnabled",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UserAlertPreferences'
            AND column_name = 'pushTradeAlerts'
        ) AS "hasUserAlertPreferencesPushTradeAlerts",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UserAlertPreferences'
            AND column_name = 'pushMessageAlerts'
        ) AS "hasUserAlertPreferencesPushMessageAlerts",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'User'
            AND column_name = 'strikeCount'
        ) AS "hasUserStrikeCount",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UserPerfume'
            AND column_name = 'images'
        ) AS "hasUserPerfumeListingImages",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UserPerfume'
            AND column_name = 'condition'
        ) AS "hasUserPerfumeListingCondition",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'Trade'
        ) AS "hasTrade",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'UserStrike'
        ) AS "hasUserStrike",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'UserReport'
        ) AS "hasUserReport",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'UserPushSubscription'
        ) AS "hasUserPushSubscription",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'UserConversationPresence'
        ) AS "hasUserConversationPresence"
    `)

    const result = Array.isArray(checks) ? checks[0] : checks
    const required = [
      "hasUserAvatarImage",
      "hasUserOnboardingMatchesViewedAt",
      "hasScentProfilePreferredConcentration",
      "hasScentProfilePreferredHouseTier",
      "hasUserAlertPreferencesPushEnabled",
      "hasUserAlertPreferencesPushTradeAlerts",
      "hasUserAlertPreferencesPushMessageAlerts",
      "hasUserPushSubscription",
      "hasUserConversationPresence",
      "hasUserPerfumeListingImages",
      "hasUserPerfumeListingCondition",
      "hasTrade",
      "hasUserStrike",
      "hasUserReport",
    ]
    const missing = required.filter(key => !result[key])

    console.log("Verification result:")
    console.log(JSON.stringify(result, null, 2))
    console.log("")

    if (missing.length > 0) {
      console.error(
        "ERROR: Production is still missing Wave 1 schema after sync:",
        missing.join(", ")
      )
      console.error(
        "Review APPLY_TO_REMOTE_DB.sql / supplementalMigrations in push-prod-schema.js and re-run npm run db:push:prod"
      )
      process.exit(1)
    }

    console.log("Production schema sync completed.")
  } finally {
    await prisma.$disconnect()
  }
}

verifySchema().catch(error => {
  console.error("Verification failed:", error.message)
  process.exit(1)
})
