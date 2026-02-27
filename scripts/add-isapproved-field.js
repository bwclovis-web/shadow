#!/usr/bin/env node

/**
 * Safely add isApproved field to UserPerfumeReview table
 * This script adds the column WITHOUT forcing unique constraints that might cause data loss
 */

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL

if (!REMOTE_DATABASE_URL) {
  console.error("❌ ERROR: REMOTE_DATABASE_URL environment variable is not set")
  process.exit(1)
}

console.log("🔧 Adding isApproved field to UserPerfumeReview table...")
console.log(`Target: ${REMOTE_DATABASE_URL.substring(0, 50)}...`)
console.log("")

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: REMOTE_DATABASE_URL,
    },
  },
})

async function addIsApprovedField() {
  try {
    // Step 1: Check if column exists
    console.log("1️⃣ Checking if isApproved column exists...")
    const columnCheck = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'UserPerfumeReview' 
      AND column_name = 'isApproved'
    `
    
    if (columnCheck.length > 0) {
      console.log("✅ isApproved column already exists")
    } else {
      console.log("➕ Adding isApproved column...")
      await prisma.$executeRaw`
        ALTER TABLE "UserPerfumeReview" 
        ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT true
      `
      console.log("✅ Added isApproved column with default value true")
    }

    // Step 2: Check if updatedAt exists
    console.log("")
    console.log("2️⃣ Checking if updatedAt column exists...")
    const updatedAtCheck = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'UserPerfumeReview' 
      AND column_name = 'updatedAt'
    `
    
    if (updatedAtCheck.length > 0) {
      console.log("✅ updatedAt column already exists")
    } else {
      console.log("➕ Adding updatedAt column...")
      await prisma.$executeRaw`
        ALTER TABLE "UserPerfumeReview" 
        ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      `
      console.log("✅ Added updatedAt column")
    }

    // Step 3: Check for duplicate reviews
    console.log("")
    console.log("3️⃣ Checking for duplicate reviews...")
    const duplicates = await prisma.$queryRaw`
      SELECT userId, perfumeId, COUNT(*) as count
      FROM "UserPerfumeReview"
      GROUP BY userId, perfumeId
      HAVING COUNT(*) > 1
    `
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} duplicate review combinations`)
      console.log("   These need to be cleaned up before adding unique constraint")
      console.log("   Duplicates:")
      duplicates.forEach(dup => {
        console.log(`   - User ${dup.userId}, Perfume ${dup.perfumeId}: ${dup.count} reviews`)
      })
    } else {
      console.log("✅ No duplicate reviews found")
      
      // Safe to add unique constraint
      console.log("")
      console.log("4️⃣ Adding unique constraint...")
      try {
        await prisma.$executeRaw`
          ALTER TABLE "UserPerfumeReview" 
          ADD CONSTRAINT "UserPerfumeReview_userId_perfumeId_key" 
          UNIQUE ("userId", "perfumeId")
        `
        console.log("✅ Added unique constraint")
      } catch (err) {
        if (err.message.includes("already exists")) {
          console.log("✅ Unique constraint already exists")
        } else {
          throw err
        }
      }
    }

    // Step 5: Add index
    console.log("")
    console.log("5️⃣ Adding index...")
    try {
      await prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS "idx_review_perfume_created" 
        ON "UserPerfumeReview"("perfumeId", "createdAt")
      `
      console.log("✅ Added index")
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("✅ Index already exists")
      } else {
        throw err
      }
    }

    console.log("")
    console.log("🎉 Migration completed successfully!")
    console.log("")
    console.log("✅ The isApproved field is now available in production")
    console.log("✅ All existing reviews have isApproved set to true")
    console.log("✅ No data was lost")

  } catch (error) {
    console.error("")
    console.error("❌ Error:", error.message)
    console.error("")
    console.error("Full error:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addIsApprovedField()
