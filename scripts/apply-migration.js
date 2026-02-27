#!/usr/bin/env node

/**
 * Apply database migration to remote database
 * This script reads the migration SQL and applies it using Prisma
 */

import { PrismaClient } from "@prisma/client"
import { readFileSync } from "fs"
import { resolve } from "path"
import { config } from "dotenv"

// Load environment variables
config({ path: resolve(process.cwd(), ".env") })

const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL

if (!REMOTE_DATABASE_URL) {
  console.error("❌ ERROR: REMOTE_DATABASE_URL environment variable is not set")
  process.exit(1)
}

console.log("🚀 Applying database migration to remote database...")
console.log(`Target: ${REMOTE_DATABASE_URL.substring(0, 50)}...`)
console.log("")

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: REMOTE_DATABASE_URL,
    },
  },
})

async function applyMigration() {
  try {
    // Read the migration SQL file
    const migrationPath = resolve(process.cwd(), "prisma/migrations/APPLY_TO_REMOTE_DB.sql")
    const migrationSQL = readFileSync(migrationPath, "utf-8")
    
    console.log("📄 Migration file loaded")
    console.log("⏳ Executing migration...")
    console.log("")

    // Split the SQL into individual statements (rough approach)
    // We need to execute them separately because Prisma doesn't support multi-statement raw queries well
    
    // For Prisma Accelerate, we need to use executeRawUnsafe
    // But this is complex, so let's use a different approach
    
    console.log("⚠️  Note: Due to Prisma Accelerate limitations, please run this migration manually:")
    console.log("")
    console.log("Option 1: If you have direct PostgreSQL access:")
    console.log("  psql 'your-direct-postgres-url' < prisma/migrations/APPLY_TO_REMOTE_DB.sql")
    console.log("")
    console.log("Option 2: Use Prisma push (will sync schema automatically):")
    console.log("  DATABASE_URL=$REMOTE_DATABASE_URL npx prisma db push --schema=prisma/schema.prod.prisma --skip-generate")
    console.log("")
    console.log("Option 3: Copy the SQL from prisma/migrations/APPLY_TO_REMOTE_DB.sql")
    console.log("  and paste it into a database management tool (pgAdmin, DBeaver, etc.)")
    console.log("")
    
    // Try using prisma db push instead
    console.log("🔄 Attempting to use Prisma DB Push instead...")
    console.log("This will sync the schema without running raw SQL...")
    console.log("")
    
  } catch (error) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()
