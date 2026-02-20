-- CreateEnum (skipped - already exists)
-- CREATE TYPE "AlertType" AS ENUM ('wishlist_available', 'decant_interest');

-- CreateTable
CREATE TABLE "UserAlert" (
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

-- CreateTable
CREATE TABLE "UserAlertPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wishlistAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "decantAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailWishlistAlerts" BOOLEAN NOT NULL DEFAULT false,
    "emailDecantAlerts" BOOLEAN NOT NULL DEFAULT false,
    "maxAlerts" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "UserAlertPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAlert_userId_createdAt_idx" ON "UserAlert"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAlert_userId_isRead_isDismissed_idx" ON "UserAlert"("userId", "isRead", "isDismissed");

-- CreateIndex
CREATE UNIQUE INDEX "UserAlertPreferences_userId_key" ON "UserAlertPreferences"("userId");

-- AddForeignKey
ALTER TABLE "UserAlert" ADD CONSTRAINT "UserAlert_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAlert" ADD CONSTRAINT "UserAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAlertPreferences" ADD CONSTRAINT "UserAlertPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

