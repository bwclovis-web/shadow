-- CreateEnum
CREATE TYPE "PerfumeNoteType" AS ENUM ('open', 'heart', 'base');

-- CreateTable
CREATE TABLE "PerfumeNoteRelation" (
    "id" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "noteType" "PerfumeNoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfumeNoteRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerfumeNoteRelation_perfumeId_idx" ON "PerfumeNoteRelation"("perfumeId");

-- CreateIndex
CREATE INDEX "PerfumeNoteRelation_noteId_idx" ON "PerfumeNoteRelation"("noteId");

-- CreateIndex
CREATE INDEX "PerfumeNoteRelation_noteType_idx" ON "PerfumeNoteRelation"("noteType");

-- CreateIndex
CREATE UNIQUE INDEX "PerfumeNoteRelation_perfumeId_noteId_noteType_key" ON "PerfumeNoteRelation"("perfumeId", "noteId", "noteType");

-- AddForeignKey
ALTER TABLE "PerfumeNoteRelation" ADD CONSTRAINT "PerfumeNoteRelation_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfumeNoteRelation" ADD CONSTRAINT "PerfumeNoteRelation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "PerfumeNotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

