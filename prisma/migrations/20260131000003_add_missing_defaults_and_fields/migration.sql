-- Add default cuid() to existing tables if ID columns don't have defaults
-- This migration ensures all ID fields auto-generate values

-- Add updatedAt to PerfumeNotes if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PerfumeNotes' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "PerfumeNotes" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add updatedAt to PerfumeNoteRelation if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'PerfumeNoteRelation' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "PerfumeNoteRelation" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add updatedAt to WishlistNotification if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'WishlistNotification' AND column_name = 'updatedAt'
    ) THEN
        ALTER TABLE "WishlistNotification" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Add index for noteId and noteType if missing
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_note_relation_note_type') THEN
        CREATE INDEX "idx_note_relation_note_type" ON "PerfumeNoteRelation"("noteId", "noteType");
    END IF;
END $$;

-- Add AlertType enum value if missing
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'AlertType' AND e.enumlabel = 'pending_submission_approval'
    ) THEN
        ALTER TYPE "AlertType" ADD VALUE 'pending_submission_approval';
    END IF;
END $$;
