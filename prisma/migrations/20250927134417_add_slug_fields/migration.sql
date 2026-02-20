/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Perfume` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `PerfumeHouse` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `Perfume` table without a default value. This is not possible if the table is not empty.
  - Added the required column `slug` to the `PerfumeHouse` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Perfume" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PerfumeHouse" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserPerfumeWishlist" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "Perfume_slug_key" ON "Perfume"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PerfumeHouse_slug_key" ON "PerfumeHouse"("slug");
