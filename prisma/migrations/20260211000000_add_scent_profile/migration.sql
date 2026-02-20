-- CreateTable
CREATE TABLE "ScentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteWeights" JSONB NOT NULL,
    "avoidNoteIds" JSONB NOT NULL,
    "preferredPriceRange" JSONB,
    "seasonHint" TEXT,
    "browsingStyle" TEXT,
    "lastQuizAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScentProfile_userId_key" ON "ScentProfile"("userId");

-- CreateIndex
CREATE INDEX "ScentProfile_userId_idx" ON "ScentProfile"("userId");

-- AddForeignKey
ALTER TABLE "ScentProfile" ADD CONSTRAINT "ScentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
