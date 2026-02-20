-- CreateTable for migration tracking
CREATE TABLE IF NOT EXISTS "MigrationState" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "lastMigratedAt" TIMESTAMP(3) NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'MigrationState_tableName_key') THEN
        CREATE UNIQUE INDEX "MigrationState_tableName_key" ON "MigrationState"("tableName");
    END IF;
END $$;
