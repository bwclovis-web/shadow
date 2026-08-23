-- CreateEnum
CREATE TYPE "NoteMaterialAliasSource" AS ENUM ('seed', 'rule', 'manual');

-- CreateEnum
CREATE TYPE "TraderFeedbackHelpfulness" AS ENUM ('helpful', 'unhelpful');

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('free', 'premium', 'collector');

-- CreateEnum
CREATE TYPE "TasteEventType" AS ENUM ('quiz_answer', 'rating', 'dislike', 'skip_recommendation', 'owned', 'wishlist', 'sample_outcome', 'wear', 'season_pref', 'budget_pref', 'projection_pref', 'longevity_pref', 'compare');

-- CreateEnum
CREATE TYPE "RecommendationFeedbackAction" AS ENUM ('not_for_me', 'already_own', 'sampled', 'more_like_this');

-- CreateEnum
CREATE TYPE "SamplingQueueStatus" AS ENUM ('queued', 'sampling', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "ScraperJobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "WishlistBottlePreference" AS ENUM ('sample', 'partial', 'full', 'any');

-- CreateEnum
CREATE TYPE "DecantSplitStatus" AS ENUM ('open', 'filling', 'shipped', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "DecantSplitSlotStatus" AS ENUM ('open', 'claimed', 'paid', 'received', 'released');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('draft', 'pending', 'accepted', 'shipped', 'received', 'completed', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "TradeLineItemRole" AS ENUM ('offered', 'requested');

-- CreateEnum
CREATE TYPE "ListingCondition" AS ENUM ('sealed', 'mint', 'lightlyUsed', 'heavilyUsed', 'damaged');

-- CreateEnum
CREATE TYPE "DecantFormat" AS ENUM ('atomizer', 'vial', 'original');

-- CreateEnum
CREATE TYPE "UserReportCategory" AS ENUM ('scam', 'fakeItem', 'harassment', 'noShip', 'other');

-- CreateEnum
CREATE TYPE "UserReportStatus" AS ENUM ('inProgress', 'settled', 'passed');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('noShip', 'fakeItem', 'notAsDescribed', 'scam', 'other');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'underReview', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "DisputeResolutionOutcome" AS ENUM ('noAction', 'warningIssued', 'strikeIssued', 'tradeVoided');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertType" ADD VALUE 'submission_approved';
ALTER TYPE "AlertType" ADD VALUE 'submission_rejected';
ALTER TYPE "AlertType" ADD VALUE 'new_trader_message';
ALTER TYPE "AlertType" ADD VALUE 'trade_received';
ALTER TYPE "AlertType" ADD VALUE 'trade_accepted';
ALTER TYPE "AlertType" ADD VALUE 'trade_shipped';
ALTER TYPE "AlertType" ADD VALUE 'trade_completed';
ALTER TYPE "AlertType" ADD VALUE 'trade_cancelled';
ALTER TYPE "AlertType" ADD VALUE 'suspicious_login';
ALTER TYPE "AlertType" ADD VALUE 'followed_activity';
ALTER TYPE "AlertType" ADD VALUE 'split_slot_claimed';
ALTER TYPE "AlertType" ADD VALUE 'split_shipped';
ALTER TYPE "AlertType" ADD VALUE 'split_completed';
ALTER TYPE "AlertType" ADD VALUE 'split_cancelled';

-- AlterEnum
ALTER TYPE "PerfumeType" ADD VALUE 'hairGloss';

-- DropForeignKey
ALTER TABLE "UserAlert" DROP CONSTRAINT "UserAlert_perfumeId_fkey";

-- DropIndex
DROP INDEX "Perfume_name_key";

-- DropIndex
DROP INDEX "idx_review_perfume_created";

-- DropIndex
DROP INDEX "idx_wishlist_user_created";

-- AlterTable
ALTER TABLE "Perfume" ADD COLUMN     "isPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "merchantNotesText" TEXT,
ADD COLUMN     "pendingSubmissionId" TEXT,
ADD COLUMN     "submittedBy" TEXT;

-- AlterTable
ALTER TABLE "PerfumeHouse" ADD COLUMN     "isPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pendingSubmissionId" TEXT,
ADD COLUMN     "submittedBy" TEXT;

-- AlterTable
ALTER TABLE "PerfumeNotes" ADD COLUMN     "perfumeCloseId" TEXT,
ADD COLUMN     "perfumeHeartId" TEXT,
ADD COLUMN     "perfumeOpenId" TEXT;

-- AlterTable
ALTER TABLE "ScentProfile" ADD COLUMN     "materialAvoidIds" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "materialWeights" JSONB NOT NULL DEFAULT '{}',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TraderContactMessage" ADD COLUMN     "tradeId" TEXT;

-- AlterTable
ALTER TABLE "TraderFeedback" ADD COLUMN     "helpfulCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tradeId" TEXT,
ADD COLUMN     "unhelpfulCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarImage" TEXT,
ADD COLUMN     "fragranticaUrl" TEXT,
ADD COLUMN     "instagramHandle" TEXT,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "membershipTier" "MembershipTier" NOT NULL DEFAULT 'free',
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "profileSlug" TEXT,
ADD COLUMN     "redditUsername" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "strikeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "traderAbout" TEXT,
ALTER COLUMN "username" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserAlert" ALTER COLUMN "perfumeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserAlertPreferences" ADD COLUMN     "emailFollowAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailSecurityAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailSubmissionAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "followAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pushFollowAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushMessageAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushSubmissionAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pushTradeAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "securityAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "UserPerfume" ADD COLUMN     "condition" "ListingCondition",
ADD COLUMN     "decantFormat" "DecantFormat",
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mlRemaining" DOUBLE PRECISION,
ADD COLUMN     "pausedAvailable" TEXT,
ADD COLUMN     "pendingSubmissionId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserPerfumeReview" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserPerfumeWishlist" ADD COLUMN     "bottlePreference" "WishlistBottlePreference" NOT NULL DEFAULT 'any',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "DataQualityDailySnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "totalMissing" INTEGER NOT NULL,
    "totalDuplicates" INTEGER NOT NULL,
    "totalMissingHouseInfo" INTEGER NOT NULL,
    "totalHousesNoPerfumes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQualityDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerfumeSeasonVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "winter" BOOLEAN NOT NULL DEFAULT false,
    "spring" BOOLEAN NOT NULL DEFAULT false,
    "summer" BOOLEAN NOT NULL DEFAULT false,
    "fall" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPerfumeSeasonVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteMaterial" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteMaterialAlias" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "source" "NoteMaterialAliasSource" NOT NULL DEFAULT 'seed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteMaterialAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TraderFeedbackHelpfulnessVote" (
    "id" TEXT NOT NULL,
    "feedbackId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "value" "TraderFeedbackHelpfulness" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TraderFeedbackHelpfulnessVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByHash" TEXT,
    "reuseDetectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TasteEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT,
    "eventType" "TasteEventType" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TasteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "action" "RecommendationFeedbackAction" NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastMatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearchAlert" (
    "id" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearchAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SamplingQueueItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "status" "SamplingQueueStatus" NOT NULL DEFAULT 'queued',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SamplingQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionShelf" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "challengeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionShelf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionShelfItem" (
    "id" TEXT NOT NULL,
    "shelfId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionShelfItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserListItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WearJournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "wornOn" DATE NOT NULL,
    "season" TEXT,
    "rating" INTEGER,
    "notes" TEXT,
    "weather" TEXT,
    "occasion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WearJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityChallenge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityChallengeEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityChallengeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperJob" (
    "id" TEXT NOT NULL,
    "status" "ScraperJobStatus" NOT NULL DEFAULT 'queued',
    "collectionUrl" TEXT NOT NULL,
    "houseName" TEXT,
    "platform" TEXT,
    "configJson" JSONB,
    "progressJson" JSONB,
    "resultJson" JSONB,
    "partialScrapedJson" JSONB,
    "partialRecordsJson" JSONB,
    "errorMessage" TEXT,
    "createdByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelRequested" BOOLEAN NOT NULL DEFAULT false,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "resumeStage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingUserId" TEXT,
    "followingHouseId" TEXT,
    "followingPerfumeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConversationPresence" (
    "userId" TEXT NOT NULL,
    "counterpartUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserConversationPresence_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeLineItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "userPerfumeId" TEXT NOT NULL,
    "role" "TradeLineItemRole" NOT NULL,
    "perfumeName" TEXT NOT NULL,
    "mlSnapshot" DOUBLE PRECISION,
    "conditionSnapshot" "ListingCondition",

    CONSTRAINT "TradeLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeEvent" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecantSplit" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "sourceUserPerfumeId" TEXT,
    "totalMl" DOUBLE PRECISION NOT NULL,
    "status" "DecantSplitStatus" NOT NULL DEFAULT 'open',
    "priceHint" TEXT,
    "notes" TEXT,
    "decantFormat" "DecantFormat",
    "condition" "ListingCondition",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DecantSplit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecantSplitSlot" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "ml" DOUBLE PRECISION NOT NULL,
    "status" "DecantSplitSlotStatus" NOT NULL DEFAULT 'open',
    "claimantUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "DecantSplitSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecantSplitEvent" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecantSplitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStrike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStrike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "category" "UserReportCategory" NOT NULL,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "UserReportStatus" NOT NULL DEFAULT 'inProgress',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeDispute" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "otherPartyUserId" TEXT NOT NULL,
    "category" "DisputeCategory" NOT NULL,
    "description" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "adminNotes" TEXT,
    "resolutionOutcome" "DisputeResolutionOutcome",
    "publicSummary" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperSource" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperRun" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScraperRunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "detailURL" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rawJson" JSONB,
    "qualityScore" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScraperRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataQualityDailySnapshot_snapshotDate_key" ON "DataQualityDailySnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "idx_season_vote_perfume" ON "UserPerfumeSeasonVote"("perfumeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPerfumeSeasonVote_userId_perfumeId_key" ON "UserPerfumeSeasonVote"("userId", "perfumeId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteMaterial_slug_key" ON "NoteMaterial"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "NoteMaterialAlias_noteId_key" ON "NoteMaterialAlias"("noteId");

-- CreateIndex
CREATE INDEX "NoteMaterialAlias_materialId_idx" ON "NoteMaterialAlias"("materialId");

-- CreateIndex
CREATE INDEX "TraderFeedbackHelpfulnessVote_feedbackId_idx" ON "TraderFeedbackHelpfulnessVote"("feedbackId");

-- CreateIndex
CREATE INDEX "TraderFeedbackHelpfulnessVote_voterId_idx" ON "TraderFeedbackHelpfulnessVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "TraderFeedbackHelpfulnessVote_feedbackId_voterId_key" ON "TraderFeedbackHelpfulnessVote"("feedbackId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_key_key" ON "RateLimitBucket"("key");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshSession_userId_revokedAt_idx" ON "RefreshSession"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshSession_familyId_idx" ON "RefreshSession"("familyId");

-- CreateIndex
CREATE INDEX "RefreshSession_expiresAt_idx" ON "RefreshSession"("expiresAt");

-- CreateIndex
CREATE INDEX "TasteEvent_userId_createdAt_idx" ON "TasteEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TasteEvent_userId_eventType_idx" ON "TasteEvent"("userId", "eventType");

-- CreateIndex
CREATE INDEX "TasteEvent_perfumeId_idx" ON "TasteEvent"("perfumeId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userId_createdAt_idx" ON "RecommendationFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_perfumeId_idx" ON "RecommendationFeedback"("perfumeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationFeedback_userId_perfumeId_action_key" ON "RecommendationFeedback"("userId", "perfumeId", "action");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_alertEnabled_idx" ON "SavedSearch"("userId", "alertEnabled");

-- CreateIndex
CREATE INDEX "SavedSearchAlert_savedSearchId_isRead_createdAt_idx" ON "SavedSearchAlert"("savedSearchId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "SamplingQueueItem_userId_status_idx" ON "SamplingQueueItem"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SamplingQueueItem_userId_perfumeId_key" ON "SamplingQueueItem"("userId", "perfumeId");

-- CreateIndex
CREATE INDEX "CollectionShelf_userId_sortOrder_idx" ON "CollectionShelf"("userId", "sortOrder");

-- CreateIndex
CREATE INDEX "CollectionShelf_challengeId_idx" ON "CollectionShelf"("challengeId");

-- CreateIndex
CREATE INDEX "CollectionShelfItem_perfumeId_idx" ON "CollectionShelfItem"("perfumeId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionShelfItem_shelfId_perfumeId_key" ON "CollectionShelfItem"("shelfId", "perfumeId");

-- CreateIndex
CREATE INDEX "UserList_userId_createdAt_idx" ON "UserList"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserListItem_listId_perfumeId_key" ON "UserListItem"("listId", "perfumeId");

-- CreateIndex
CREATE INDEX "WearJournalEntry_userId_wornOn_idx" ON "WearJournalEntry"("userId", "wornOn");

-- CreateIndex
CREATE INDEX "WearJournalEntry_perfumeId_idx" ON "WearJournalEntry"("perfumeId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityChallenge_slug_key" ON "CommunityChallenge"("slug");

-- CreateIndex
CREATE INDEX "CommunityChallengeEntry_userId_idx" ON "CommunityChallengeEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityChallengeEntry_challengeId_userId_key" ON "CommunityChallengeEntry"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "ScraperJob_status_createdAt_idx" ON "ScraperJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ScraperJob_createdByUserId_idx" ON "ScraperJob"("createdByUserId");

-- CreateIndex
CREATE INDEX "ScraperJob_status_lockedAt_idx" ON "ScraperJob"("status", "lockedAt");

-- CreateIndex
CREATE INDEX "ScraperJob_lastHeartbeatAt_idx" ON "ScraperJob"("lastHeartbeatAt");

-- CreateIndex
CREATE INDEX "UserFollow_followingUserId_idx" ON "UserFollow"("followingUserId");

-- CreateIndex
CREATE INDEX "UserFollow_followingHouseId_idx" ON "UserFollow"("followingHouseId");

-- CreateIndex
CREATE INDEX "UserFollow_followingPerfumeId_idx" ON "UserFollow"("followingPerfumeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerId_followingUserId_key" ON "UserFollow"("followerId", "followingUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerId_followingHouseId_key" ON "UserFollow"("followerId", "followingHouseId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFollow_followerId_followingPerfumeId_key" ON "UserFollow"("followerId", "followingPerfumeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPushSubscription_endpoint_key" ON "UserPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "UserPushSubscription_userId_idx" ON "UserPushSubscription"("userId");

-- CreateIndex
CREATE INDEX "Trade_initiatorId_status_idx" ON "Trade"("initiatorId", "status");

-- CreateIndex
CREATE INDEX "Trade_counterpartyId_status_idx" ON "Trade"("counterpartyId", "status");

-- CreateIndex
CREATE INDEX "Trade_status_updatedAt_idx" ON "Trade"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TradeLineItem_tradeId_idx" ON "TradeLineItem"("tradeId");

-- CreateIndex
CREATE INDEX "TradeLineItem_userPerfumeId_idx" ON "TradeLineItem"("userPerfumeId");

-- CreateIndex
CREATE INDEX "TradeEvent_tradeId_createdAt_idx" ON "TradeEvent"("tradeId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeEvent_actorUserId_idx" ON "TradeEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "DecantSplit_hostUserId_status_idx" ON "DecantSplit"("hostUserId", "status");

-- CreateIndex
CREATE INDEX "DecantSplit_perfumeId_status_idx" ON "DecantSplit"("perfumeId", "status");

-- CreateIndex
CREATE INDEX "DecantSplitSlot_splitId_status_idx" ON "DecantSplitSlot"("splitId", "status");

-- CreateIndex
CREATE INDEX "DecantSplitSlot_claimantUserId_idx" ON "DecantSplitSlot"("claimantUserId");

-- CreateIndex
CREATE INDEX "DecantSplitEvent_splitId_createdAt_idx" ON "DecantSplitEvent"("splitId", "createdAt");

-- CreateIndex
CREATE INDEX "DecantSplitEvent_actorUserId_idx" ON "DecantSplitEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "UserStrike_userId_createdAt_idx" ON "UserStrike"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserStrike_issuedBy_idx" ON "UserStrike"("issuedBy");

-- CreateIndex
CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserReport_reportedUserId_idx" ON "UserReport"("reportedUserId");

-- CreateIndex
CREATE INDEX "UserReport_reporterId_idx" ON "UserReport"("reporterId");

-- CreateIndex
CREATE INDEX "TradeDispute_status_createdAt_idx" ON "TradeDispute"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TradeDispute_tradeId_idx" ON "TradeDispute"("tradeId");

-- CreateIndex
CREATE INDEX "TradeDispute_initiatedByUserId_idx" ON "TradeDispute"("initiatedByUserId");

-- CreateIndex
CREATE INDEX "TradeDispute_otherPartyUserId_idx" ON "TradeDispute"("otherPartyUserId");

-- CreateIndex
CREATE INDEX "ScraperRunItem_runId_status_idx" ON "ScraperRunItem"("runId", "status");

-- CreateIndex
CREATE INDEX "idx_perfume_submitted_by" ON "Perfume"("submittedBy");

-- CreateIndex
CREATE INDEX "idx_perfume_pending_submitted_by" ON "Perfume"("isPending", "submittedBy");

-- CreateIndex
CREATE INDEX "idx_perfume_pending_submission" ON "Perfume"("pendingSubmissionId");

-- CreateIndex
CREATE INDEX "idx_house_submitted_by" ON "PerfumeHouse"("submittedBy");

-- CreateIndex
CREATE INDEX "idx_house_pending_submitted_by" ON "PerfumeHouse"("isPending", "submittedBy");

-- CreateIndex
CREATE INDEX "idx_house_pending_submission" ON "PerfumeHouse"("pendingSubmissionId");

-- CreateIndex
CREATE INDEX "TraderContactMessage_tradeId_idx" ON "TraderContactMessage"("tradeId");

-- CreateIndex
CREATE INDEX "TraderFeedback_tradeId_idx" ON "TraderFeedback"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_profileSlug_key" ON "User"("profileSlug");

-- CreateIndex
CREATE INDEX "UserPerfume_pendingSubmissionId_idx" ON "UserPerfume"("pendingSubmissionId");

-- CreateIndex
CREATE INDEX "idx_review_perfume_created" ON "UserPerfumeReview"("perfumeId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_wishlist_user_created" ON "UserPerfumeWishlist"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PerfumeHouse" ADD CONSTRAINT "PerfumeHouse_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perfume" ADD CONSTRAINT "Perfume_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfume" ADD CONSTRAINT "UserPerfume_pendingSubmissionId_fkey" FOREIGN KEY ("pendingSubmissionId") REFERENCES "PendingSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeSeasonVote" ADD CONSTRAINT "UserPerfumeSeasonVote_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeSeasonVote" ADD CONSTRAINT "UserPerfumeSeasonVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMaterialAlias" ADD CONSTRAINT "NoteMaterialAlias_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "NoteMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMaterialAlias" ADD CONSTRAINT "NoteMaterialAlias_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "PerfumeNotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderFeedback" ADD CONSTRAINT "TraderFeedback_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderFeedbackHelpfulnessVote" ADD CONSTRAINT "TraderFeedbackHelpfulnessVote_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "TraderFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderFeedbackHelpfulnessVote" ADD CONSTRAINT "TraderFeedbackHelpfulnessVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshSession" ADD CONSTRAINT "RefreshSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TasteEvent" ADD CONSTRAINT "TasteEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TasteEvent" ADD CONSTRAINT "TasteEvent_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearchAlert" ADD CONSTRAINT "SavedSearchAlert_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SamplingQueueItem" ADD CONSTRAINT "SamplingQueueItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SamplingQueueItem" ADD CONSTRAINT "SamplingQueueItem_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionShelf" ADD CONSTRAINT "CollectionShelf_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionShelf" ADD CONSTRAINT "CollectionShelf_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "CommunityChallenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionShelfItem" ADD CONSTRAINT "CollectionShelfItem_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "CollectionShelf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionShelfItem" ADD CONSTRAINT "CollectionShelfItem_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserList" ADD CONSTRAINT "UserList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserListItem" ADD CONSTRAINT "UserListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserListItem" ADD CONSTRAINT "UserListItem_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearJournalEntry" ADD CONSTRAINT "WearJournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WearJournalEntry" ADD CONSTRAINT "WearJournalEntry_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityChallengeEntry" ADD CONSTRAINT "CommunityChallengeEntry_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "CommunityChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityChallengeEntry" ADD CONSTRAINT "CommunityChallengeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityChallengeEntry" ADD CONSTRAINT "CommunityChallengeEntry_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAlert" ADD CONSTRAINT "UserAlert_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingUserId_fkey" FOREIGN KEY ("followingUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingHouseId_fkey" FOREIGN KEY ("followingHouseId") REFERENCES "PerfumeHouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingPerfumeId_fkey" FOREIGN KEY ("followingPerfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPushSubscription" ADD CONSTRAINT "UserPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConversationPresence" ADD CONSTRAINT "UserConversationPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderContactMessage" ADD CONSTRAINT "TraderContactMessage_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeLineItem" ADD CONSTRAINT "TradeLineItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeLineItem" ADD CONSTRAINT "TradeLineItem_userPerfumeId_fkey" FOREIGN KEY ("userPerfumeId") REFERENCES "UserPerfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeEvent" ADD CONSTRAINT "TradeEvent_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeEvent" ADD CONSTRAINT "TradeEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecantSplit" ADD CONSTRAINT "DecantSplit_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecantSplit" ADD CONSTRAINT "DecantSplit_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecantSplit" ADD CONSTRAINT "DecantSplit_sourceUserPerfumeId_fkey" FOREIGN KEY ("sourceUserPerfumeId") REFERENCES "UserPerfume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecantSplitSlot" ADD CONSTRAINT "DecantSplitSlot_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "DecantSplit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecantSplitSlot" ADD CONSTRAINT "DecantSplitSlot_claimantUserId_fkey" FOREIGN KEY ("claimantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecantSplitEvent" ADD CONSTRAINT "DecantSplitEvent_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "DecantSplit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecantSplitEvent" ADD CONSTRAINT "DecantSplitEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStrike" ADD CONSTRAINT "UserStrike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStrike" ADD CONSTRAINT "UserStrike_issuedBy_fkey" FOREIGN KEY ("issuedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReport" ADD CONSTRAINT "UserReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDispute" ADD CONSTRAINT "TradeDispute_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDispute" ADD CONSTRAINT "TradeDispute_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDispute" ADD CONSTRAINT "TradeDispute_otherPartyUserId_fkey" FOREIGN KEY ("otherPartyUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeDispute" ADD CONSTRAINT "TradeDispute_resolvedByAdminId_fkey" FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperRun" ADD CONSTRAINT "ScraperRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ScraperSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScraperRunItem" ADD CONSTRAINT "ScraperRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ScraperRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

