-- CreateTable
CREATE TABLE IF NOT EXISTS "TraderContactMessage" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TraderContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderContactMessage_senderId_createdAt_idx') THEN
        CREATE INDEX "TraderContactMessage_senderId_createdAt_idx" ON "TraderContactMessage"("senderId", "createdAt");
    END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderContactMessage_recipientId_createdAt_idx') THEN
        CREATE INDEX "TraderContactMessage_recipientId_createdAt_idx" ON "TraderContactMessage"("recipientId", "createdAt");
    END IF;
END $$;

-- CreateIndex
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'TraderContactMessage_senderId_recipientId_createdAt_idx') THEN
        CREATE INDEX "TraderContactMessage_senderId_recipientId_createdAt_idx" ON "TraderContactMessage"("senderId", "recipientId", "createdAt");
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TraderContactMessage" ADD CONSTRAINT "TraderContactMessage_senderId_fkey" 
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TraderContactMessage" ADD CONSTRAINT "TraderContactMessage_recipientId_fkey" 
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
