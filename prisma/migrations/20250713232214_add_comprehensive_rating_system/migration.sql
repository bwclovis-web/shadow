/*
  Warnings:

  - You are about to drop the column `rating` on the `UserPerfumeRating` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,perfumeId]` on the table `UserPerfumeRating` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `UserPerfumeRating` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserPerfumeRating" DROP COLUMN "rating",
ADD COLUMN     "gender" INTEGER,
ADD COLUMN     "longevity" INTEGER,
ADD COLUMN     "overall" INTEGER,
ADD COLUMN     "priceValue" INTEGER,
ADD COLUMN     "sillage" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "UserPerfumeRating_userId_perfumeId_key" ON "UserPerfumeRating"("userId", "perfumeId");
