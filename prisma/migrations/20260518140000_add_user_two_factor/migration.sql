-- AlterTable
ALTER TABLE "User" ADD COLUMN "totpSecretEncrypted" TEXT,
ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserTwoFactorBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTwoFactorBackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTwoFactorBackupCode_userId_idx" ON "UserTwoFactorBackupCode"("userId");

-- AddForeignKey
ALTER TABLE "UserTwoFactorBackupCode" ADD CONSTRAINT "UserTwoFactorBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
