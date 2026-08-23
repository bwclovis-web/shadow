-- AlterTable
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserLoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "deviceFingerprint" TEXT NOT NULL,
    "countryCode" TEXT,
    "ipHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLoginEvent_userId_createdAt_idx" ON "UserLoginEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserLoginEvent_userId_deviceFingerprint_idx" ON "UserLoginEvent"("userId", "deviceFingerprint");

-- AddForeignKey
ALTER TABLE "UserLoginEvent" ADD CONSTRAINT "UserLoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
