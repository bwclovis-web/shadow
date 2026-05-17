-- AlterTable
ALTER TABLE "ScentProfile" ADD COLUMN IF NOT EXISTS "preferredConcentration" TEXT,
ADD COLUMN IF NOT EXISTS "preferredHouseTier" TEXT;
