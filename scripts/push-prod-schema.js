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
    label: "User.lastActiveAt",
    sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);`,
  },
  {
    label: "ScentProfile.preferredConcentration, ScentProfile.preferredHouseTier",
    sql: `ALTER TABLE "ScentProfile" ADD COLUMN IF NOT EXISTS "preferredConcentration" TEXT, ADD COLUMN IF NOT EXISTS "preferredHouseTier" TEXT;`,
  },
  {
    label: "UserAlertPreferences email, follow, security, and push columns",
    sql: `
ALTER TABLE "UserAlertPreferences"
  ADD COLUMN IF NOT EXISTS "emailTradeAlerts" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailSecurityAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "securityAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "followAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "emailFollowAlerts" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pushTradeAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "pushMessageAlerts" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "pushFollowAlerts" BOOLEAN NOT NULL DEFAULT true;
`.trim(),
  },
  {
    label: "User two-factor and login-heuristic columns",
    sql: `
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "totpSecretEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "twoFactorEnabledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3);
`.trim(),
  },
  {
    label: "UserTwoFactorBackupCode table",
    sql: `
CREATE TABLE IF NOT EXISTS "UserTwoFactorBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTwoFactorBackupCode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UserTwoFactorBackupCode_userId_idx" ON "UserTwoFactorBackupCode"("userId");
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserTwoFactorBackupCode_userId_fkey'
    ) THEN
        ALTER TABLE "UserTwoFactorBackupCode"
        ADD CONSTRAINT "UserTwoFactorBackupCode_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`.trim(),
  },
  {
    label: "UserLoginEvent table",
    sql: `
CREATE TABLE IF NOT EXISTS "UserLoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "deviceFingerprint" TEXT NOT NULL,
    "countryCode" TEXT,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLoginEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "UserLoginEvent_userId_createdAt_idx" ON "UserLoginEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "UserLoginEvent_userId_deviceFingerprint_idx" ON "UserLoginEvent"("userId", "deviceFingerprint");
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserLoginEvent_userId_fkey'
    ) THEN
        ALTER TABLE "UserLoginEvent"
        ADD CONSTRAINT "UserLoginEvent_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`.trim(),
  },
  {
    label: "AlertType suspicious_login and followed_activity",
    sql: `
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'suspicious_login'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'suspicious_login';
    END IF;
END $$;
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'followed_activity'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'followed_activity';
    END IF;
END $$;
`.trim(),
  },
  {
    label: "TraderFeedback helpfulness columns and TraderFeedbackHelpfulnessVote",
    sql: `
DO $$ BEGIN
    CREATE TYPE "TraderFeedbackHelpfulness" AS ENUM ('helpful', 'unhelpful');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "TraderFeedback"
  ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unhelpfulCount" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS "TraderFeedbackHelpfulnessVote" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "value" "TraderFeedbackHelpfulness" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TraderFeedbackHelpfulnessVote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TraderFeedbackHelpfulnessVote_feedbackId_voterId_key"
  ON "TraderFeedbackHelpfulnessVote"("feedbackId", "voterId");
CREATE INDEX IF NOT EXISTS "TraderFeedbackHelpfulnessVote_feedbackId_idx"
  ON "TraderFeedbackHelpfulnessVote"("feedbackId");
CREATE INDEX IF NOT EXISTS "TraderFeedbackHelpfulnessVote_voterId_idx"
  ON "TraderFeedbackHelpfulnessVote"("voterId");
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TraderFeedbackHelpfulnessVote_feedbackId_fkey'
    ) THEN
        ALTER TABLE "TraderFeedbackHelpfulnessVote"
        ADD CONSTRAINT "TraderFeedbackHelpfulnessVote_feedbackId_fkey"
        FOREIGN KEY ("feedbackId") REFERENCES "TraderFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TraderFeedbackHelpfulnessVote_voterId_fkey'
    ) THEN
        ALTER TABLE "TraderFeedbackHelpfulnessVote"
        ADD CONSTRAINT "TraderFeedbackHelpfulnessVote_voterId_fkey"
        FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`.trim(),
  },
  {
    label: "TradeDispute enums and table",
    sql: `
DO $$ BEGIN
    CREATE TYPE "DisputeCategory" AS ENUM ('noShip', 'fakeItem', 'notAsDescribed', 'scam', 'other');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE "DisputeStatus" AS ENUM ('open', 'underReview', 'resolved', 'closed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE TYPE "DisputeResolutionOutcome" AS ENUM ('noAction', 'warningIssued', 'strikeIssued', 'tradeVoided');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
CREATE TABLE IF NOT EXISTS "TradeDispute" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "otherPartyUserId" TEXT NOT NULL,
    "category" "DisputeCategory" NOT NULL,
    "description" TEXT,
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "adminNotes" TEXT,
    "resolutionOutcome" "DisputeResolutionOutcome",
    "publicSummary" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeDispute_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TradeDispute_status_createdAt_idx" ON "TradeDispute"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "TradeDispute_tradeId_idx" ON "TradeDispute"("tradeId");
CREATE INDEX IF NOT EXISTS "TradeDispute_initiatedByUserId_idx" ON "TradeDispute"("initiatedByUserId");
CREATE INDEX IF NOT EXISTS "TradeDispute_otherPartyUserId_idx" ON "TradeDispute"("otherPartyUserId");
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TradeDispute_tradeId_fkey'
    ) THEN
        ALTER TABLE "TradeDispute"
        ADD CONSTRAINT "TradeDispute_tradeId_fkey"
        FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TradeDispute_initiatedByUserId_fkey'
    ) THEN
        ALTER TABLE "TradeDispute"
        ADD CONSTRAINT "TradeDispute_initiatedByUserId_fkey"
        FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TradeDispute_otherPartyUserId_fkey'
    ) THEN
        ALTER TABLE "TradeDispute"
        ADD CONSTRAINT "TradeDispute_otherPartyUserId_fkey"
        FOREIGN KEY ("otherPartyUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TradeDispute_resolvedByAdminId_fkey'
    ) THEN
        ALTER TABLE "TradeDispute"
        ADD CONSTRAINT "TradeDispute_resolvedByAdminId_fkey"
        FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
`.trim(),
  },
  {
    label: "UserFollow table",
    sql: `
CREATE TABLE IF NOT EXISTS "UserFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingUserId" TEXT,
    "followingHouseId" TEXT,
    "followingPerfumeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserFollow_followerId_followingUserId_key"
  ON "UserFollow"("followerId", "followingUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserFollow_followerId_followingHouseId_key"
  ON "UserFollow"("followerId", "followingHouseId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserFollow_followerId_followingPerfumeId_key"
  ON "UserFollow"("followerId", "followingPerfumeId");
CREATE INDEX IF NOT EXISTS "UserFollow_followingUserId_idx" ON "UserFollow"("followingUserId");
CREATE INDEX IF NOT EXISTS "UserFollow_followingHouseId_idx" ON "UserFollow"("followingHouseId");
CREATE INDEX IF NOT EXISTS "UserFollow_followingPerfumeId_idx" ON "UserFollow"("followingPerfumeId");
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserFollow_followerId_fkey'
    ) THEN
        ALTER TABLE "UserFollow"
        ADD CONSTRAINT "UserFollow_followerId_fkey"
        FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserFollow_followingUserId_fkey'
    ) THEN
        ALTER TABLE "UserFollow"
        ADD CONSTRAINT "UserFollow_followingUserId_fkey"
        FOREIGN KEY ("followingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserFollow_followingHouseId_fkey'
    ) THEN
        ALTER TABLE "UserFollow"
        ADD CONSTRAINT "UserFollow_followingHouseId_fkey"
        FOREIGN KEY ("followingHouseId") REFERENCES "PerfumeHouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserFollow_followingPerfumeId_fkey'
    ) THEN
        ALTER TABLE "UserFollow"
        ADD CONSTRAINT "UserFollow_followingPerfumeId_fkey"
        FOREIGN KEY ("followingPerfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`.trim(),
  },
  {
    label: "ScraperSource, ScraperRun, ScraperRunItem tables",
    sql: `
CREATE TABLE IF NOT EXISTS "ScraperSource" (
    "id" TEXT NOT NULL,
    "houseName" TEXT NOT NULL,
    "baseUrl" TEXT,
    "platformType" TEXT,
    "configJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastRunAt" TIMESTAMP(3),
    "lastDiscoveredCount" INTEGER,
    "lastScrapedCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScraperSource_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "ScraperRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "configJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "discoveredCount" INTEGER,
    "scrapedCount" INTEGER,
    "importedCount" INTEGER,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScraperRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "ScraperRunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "detailURL" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawJson" JSONB,
    "qualityScore" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScraperRunItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ScraperRunItem_runId_status_idx" ON "ScraperRunItem"("runId", "status");
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ScraperRun_sourceId_fkey'
    ) THEN
        ALTER TABLE "ScraperRun"
        ADD CONSTRAINT "ScraperRun_sourceId_fkey"
        FOREIGN KEY ("sourceId") REFERENCES "ScraperSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ScraperRunItem_runId_fkey'
    ) THEN
        ALTER TABLE "ScraperRunItem"
        ADD CONSTRAINT "ScraperRunItem_runId_fkey"
        FOREIGN KEY ("runId") REFERENCES "ScraperRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
`.trim(),
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
        ) AS "hasUserConversationPresence",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UserAlertPreferences'
            AND column_name = 'emailTradeAlerts'
        ) AS "hasUserAlertPreferencesEmailTradeAlerts",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'UserAlertPreferences'
            AND column_name = 'pushFollowAlerts'
        ) AS "hasUserAlertPreferencesPushFollowAlerts",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'User'
            AND column_name = 'totpSecretEncrypted'
        ) AS "hasUserTotpSecretEncrypted",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'UserTwoFactorBackupCode'
        ) AS "hasUserTwoFactorBackupCode",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'UserLoginEvent'
        ) AS "hasUserLoginEvent",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'TradeDispute'
        ) AS "hasTradeDispute",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'UserFollow'
        ) AS "hasUserFollow",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'TraderFeedbackHelpfulnessVote'
        ) AS "hasTraderFeedbackHelpfulnessVote",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'TraderFeedback'
            AND column_name = 'helpfulCount'
        ) AS "hasTraderFeedbackHelpfulCount"
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
      "hasUserAlertPreferencesEmailTradeAlerts",
      "hasUserAlertPreferencesPushFollowAlerts",
      "hasUserPushSubscription",
      "hasUserConversationPresence",
      "hasUserTotpSecretEncrypted",
      "hasUserTwoFactorBackupCode",
      "hasUserLoginEvent",
      "hasTradeDispute",
      "hasUserFollow",
      "hasTraderFeedbackHelpfulnessVote",
      "hasTraderFeedbackHelpfulCount",
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
        "ERROR: Production is still missing schema after sync:",
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
