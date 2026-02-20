-- CreateEnum
CREATE TYPE "PendingSubmissionType" AS ENUM ('perfume', 'perfume_house');

-- CreateEnum
CREATE TYPE "PendingSubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "PendingSubmission" (
    "id" TEXT NOT NULL,
    "submissionType" "PendingSubmissionType" NOT NULL,
    "submittedBy" TEXT,
    "status" "PendingSubmissionStatus" NOT NULL DEFAULT 'pending',
    "submissionData" JSONB NOT NULL,
    "adminNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingSubmission_status_createdAt_idx" ON "PendingSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PendingSubmission_submissionType_status_idx" ON "PendingSubmission"("submissionType", "status");

-- AddForeignKey
ALTER TABLE "PendingSubmission" ADD CONSTRAINT "PendingSubmission_submittedBy_fkey" FOREIGN KEY ("submittedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingSubmission" ADD CONSTRAINT "PendingSubmission_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

