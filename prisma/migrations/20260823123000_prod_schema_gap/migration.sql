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

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "membershipTier" "MembershipTier" NOT NULL DEFAULT 'free';

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

