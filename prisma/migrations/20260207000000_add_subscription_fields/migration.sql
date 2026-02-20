-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('free', 'paid', 'cancelled');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isEarlyAdopter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscriptionId" TEXT,
ADD COLUMN     "subscriptionStartDate" TIMESTAMP(3),
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'free';
