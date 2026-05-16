-- Migrate UserReport status values before applying new enum (run once via prisma db execute)
ALTER TABLE "UserReport" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "UserReport" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
UPDATE "UserReport" SET "status" = 'inProgress' WHERE "status" IN ('pending', 'reviewed');
UPDATE "UserReport" SET "status" = 'settled' WHERE "status" = 'actioned';
DROP TYPE IF EXISTS "UserReportStatus";
CREATE TYPE "UserReportStatus" AS ENUM ('inProgress', 'settled', 'passed');
ALTER TABLE "UserReport" ALTER COLUMN "status" TYPE "UserReportStatus" USING "status"::"UserReportStatus";
ALTER TABLE "UserReport" ALTER COLUMN "status" SET DEFAULT 'inProgress';
