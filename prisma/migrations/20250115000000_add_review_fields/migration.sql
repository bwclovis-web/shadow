-- Add new fields to UserPerfumeReview table
ALTER TABLE "UserPerfumeReview" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserPerfumeReview" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT true;

-- Add unique constraint to prevent multiple reviews per user/perfume
-- First, remove any duplicate entries if they exist
WITH duplicates AS (
  SELECT "userId", "perfumeId", MIN("id") as keep_id
  FROM "UserPerfumeReview"
  GROUP BY "userId", "perfumeId"
  HAVING COUNT(*) > 1
)
DELETE FROM "UserPerfumeReview" 
WHERE ("userId", "perfumeId") IN (
  SELECT "userId", "perfumeId" FROM duplicates
) AND "id" NOT IN (
  SELECT keep_id FROM duplicates
);

-- Now add the unique constraint
ALTER TABLE "UserPerfumeReview" ADD CONSTRAINT "UserPerfumeReview_userId_perfumeId_key" UNIQUE ("userId", "perfumeId");
