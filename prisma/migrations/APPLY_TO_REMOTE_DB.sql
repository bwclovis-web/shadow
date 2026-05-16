-- ================================================================================
-- SAFE MIGRATION SCRIPT FOR REMOTE DATABASE
-- ================================================================================
-- This script ONLY ADDS new structures and never deletes or modifies existing data
-- Run this on the remote/production database to sync it with the schema
-- ================================================================================

-- Wrap entire migration in a transaction for safety
BEGIN;

-- ============================================================================
-- 1. ADD MISSING ENUMS
-- ============================================================================

-- PerfumeNoteType enum
DO $$ BEGIN
    CREATE TYPE "PerfumeNoteType" AS ENUM ('open', 'heart', 'base');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'PerfumeNoteType enum already exists, skipping';
END $$;

-- SecurityAuditAction enum
DO $$ BEGIN
    CREATE TYPE "SecurityAuditAction" AS ENUM (
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGE',
        'PROFILE_UPDATE', 'ADMIN_ACCESS', 'DATA_ACCESS', 'DATA_MODIFICATION',
        'DATA_DELETION', 'SUSPICIOUS_ACTIVITY', 'RATE_LIMIT_EXCEEDED',
        'INVALID_TOKEN', 'UNAUTHORIZED_ACCESS', 'CSRF_VIOLATION',
        'SQL_INJECTION_ATTEMPT', 'XSS_ATTEMPT', 'FILE_UPLOAD',
        'API_ACCESS', 'SYSTEM_ERROR', 'SECURITY_SCAN'
    );
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'SecurityAuditAction enum already exists, skipping';
END $$;

-- SecurityAuditSeverity enum
DO $$ BEGIN
    CREATE TYPE "SecurityAuditSeverity" AS ENUM ('low', 'info', 'warning', 'error', 'critical');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'SecurityAuditSeverity enum already exists, skipping';
END $$;

-- PendingSubmissionType enum
DO $$ BEGIN
    CREATE TYPE "PendingSubmissionType" AS ENUM ('perfume', 'perfume_house');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'PendingSubmissionType enum already exists, skipping';
END $$;

-- PendingSubmissionStatus enum
DO $$ BEGIN
    CREATE TYPE "PendingSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN 
        RAISE NOTICE 'PendingSubmissionStatus enum already exists, skipping';
END $$;

-- SubscriptionStatus enum
DO $$ BEGIN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('free', 'paid', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'SubscriptionStatus enum already exists, skipping';
END $$;

-- Add missing AlertType enum value
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'pending_submission_approval'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'pending_submission_approval';
        RAISE NOTICE 'Added pending_submission_approval to AlertType enum';
    END IF;
END $$;

-- PerfumeType: hairGloss (matches prisma/schema.prisma)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'PerfumeType' AND e.enumlabel = 'hairGloss'
    ) THEN
        ALTER TYPE "PerfumeType" ADD VALUE 'hairGloss';
        RAISE NOTICE 'Added hairGloss to PerfumeType enum';
    END IF;
END $$;

-- WishlistBottlePreference enum (wishlist sample / partial / full / any)
DO $$ BEGIN
    CREATE TYPE "WishlistBottlePreference" AS ENUM ('sample', 'partial', 'full', 'any');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'WishlistBottlePreference enum already exists, skipping';
END $$;

-- ============================================================================
-- 2. CREATE MISSING TABLES
-- ============================================================================

-- PerfumeNoteRelation junction table
CREATE TABLE IF NOT EXISTS "PerfumeNoteRelation" (
    "id" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "noteType" "PerfumeNoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "PerfumeNoteRelation_pkey" PRIMARY KEY ("id")
);

-- TraderFeedback table
CREATE TABLE IF NOT EXISTS "TraderFeedback" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "TraderFeedback_pkey" PRIMARY KEY ("id")
);

-- SecurityAuditLog table
CREATE TABLE IF NOT EXISTS "SecurityAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "SecurityAuditAction" NOT NULL,
    "severity" "SecurityAuditSeverity" NOT NULL DEFAULT 'info',
    "resource" TEXT,
    "resourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "details" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "SecurityAuditLog_pkey" PRIMARY KEY ("id")
);

-- UserAlert table
CREATE TABLE IF NOT EXISTS "UserAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    
    CONSTRAINT "UserAlert_pkey" PRIMARY KEY ("id")
);

-- UserAlertPreferences table
CREATE TABLE IF NOT EXISTS "UserAlertPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wishlistAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "decantAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailWishlistAlerts" BOOLEAN NOT NULL DEFAULT false,
    "emailDecantAlerts" BOOLEAN NOT NULL DEFAULT false,
    "maxAlerts" INTEGER NOT NULL DEFAULT 10,
    
    CONSTRAINT "UserAlertPreferences_pkey" PRIMARY KEY ("id")
);

-- PendingSubmission table
CREATE TABLE IF NOT EXISTS "PendingSubmission" (
    "id" TEXT NOT NULL,
    "submissionType" "PendingSubmissionType" NOT NULL,
    "submittedBy" TEXT,
    "status" "PendingSubmissionStatus" NOT NULL DEFAULT 'pending',
    "submissionData" JSONB NOT NULL,
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "PendingSubmission_pkey" PRIMARY KEY ("id")
);

-- TraderContactMessage table
CREATE TABLE IF NOT EXISTS "TraderContactMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "TraderContactMessage_pkey" PRIMARY KEY ("id")
);

-- MigrationState table
CREATE TABLE IF NOT EXISTS "MigrationState" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "lastMigratedAt" TIMESTAMP(3) NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "MigrationState_pkey" PRIMARY KEY ("id")
);

-- ScentProfile table
CREATE TABLE IF NOT EXISTS "ScentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteWeights" JSONB NOT NULL,
    "avoidNoteIds" JSONB NOT NULL,
    "preferredPriceRange" JSONB,
    "seasonHint" TEXT,
    "browsingStyle" TEXT,
    "lastQuizAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScentProfile_pkey" PRIMARY KEY ("id")
);

-- UserPerfumeSeasonVote (community season picks per user per perfume)
CREATE TABLE IF NOT EXISTS "UserPerfumeSeasonVote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "winter" BOOLEAN NOT NULL DEFAULT false,
    "spring" BOOLEAN NOT NULL DEFAULT false,
    "summer" BOOLEAN NOT NULL DEFAULT false,
    "fall" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPerfumeSeasonVote_pkey" PRIMARY KEY ("id")
);

-- DataQualityDailySnapshot (cron / data quality dashboard trends; matches Prisma model)
CREATE TABLE IF NOT EXISTS "DataQualityDailySnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "totalMissing" INTEGER NOT NULL,
    "totalDuplicates" INTEGER NOT NULL,
    "totalMissingHouseInfo" INTEGER NOT NULL,
    "totalHousesNoPerfumes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataQualityDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- 3. ADD MISSING COLUMNS TO EXISTING TABLES
-- ============================================================================

-- Add updatedAt to PerfumeNotes if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PerfumeNotes' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "PerfumeNotes" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column to PerfumeNotes';
    END IF;
END $$;

-- Add updatedAt to UserPerfume if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'UserPerfume' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "UserPerfume" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column to UserPerfume';
    END IF;
END $$;

-- Add updatedAt to UserPerfumeComment if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'UserPerfumeComment' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "UserPerfumeComment" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column to UserPerfumeComment';
    END IF;
END $$;

-- Add updatedAt to WishlistNotification if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'WishlistNotification' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "WishlistNotification" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column to WishlistNotification';
    END IF;
END $$;

-- Add updatedAt to UserPerfumeWishlist if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'UserPerfumeWishlist' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "UserPerfumeWishlist" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column to UserPerfumeWishlist';
    END IF;
END $$;

-- Add bottlePreference to UserPerfumeWishlist if missing (matches prisma/schema.prisma)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'UserPerfumeWishlist'
          AND column_name = 'bottlePreference'
    ) THEN
        ALTER TABLE "UserPerfumeWishlist"
        ADD COLUMN "bottlePreference" "WishlistBottlePreference" NOT NULL DEFAULT 'any';
        RAISE NOTICE 'Added bottlePreference column to UserPerfumeWishlist';
    END IF;
END $$;

-- Add subscription fields to User if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'subscriptionStatus'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'free';
        RAISE NOTICE 'Added subscriptionStatus column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'subscriptionId'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "subscriptionId" TEXT;
        RAISE NOTICE 'Added subscriptionId column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'subscriptionStartDate'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "subscriptionStartDate" TIMESTAMP(3);
        RAISE NOTICE 'Added subscriptionStartDate column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'isEarlyAdopter'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "isEarlyAdopter" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added isEarlyAdopter column to User';
    END IF;
END $$;

-- Add tokenVersion to User if missing (for token invalidation)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'tokenVersion'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added tokenVersion column to User';
    END IF;
END $$;

-- Add traderAbout to User if missing (trader bio/description)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'traderAbout'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "traderAbout" TEXT;
        RAISE NOTICE 'Added traderAbout column to User';
    END IF;
END $$;

-- Add profileSlug to User if missing (profile URL segment; nullable until backfilled)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'profileSlug'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "profileSlug" TEXT;
        RAISE NOTICE 'Added profileSlug column to User';
    END IF;
END $$;

-- Add review approval fields if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'UserPerfumeReview' AND column_name = 'isApproved'
    ) THEN
        ALTER TABLE "UserPerfumeReview" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'Added isApproved column to UserPerfumeReview';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'UserPerfumeReview' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "UserPerfumeReview" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column to UserPerfumeReview';
    END IF;
END $$;

-- ============================================================================
-- 4. CREATE INDEXES
-- ============================================================================

-- PerfumeNoteRelation indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PerfumeNoteRelation_perfumeId_idx') THEN
        CREATE INDEX "PerfumeNoteRelation_perfumeId_idx" ON "PerfumeNoteRelation"("perfumeId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PerfumeNoteRelation_noteId_idx') THEN
        CREATE INDEX "PerfumeNoteRelation_noteId_idx" ON "PerfumeNoteRelation"("noteId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PerfumeNoteRelation_noteType_idx') THEN
        CREATE INDEX "PerfumeNoteRelation_noteType_idx" ON "PerfumeNoteRelation"("noteType");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_note_relation_note_type') THEN
        CREATE INDEX "idx_note_relation_note_type" ON "PerfumeNoteRelation"("noteId", "noteType");
    END IF;
END $$;

-- ScentProfile indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ScentProfile_userId_key') THEN
        CREATE UNIQUE INDEX "ScentProfile_userId_key" ON "ScentProfile"("userId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ScentProfile_userId_idx') THEN
        CREATE INDEX "ScentProfile_userId_idx" ON "ScentProfile"("userId");
    END IF;
END $$;

-- TraderFeedback indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderFeedback_traderId_idx') THEN
        CREATE INDEX "TraderFeedback_traderId_idx" ON "TraderFeedback"("traderId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderFeedback_reviewerId_idx') THEN
        CREATE INDEX "TraderFeedback_reviewerId_idx" ON "TraderFeedback"("reviewerId");
    END IF;
END $$;

-- UserAlert indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserAlert_userId_createdAt_idx') THEN
        CREATE INDEX "UserAlert_userId_createdAt_idx" ON "UserAlert"("userId", "createdAt");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserAlert_userId_isRead_isDismissed_idx') THEN
        CREATE INDEX "UserAlert_userId_isRead_isDismissed_idx" ON "UserAlert"("userId", "isRead", "isDismissed");
    END IF;
END $$;

-- PendingSubmission indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PendingSubmission_status_createdAt_idx') THEN
        CREATE INDEX "PendingSubmission_status_createdAt_idx" ON "PendingSubmission"("status", "createdAt");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'PendingSubmission_submissionType_status_idx') THEN
        CREATE INDEX "PendingSubmission_submissionType_status_idx" ON "PendingSubmission"("submissionType", "status");
    END IF;
END $$;

-- TraderContactMessage indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderContactMessage_senderId_createdAt_idx') THEN
        CREATE INDEX "TraderContactMessage_senderId_createdAt_idx" ON "TraderContactMessage"("senderId", "createdAt");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderContactMessage_recipientId_createdAt_idx') THEN
        CREATE INDEX "TraderContactMessage_recipientId_createdAt_idx" ON "TraderContactMessage"("recipientId", "createdAt");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderContactMessage_senderId_recipientId_createdAt_idx') THEN
        CREATE INDEX "TraderContactMessage_senderId_recipientId_createdAt_idx" ON "TraderContactMessage"("senderId", "recipientId", "createdAt");
    END IF;
END $$;

-- Perfume indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_perfume_slug') THEN
        CREATE INDEX "idx_perfume_slug" ON "Perfume"("slug");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_perfume_house_created') THEN
        CREATE INDEX "idx_perfume_house_created" ON "Perfume"("perfumeHouseId", "createdAt");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_perfume_name') THEN
        CREATE INDEX "idx_perfume_name" ON "Perfume"("name");
    END IF;
END $$;

-- PerfumeHouse indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_house_type_name') THEN
        CREATE INDEX "idx_house_type_name" ON "PerfumeHouse"("type", "name");
    END IF;
END $$;

-- UserPerfume indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_perfume_user_available') THEN
        CREATE INDEX "idx_user_perfume_user_available" ON "UserPerfume"("userId", "available");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_perfume_perfume_available') THEN
        CREATE INDEX "idx_user_perfume_perfume_available" ON "UserPerfume"("perfumeId", "available");
    END IF;
END $$;

-- UserPerfumeSeasonVote indexes (matches Prisma @@index([perfumeId], name: "idx_season_vote_perfume"))
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_season_vote_perfume') THEN
        CREATE INDEX "idx_season_vote_perfume" ON "UserPerfumeSeasonVote"("perfumeId");
    END IF;
END $$;

-- User.profileSlug unique index (matches Prisma @unique; multiple NULLs allowed in PostgreSQL)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_profileSlug_key') THEN
        CREATE UNIQUE INDEX "User_profileSlug_key" ON "User"("profileSlug");
    END IF;
END $$;

-- DataQualityDailySnapshot.snapshotDate @unique (matches Prisma)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'DataQualityDailySnapshot_snapshotDate_key') THEN
        CREATE UNIQUE INDEX "DataQualityDailySnapshot_snapshotDate_key" ON "DataQualityDailySnapshot"("snapshotDate");
    END IF;
END $$;

-- ============================================================================
-- 5. CREATE UNIQUE CONSTRAINTS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PerfumeNoteRelation_perfumeId_noteId_noteType_key'
    ) THEN
        ALTER TABLE "PerfumeNoteRelation" 
        ADD CONSTRAINT "PerfumeNoteRelation_perfumeId_noteId_noteType_key" 
        UNIQUE ("perfumeId", "noteId", "noteType");
    END IF;
EXCEPTION
    WHEN duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'PerfumeNoteRelation unique relation/constraint already exists, skipping';
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'TraderFeedback_traderId_reviewerId_key'
    ) THEN
        ALTER TABLE "TraderFeedback" 
        ADD CONSTRAINT "TraderFeedback_traderId_reviewerId_key" 
        UNIQUE ("traderId", "reviewerId");
    END IF;
EXCEPTION
    WHEN duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'TraderFeedback unique relation/constraint already exists, skipping';
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserAlertPreferences_userId_key'
    ) THEN
        ALTER TABLE "UserAlertPreferences" 
        ADD CONSTRAINT "UserAlertPreferences_userId_key" 
        UNIQUE ("userId");
    END IF;
EXCEPTION
    WHEN duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'UserAlertPreferences unique relation/constraint already exists, skipping';
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'MigrationState_tableName_key'
    ) THEN
        ALTER TABLE "MigrationState" 
        ADD CONSTRAINT "MigrationState_tableName_key" 
        UNIQUE ("tableName");
    END IF;
EXCEPTION
    WHEN duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'MigrationState unique relation/constraint already exists, skipping';
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserPerfumeSeasonVote_userId_perfumeId_key'
    ) THEN
        ALTER TABLE "UserPerfumeSeasonVote"
        ADD CONSTRAINT "UserPerfumeSeasonVote_userId_perfumeId_key"
        UNIQUE ("userId", "perfumeId");
    END IF;
EXCEPTION
    WHEN duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'UserPerfumeSeasonVote unique constraint already exists, skipping';
END $$;

-- ============================================================================
-- 6. ADD FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- PerfumeNoteRelation foreign keys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PerfumeNoteRelation_perfumeId_fkey'
    ) THEN
        ALTER TABLE "PerfumeNoteRelation" 
        ADD CONSTRAINT "PerfumeNoteRelation_perfumeId_fkey" 
        FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PerfumeNoteRelation_noteId_fkey'
    ) THEN
        ALTER TABLE "PerfumeNoteRelation" 
        ADD CONSTRAINT "PerfumeNoteRelation_noteId_fkey" 
        FOREIGN KEY ("noteId") REFERENCES "PerfumeNotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- TraderFeedback foreign keys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'TraderFeedback_traderId_fkey'
    ) THEN
        ALTER TABLE "TraderFeedback" 
        ADD CONSTRAINT "TraderFeedback_traderId_fkey" 
        FOREIGN KEY ("traderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'TraderFeedback_reviewerId_fkey'
    ) THEN
        ALTER TABLE "TraderFeedback" 
        ADD CONSTRAINT "TraderFeedback_reviewerId_fkey" 
        FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- SecurityAuditLog foreign keys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'SecurityAuditLog_userId_fkey'
    ) THEN
        ALTER TABLE "SecurityAuditLog" 
        ADD CONSTRAINT "SecurityAuditLog_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- UserAlert foreign keys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserAlert_perfumeId_fkey'
    ) THEN
        ALTER TABLE "UserAlert" 
        ADD CONSTRAINT "UserAlert_perfumeId_fkey" 
        FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserAlert_userId_fkey'
    ) THEN
        ALTER TABLE "UserAlert" 
        ADD CONSTRAINT "UserAlert_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- UserAlertPreferences foreign keys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UserAlertPreferences_userId_fkey'
    ) THEN
        ALTER TABLE "UserAlertPreferences" 
        ADD CONSTRAINT "UserAlertPreferences_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- PendingSubmission foreign keys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PendingSubmission_submittedBy_fkey'
    ) THEN
        ALTER TABLE "PendingSubmission" 
        ADD CONSTRAINT "PendingSubmission_submittedBy_fkey" 
        FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PendingSubmission_reviewedBy_fkey'
    ) THEN
        ALTER TABLE "PendingSubmission" 
        ADD CONSTRAINT "PendingSubmission_reviewedBy_fkey" 
        FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- TraderContactMessage foreign keys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'TraderContactMessage_senderId_fkey'
    ) THEN
        ALTER TABLE "TraderContactMessage" 
        ADD CONSTRAINT "TraderContactMessage_senderId_fkey" 
        FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'TraderContactMessage_recipientId_fkey'
    ) THEN
        ALTER TABLE "TraderContactMessage" 
        ADD CONSTRAINT "TraderContactMessage_recipientId_fkey" 
        FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- UserPerfumeSeasonVote foreign keys
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserPerfumeSeasonVote_userId_fkey'
    ) THEN
        ALTER TABLE "UserPerfumeSeasonVote"
        ADD CONSTRAINT "UserPerfumeSeasonVote_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'UserPerfumeSeasonVote_perfumeId_fkey'
    ) THEN
        ALTER TABLE "UserPerfumeSeasonVote"
        ADD CONSTRAINT "UserPerfumeSeasonVote_perfumeId_fkey"
        FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 6. WAVE 1 — TRUST FOUNDATION (trades, strikes, reports, listings, profile)
-- ============================================================================

-- TradeStatus enum
DO $$ BEGIN
    CREATE TYPE "TradeStatus" AS ENUM (
        'draft', 'pending', 'accepted', 'shipped', 'received', 'completed', 'declined', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'TradeStatus enum already exists, skipping';
END $$;

-- TradeLineItemRole enum
DO $$ BEGIN
    CREATE TYPE "TradeLineItemRole" AS ENUM ('offered', 'requested');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'TradeLineItemRole enum already exists, skipping';
END $$;

-- ListingCondition enum
DO $$ BEGIN
    CREATE TYPE "ListingCondition" AS ENUM (
        'sealed', 'mint', 'lightlyUsed', 'heavilyUsed', 'damaged'
    );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'ListingCondition enum already exists, skipping';
END $$;

-- DecantFormat enum
DO $$ BEGIN
    CREATE TYPE "DecantFormat" AS ENUM ('atomizer', 'vial', 'original');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'DecantFormat enum already exists, skipping';
END $$;

-- UserReportCategory enum
DO $$ BEGIN
    CREATE TYPE "UserReportCategory" AS ENUM (
        'scam', 'fakeItem', 'harassment', 'noShip', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'UserReportCategory enum already exists, skipping';
END $$;

-- UserReportStatus enum (Wave 1C: inProgress / settled / passed)
DO $$ BEGIN
    CREATE TYPE "UserReportStatus" AS ENUM ('inProgress', 'settled', 'passed');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'UserReportStatus enum already exists, skipping';
END $$;

-- AlertType: trade lifecycle + trader message (matches prisma/schema.prisma)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'new_trader_message'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'new_trader_message';
        RAISE NOTICE 'Added new_trader_message to AlertType enum';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'trade_received'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'trade_received';
        RAISE NOTICE 'Added trade_received to AlertType enum';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'trade_accepted'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'trade_accepted';
        RAISE NOTICE 'Added trade_accepted to AlertType enum';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'trade_shipped'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'trade_shipped';
        RAISE NOTICE 'Added trade_shipped to AlertType enum';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'trade_completed'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'trade_completed';
        RAISE NOTICE 'Added trade_completed to AlertType enum';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'trade_cancelled'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'trade_cancelled';
        RAISE NOTICE 'Added trade_cancelled to AlertType enum';
    END IF;
END $$;

-- Trade tables
CREATE TABLE IF NOT EXISTS "Trade" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TradeLineItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "userPerfumeId" TEXT NOT NULL,
    "role" "TradeLineItemRole" NOT NULL,
    "perfumeName" TEXT NOT NULL,
    "mlSnapshot" DOUBLE PRECISION,
    "conditionSnapshot" "ListingCondition",
    CONSTRAINT "TradeLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TradeEvent" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserStrike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserStrike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "tradeId" TEXT,
    "category" "UserReportCategory" NOT NULL,
    "description" TEXT,
    "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "UserReportStatus" NOT NULL DEFAULT 'inProgress',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserReport_pkey" PRIMARY KEY ("id")
);

-- UserReport: migrate legacy status enum values if present (pending/reviewed/actioned → inProgress/settled/passed)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'UserReportStatus' AND e.enumlabel = 'pending'
    ) THEN
        ALTER TABLE "UserReport" ALTER COLUMN "status" DROP DEFAULT;
        ALTER TABLE "UserReport" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
        UPDATE "UserReport" SET "status" = 'inProgress' WHERE "status" IN ('pending', 'reviewed');
        UPDATE "UserReport" SET "status" = 'settled' WHERE "status" = 'actioned';
        DROP TYPE "UserReportStatus";
        CREATE TYPE "UserReportStatus" AS ENUM ('inProgress', 'settled', 'passed');
        ALTER TABLE "UserReport" ALTER COLUMN "status" TYPE "UserReportStatus" USING "status"::"UserReportStatus";
        ALTER TABLE "UserReport" ALTER COLUMN "status" SET DEFAULT 'inProgress';
        RAISE NOTICE 'Migrated UserReport.status to inProgress/settled/passed';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'UserReport table missing during status migration, skipping';
    WHEN others THEN
        RAISE NOTICE 'UserReport status migration skipped: %', SQLERRM;
END $$;

-- UserReport.images (if table predates photo attachments)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'UserReport'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserReport' AND column_name = 'images'
    ) THEN
        ALTER TABLE "UserReport" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
        RAISE NOTICE 'Added images column to UserReport';
    END IF;
END $$;

-- User profile / moderation fields (Wave 1A / 1E)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'avatarImage'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "avatarImage" TEXT;
        RAISE NOTICE 'Added avatarImage column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'region'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "region" TEXT;
        RAISE NOTICE 'Added region column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'instagramHandle'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "instagramHandle" TEXT;
        RAISE NOTICE 'Added instagramHandle column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'fragranticaUrl'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "fragranticaUrl" TEXT;
        RAISE NOTICE 'Added fragranticaUrl column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'redditUsername'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "redditUsername" TEXT;
        RAISE NOTICE 'Added redditUsername column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'strikeCount'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "strikeCount" INTEGER NOT NULL DEFAULT 0;
        RAISE NOTICE 'Added strikeCount column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'isBanned'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added isBanned column to User';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'onboardingCompletedAt'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);
        RAISE NOTICE 'Added onboardingCompletedAt column to User';
    END IF;
END $$;

-- UserPerfume listing-quality fields (Wave 1D)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserPerfume' AND column_name = 'images'
    ) THEN
        ALTER TABLE "UserPerfume" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
        RAISE NOTICE 'Added images column to UserPerfume';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserPerfume' AND column_name = 'condition'
    ) THEN
        ALTER TABLE "UserPerfume" ADD COLUMN "condition" "ListingCondition";
        RAISE NOTICE 'Added condition column to UserPerfume';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserPerfume' AND column_name = 'decantFormat'
    ) THEN
        ALTER TABLE "UserPerfume" ADD COLUMN "decantFormat" "DecantFormat";
        RAISE NOTICE 'Added decantFormat column to UserPerfume';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserPerfume' AND column_name = 'mlRemaining'
    ) THEN
        ALTER TABLE "UserPerfume" ADD COLUMN "mlRemaining" DOUBLE PRECISION;
        RAISE NOTICE 'Added mlRemaining column to UserPerfume';
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'UserPerfume' AND column_name = 'pendingSubmissionId'
    ) THEN
        ALTER TABLE "UserPerfume" ADD COLUMN "pendingSubmissionId" TEXT;
        RAISE NOTICE 'Added pendingSubmissionId column to UserPerfume';
    END IF;
END $$;

-- TraderContactMessage.tradeId
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'TraderContactMessage' AND column_name = 'tradeId'
    ) THEN
        ALTER TABLE "TraderContactMessage" ADD COLUMN "tradeId" TEXT;
        RAISE NOTICE 'Added tradeId column to TraderContactMessage';
    END IF;
END $$;

-- TraderFeedback.tradeId
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'TraderFeedback' AND column_name = 'tradeId'
    ) THEN
        ALTER TABLE "TraderFeedback" ADD COLUMN "tradeId" TEXT;
        RAISE NOTICE 'Added tradeId column to TraderFeedback';
    END IF;
END $$;

-- Trade indexes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Trade_initiatorId_status_idx') THEN
        CREATE INDEX "Trade_initiatorId_status_idx" ON "Trade"("initiatorId", "status");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Trade_counterpartyId_status_idx') THEN
        CREATE INDEX "Trade_counterpartyId_status_idx" ON "Trade"("counterpartyId", "status");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Trade_status_updatedAt_idx') THEN
        CREATE INDEX "Trade_status_updatedAt_idx" ON "Trade"("status", "updatedAt");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TradeLineItem_tradeId_idx') THEN
        CREATE INDEX "TradeLineItem_tradeId_idx" ON "TradeLineItem"("tradeId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TradeLineItem_userPerfumeId_idx') THEN
        CREATE INDEX "TradeLineItem_userPerfumeId_idx" ON "TradeLineItem"("userPerfumeId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TradeEvent_tradeId_createdAt_idx') THEN
        CREATE INDEX "TradeEvent_tradeId_createdAt_idx" ON "TradeEvent"("tradeId", "createdAt");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TradeEvent_actorUserId_idx') THEN
        CREATE INDEX "TradeEvent_actorUserId_idx" ON "TradeEvent"("actorUserId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserStrike_userId_createdAt_idx') THEN
        CREATE INDEX "UserStrike_userId_createdAt_idx" ON "UserStrike"("userId", "createdAt");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserStrike_issuedBy_idx') THEN
        CREATE INDEX "UserStrike_issuedBy_idx" ON "UserStrike"("issuedBy");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserReport_status_createdAt_idx') THEN
        CREATE INDEX "UserReport_status_createdAt_idx" ON "UserReport"("status", "createdAt");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserReport_reportedUserId_idx') THEN
        CREATE INDEX "UserReport_reportedUserId_idx" ON "UserReport"("reportedUserId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserReport_reporterId_idx') THEN
        CREATE INDEX "UserReport_reporterId_idx" ON "UserReport"("reporterId");
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserReport_tradeId_idx') THEN
        CREATE INDEX "UserReport_tradeId_idx" ON "UserReport"("tradeId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'UserPerfume_pendingSubmissionId_idx') THEN
        CREATE INDEX "UserPerfume_pendingSubmissionId_idx" ON "UserPerfume"("pendingSubmissionId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderContactMessage_tradeId_idx') THEN
        CREATE INDEX "TraderContactMessage_tradeId_idx" ON "TraderContactMessage"("tradeId");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderFeedback_tradeId_idx') THEN
        CREATE INDEX "TraderFeedback_tradeId_idx" ON "TraderFeedback"("tradeId");
    END IF;
END $$;

-- Trade foreign keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trade_initiatorId_fkey') THEN
        ALTER TABLE "Trade"
        ADD CONSTRAINT "Trade_initiatorId_fkey"
        FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Trade_counterpartyId_fkey') THEN
        ALTER TABLE "Trade"
        ADD CONSTRAINT "Trade_counterpartyId_fkey"
        FOREIGN KEY ("counterpartyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TradeLineItem_tradeId_fkey') THEN
        ALTER TABLE "TradeLineItem"
        ADD CONSTRAINT "TradeLineItem_tradeId_fkey"
        FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TradeLineItem_userPerfumeId_fkey') THEN
        ALTER TABLE "TradeLineItem"
        ADD CONSTRAINT "TradeLineItem_userPerfumeId_fkey"
        FOREIGN KEY ("userPerfumeId") REFERENCES "UserPerfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TradeEvent_tradeId_fkey') THEN
        ALTER TABLE "TradeEvent"
        ADD CONSTRAINT "TradeEvent_tradeId_fkey"
        FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TradeEvent_actorUserId_fkey') THEN
        ALTER TABLE "TradeEvent"
        ADD CONSTRAINT "TradeEvent_actorUserId_fkey"
        FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserStrike_userId_fkey') THEN
        ALTER TABLE "UserStrike"
        ADD CONSTRAINT "UserStrike_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserStrike_issuedBy_fkey') THEN
        ALTER TABLE "UserStrike"
        ADD CONSTRAINT "UserStrike_issuedBy_fkey"
        FOREIGN KEY ("issuedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserReport_reporterId_fkey') THEN
        ALTER TABLE "UserReport"
        ADD CONSTRAINT "UserReport_reporterId_fkey"
        FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserReport_reportedUserId_fkey') THEN
        ALTER TABLE "UserReport"
        ADD CONSTRAINT "UserReport_reportedUserId_fkey"
        FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserReport_tradeId_fkey') THEN
        ALTER TABLE "UserReport"
        ADD CONSTRAINT "UserReport_tradeId_fkey"
        FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserPerfume_pendingSubmissionId_fkey') THEN
        ALTER TABLE "UserPerfume"
        ADD CONSTRAINT "UserPerfume_pendingSubmissionId_fkey"
        FOREIGN KEY ("pendingSubmissionId") REFERENCES "PendingSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TraderContactMessage_tradeId_fkey') THEN
        ALTER TABLE "TraderContactMessage"
        ADD CONSTRAINT "TraderContactMessage_tradeId_fkey"
        FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TraderFeedback_tradeId_fkey') THEN
        ALTER TABLE "TraderFeedback"
        ADD CONSTRAINT "TraderFeedback_tradeId_fkey"
        FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 7. COMMIT TRANSACTION
-- ============================================================================

-- ScentProfile foreign key
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ScentProfile_userId_fkey'
    ) THEN
        ALTER TABLE "ScentProfile"
        ADD CONSTRAINT "ScentProfile_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'ScentProfile_userId_fkey already exists, skipping';
END $$;

COMMIT;

-- Print success message
DO $$ BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'All new tables, columns, indexes, and constraints have been added.';
    RAISE NOTICE 'No existing data was modified or deleted.';
END $$;
