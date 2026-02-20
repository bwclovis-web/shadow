-- Add isApproved column to UserPerfumeReview (SAFE - no data loss)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'UserPerfumeReview' AND column_name = 'isApproved'
    ) THEN
        ALTER TABLE "UserPerfumeReview" 
        ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT true;
        RAISE NOTICE 'Added isApproved column to UserPerfumeReview';
    END IF;
END $$;

-- Add updatedAt column to UserPerfumeReview (SAFE - no data loss)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'UserPerfumeReview' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "UserPerfumeReview" 
        ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
        RAISE NOTICE 'Added updatedAt column to UserPerfumeReview';
    END IF;
END $$;

-- Add unique constraint only if no duplicates exist
DO $$ 
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Check for duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT "userId", "perfumeId", COUNT(*) as cnt
        FROM "UserPerfumeReview"
        GROUP BY "userId", "perfumeId"
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate review combinations - skipping unique constraint', duplicate_count;
        RAISE NOTICE 'Run cleanup script to remove duplicates before adding constraint';
    ELSE
        -- Safe to add unique constraint
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'UserPerfumeReview_userId_perfumeId_key'
        ) THEN
            ALTER TABLE "UserPerfumeReview" 
            ADD CONSTRAINT "UserPerfumeReview_userId_perfumeId_key" 
            UNIQUE ("userId", "perfumeId");
            RAISE NOTICE 'Added unique constraint to UserPerfumeReview';
        END IF;
    END IF;
END $$;

-- Add index (SAFE - no data loss)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_perfume_created') THEN
        CREATE INDEX "idx_review_perfume_created" ON "UserPerfumeReview"("perfumeId", "createdAt");
        RAISE NOTICE 'Added index idx_review_perfume_created';
    END IF;
END $$;
