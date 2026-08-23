-- AlterTable
ALTER TABLE "WearJournalEntry" ADD COLUMN "oilPerfumeId" TEXT;

-- CreateIndex
CREATE INDEX "WearJournalEntry_oilPerfumeId_idx" ON "WearJournalEntry"("oilPerfumeId");

-- AddForeignKey
ALTER TABLE "WearJournalEntry" ADD CONSTRAINT "WearJournalEntry_oilPerfumeId_fkey" FOREIGN KEY ("oilPerfumeId") REFERENCES "Perfume"("id") ON DELETE SET NULL ON UPDATE CASCADE;
