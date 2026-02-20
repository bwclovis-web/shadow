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

-- ============================================================================
-- 7. COMMIT TRANSACTION
-- ============================================================================

COMMIT;

-- Print success message
DO $$ BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE 'All new tables, columns, indexes, and constraints have been added.';
    RAISE NOTICE 'No existing data was modified or deleted.';
END $$;
