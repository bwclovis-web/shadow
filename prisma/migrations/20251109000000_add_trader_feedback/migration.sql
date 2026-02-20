-- CreateTable
CREATE TABLE "TraderFeedback" (
    "id" TEXT NOT NULL,
    "traderId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraderFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TraderFeedback_traderId_reviewerId_key" ON "TraderFeedback"("traderId", "reviewerId");

-- CreateIndex
CREATE INDEX "TraderFeedback_traderId_idx" ON "TraderFeedback"("traderId");

-- CreateIndex
CREATE INDEX "TraderFeedback_reviewerId_idx" ON "TraderFeedback"("reviewerId");

-- AddForeignKey
ALTER TABLE "TraderFeedback" ADD CONSTRAINT "TraderFeedback_traderId_fkey" FOREIGN KEY ("traderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TraderFeedback" ADD CONSTRAINT "TraderFeedback_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

