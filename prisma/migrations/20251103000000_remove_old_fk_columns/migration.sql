-- AlterTable: Remove old foreign key columns from PerfumeNotes
-- This migration removes the old FK-based note structure columns that have been
-- replaced by the PerfumeNoteRelation junction table.

-- Drop foreign key constraints (if they exist)
ALTER TABLE "PerfumeNotes" DROP CONSTRAINT IF EXISTS "PerfumeNotes_perfumeOpenId_fkey" CASCADE;
ALTER TABLE "PerfumeNotes" DROP CONSTRAINT IF EXISTS "PerfumeNotes_perfumeHeartId_fkey" CASCADE;
ALTER TABLE "PerfumeNotes" DROP CONSTRAINT IF EXISTS "PerfumeNotes_perfumeCloseId_fkey" CASCADE;

-- Drop old foreign key columns
ALTER TABLE "PerfumeNotes" DROP COLUMN IF EXISTS "perfumeOpenId";
ALTER TABLE "PerfumeNotes" DROP COLUMN IF EXISTS "perfumeHeartId";
ALTER TABLE "PerfumeNotes" DROP COLUMN IF EXISTS "perfumeCloseId";

