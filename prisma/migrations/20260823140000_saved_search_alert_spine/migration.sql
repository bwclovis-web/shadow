-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'saved_search_match';

-- CreateEnum
CREATE TYPE "SavedSearchAlertFrequency" AS ENUM ('instant', 'daily');

-- AlterTable
ALTER TABLE "SavedSearch" ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserAlertPreferences" ADD COLUMN IF NOT EXISTS "savedSearchAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserAlertPreferences" ADD COLUMN IF NOT EXISTS "emailSavedSearchAlerts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserAlertPreferences" ADD COLUMN IF NOT EXISTS "pushSavedSearchAlerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserAlertPreferences" ADD COLUMN IF NOT EXISTS "savedSearchAlertFrequency" "SavedSearchAlertFrequency" NOT NULL DEFAULT 'instant';
