#!/usr/bin/env node

/**
 * Verify remote database schema
 */

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL

console.log("🔍 Verifying Remote Database Schema...")
console.log("=" .repeat(50))
console.log("")

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: REMOTE_DATABASE_URL,
    },
  },
})

async function verifySchema() {
  try {
    // Check 1: Verify PerfumeNoteRelation table exists
    console.log("1️⃣ Checking PerfumeNoteRelation table...")
    try {
      const noteRelationsCount = await prisma.perfumeNoteRelation.count()
      console.log(`   ✅ PerfumeNoteRelation table exists (${noteRelationsCount} records)`)
    } catch (err) {
      console.log(`   ❌ PerfumeNoteRelation table NOT found: ${err.message}`)
    }

    // Check 2: Verify UserPerfumeReview has isApproved column
    console.log("")
    console.log("2️⃣ Checking UserPerfumeReview.isApproved column...")
    try {
      const reviews = await prisma.userPerfumeReview.findMany({
        where: { isApproved: true },
        take: 1,
      })
      console.log(`   ✅ isApproved column exists and is queryable`)
    } catch (err) {
      console.log(`   ❌ isApproved column issue: ${err.message}`)
    }

    // Check 3: Verify UserPerfumeReview has updatedAt column
    console.log("")
    console.log("3️⃣ Checking UserPerfumeReview.updatedAt column...")
    try {
      const reviews = await prisma.userPerfumeReview.findMany({
        select: { id: true, updatedAt: true },
        take: 1,
      })
      console.log(`   ✅ updatedAt column exists`)
    } catch (err) {
      console.log(`   ❌ updatedAt column issue: ${err.message}`)
    }

    // Check 4: Verify SecurityAuditLog table
    console.log("")
    console.log("4️⃣ Checking SecurityAuditLog table...")
    try {
      const auditCount = await prisma.securityAuditLog.count()
      console.log(`   ✅ SecurityAuditLog table exists (${auditCount} records)`)
    } catch (err) {
      console.log(`   ❌ SecurityAuditLog table NOT found: ${err.message}`)
    }

    // Check 5: Verify TraderFeedback table
    console.log("")
    console.log("5️⃣ Checking TraderFeedback table...")
    try {
      const feedbackCount = await prisma.traderFeedback.count()
      console.log(`   ✅ TraderFeedback table exists (${feedbackCount} records)`)
    } catch (err) {
      console.log(`   ❌ TraderFeedback table NOT found: ${err.message}`)
    }

    // Check 6: Verify UserAlert table
    console.log("")
    console.log("6️⃣ Checking UserAlert table...")
    try {
      const alertsCount = await prisma.userAlert.count()
      console.log(`   ✅ UserAlert table exists (${alertsCount} records)`)
    } catch (err) {
      console.log(`   ❌ UserAlert table NOT found: ${err.message}`)
    }

    // Check 7: Verify PendingSubmission table
    console.log("")
    console.log("7️⃣ Checking PendingSubmission table...")
    try {
      const submissionsCount = await prisma.pendingSubmission.count()
      console.log(`   ✅ PendingSubmission table exists (${submissionsCount} records)`)
    } catch (err) {
      console.log(`   ❌ PendingSubmission table NOT found: ${err.message}`)
    }

    // Check 8: Verify TraderContactMessage table
    console.log("")
    console.log("8️⃣ Checking TraderContactMessage table...")
    try {
      const messagesCount = await prisma.traderContactMessage.count()
      console.log(`   ✅ TraderContactMessage table exists (${messagesCount} records)`)
    } catch (err) {
      console.log(`   ❌ TraderContactMessage table NOT found: ${err.message}`)
    }

    // Check 9: Verify MigrationState table
    console.log("")
    console.log("9️⃣ Checking MigrationState table...")
    try {
      const migrationCount = await prisma.migrationState.count()
      console.log(`   ✅ MigrationState table exists (${migrationCount} records)`)
    } catch (err) {
      console.log(`   ❌ MigrationState table NOT found: ${err.message}`)
    }

    // Check 10: Test a perfume query with notes
    console.log("")
    console.log("🔟 Testing perfume query with notes...")
    try {
      const perfume = await prisma.perfume.findFirst({
        include: {
          perfumeHouse: true,
          perfumeNoteRelations: {
            include: {
              note: true,
            },
          },
        },
      })
      if (perfume) {
        console.log(`   ✅ Perfume queries work! Found: "${perfume.name}"`)
        console.log(`   ℹ️  Has ${perfume.perfumeNoteRelations.length} note relations`)
      } else {
        console.log(`   ⚠️  No perfumes in database yet`)
      }
    } catch (err) {
      console.log(`   ❌ Perfume query failed: ${err.message}`)
    }

    console.log("")
    console.log("=" .repeat(50))
    console.log("✅ Schema verification complete!")
    console.log("")

  } catch (error) {
    console.error("")
    console.error("❌ Verification failed:", error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifySchema()
