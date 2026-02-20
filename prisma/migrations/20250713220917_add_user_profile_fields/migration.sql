-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'editor');

-- CreateEnum
CREATE TYPE "HouseType" AS ENUM ('niche', 'designer', 'indie', 'celebrity', 'drugstore');

-- CreateEnum
CREATE TYPE "PerfumeType" AS ENUM ('eauDeParfum', 'eauDeToilette', 'eauDeCologne', 'parfum', 'extraitDeParfum', 'extraitOil', 'oil', 'waterMist', 'ipmSpray');

-- CreateEnum
CREATE TYPE "TradePreference" AS ENUM ('cash', 'trade', 'both');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfumeHouse" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "website" TEXT,
    "country" TEXT,
    "founded" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" "HouseType" NOT NULL DEFAULT 'indie',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfumeHouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perfume" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "perfumeHouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Perfume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerfume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "amount" TEXT NOT NULL DEFAULT '0',
    "available" TEXT NOT NULL DEFAULT '0',
    "price" TEXT,
    "placeOfPurchase" TEXT,
    "tradePrice" TEXT,
    "tradePreference" "TradePreference" NOT NULL DEFAULT 'cash',
    "tradeOnly" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "PerfumeType" NOT NULL DEFAULT 'eauDeParfum',

    CONSTRAINT "UserPerfume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerfumeRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPerfumeRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerfumeReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "review" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPerfumeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerfumeWishlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPerfumeWishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPerfumeComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "userPerfumeId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPerfumeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfumeNotes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "perfumeOpenId" TEXT,
    "perfumeHeartId" TEXT,
    "perfumeCloseId" TEXT,

    CONSTRAINT "PerfumeNotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "perfumeId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "PerfumeHouse_name_key" ON "PerfumeHouse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Perfume_name_key" ON "Perfume"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PerfumeNotes_name_key" ON "PerfumeNotes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistNotification_userId_perfumeId_key" ON "WishlistNotification"("userId", "perfumeId");

-- AddForeignKey
ALTER TABLE "Perfume" ADD CONSTRAINT "Perfume_perfumeHouseId_fkey" FOREIGN KEY ("perfumeHouseId") REFERENCES "PerfumeHouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfume" ADD CONSTRAINT "UserPerfume_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfume" ADD CONSTRAINT "UserPerfume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeRating" ADD CONSTRAINT "UserPerfumeRating_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeRating" ADD CONSTRAINT "UserPerfumeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeReview" ADD CONSTRAINT "UserPerfumeReview_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeReview" ADD CONSTRAINT "UserPerfumeReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeWishlist" ADD CONSTRAINT "UserPerfumeWishlist_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeWishlist" ADD CONSTRAINT "UserPerfumeWishlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeComment" ADD CONSTRAINT "UserPerfumeComment_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeComment" ADD CONSTRAINT "UserPerfumeComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPerfumeComment" ADD CONSTRAINT "UserPerfumeComment_userPerfumeId_fkey" FOREIGN KEY ("userPerfumeId") REFERENCES "UserPerfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfumeNotes" ADD CONSTRAINT "PerfumeNotes_perfumeCloseId_fkey" FOREIGN KEY ("perfumeCloseId") REFERENCES "Perfume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfumeNotes" ADD CONSTRAINT "PerfumeNotes_perfumeHeartId_fkey" FOREIGN KEY ("perfumeHeartId") REFERENCES "Perfume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfumeNotes" ADD CONSTRAINT "PerfumeNotes_perfumeOpenId_fkey" FOREIGN KEY ("perfumeOpenId") REFERENCES "Perfume"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistNotification" ADD CONSTRAINT "WishlistNotification_perfumeId_fkey" FOREIGN KEY ("perfumeId") REFERENCES "Perfume"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistNotification" ADD CONSTRAINT "WishlistNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
