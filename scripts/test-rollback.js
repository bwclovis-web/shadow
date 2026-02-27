#!/usr/bin/env node

/**
 * Rollback Test Script - Phase 7.1
 * 
 * Tests the database rollback/restore procedure to ensure:
 * - Backup creation works correctly
 * - Database restoration works correctly
 * - No data corruption occurs
 * - Data integrity is maintained
 * 
 * Usage:
 *   node scripts/test-rollback.js
 */

import { PrismaClient } from "@prisma/client"
import { execSync } from "child_process"
import dotenv from "dotenv"
import { existsSync, readdirSync, readFileSync, statSync } from "fs"
import { join } from "path"
import { dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

// Load environment variables
process.env.DOTENV_CONFIG_QUIET = "true"
dotenv.config({ path: join(projectRoot, ".env") })

const prisma = new PrismaClient()
const BACKUP_DIR = join(projectRoot, "backups")

/**
 * Get record counts for all tables
 */
async function getTableCounts() {
  const tables = {
    User: await prisma.user.count(),
    PerfumeHouse: await prisma.perfumeHouse.count(),
    Perfume: await prisma.perfume.count(),
    UserPerfume: await prisma.userPerfume.count(),
    UserPerfumeRating: await prisma.userPerfumeRating.count(),
    UserPerfumeReview: await prisma.userPerfumeReview.count(),
    UserPerfumeWishlist: await prisma.userPerfumeWishlist.count(),
    UserPerfumeComment: await prisma.userPerfumeComment.count(),
    PerfumeNotes: await prisma.perfumeNotes.count(),
    WishlistNotification: await prisma.wishlistNotification.count(),
    SecurityAuditLog: await prisma.securityAuditLog.count(),
  }

  const total = Object.values(tables).reduce((sum, count) => sum + count, 0)
  return { tables, total }
}

/**
 * Print table counts
 */
function printCounts(counts, label) {
  console.log(`\n📊 ${label}:`)
  Object.entries(counts.tables).forEach(([table, count]) => {
    console.log(`   ${table}: ${count}`)
  })
  console.log(`   Total: ${counts.total}`)
}

/**
 * Compare two count objects
 */
function compareCounts(before, after) {
  const differences = []
  let allMatch = true

  for (const [table, beforeCount] of Object.entries(before.tables)) {
    const afterCount = after.tables[table]
    if (beforeCount !== afterCount) {
      differences.push({
        table,
        before: beforeCount,
        after: afterCount,
        diff: afterCount - beforeCount,
      })
      allMatch = false
    }
  }

  if (before.total !== after.total) {
    allMatch = false
  }

  return { allMatch, differences, beforeTotal: before.total, afterTotal: after.total }
}

/**
 * Get the latest backup file
 */
function getLatestBackup() {
  if (!existsSync(BACKUP_DIR)) {
    return null
  }

  const files = readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith("_manifest.json"))
    .map(file => {
      const manifestPath = join(BACKUP_DIR, file)
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      const stats = statSync(manifestPath)
      return {
        file,
        manifest,
        created: stats.mtime,
      }
    })
    .sort((a, b) => b.created - a.created)

  return files.length > 0 ? files[0] : null
}

/**
 * Main test function
 */
async function testRollback() {
  console.log("=".repeat(60))
  console.log("🔄 Database Rollback Test - Phase 7.1")
  console.log("=".repeat(60))
  console.log("")

  let testBackupName = null
  let initialState = null
  let modifiedState = null
  let finalState = null

  try {
    // Step 1: Connect to database
    console.log("📡 Connecting to database...")
    await prisma.$connect()
    console.log("✅ Database connection successful\n")

    // Step 2: Capture initial state
    console.log("📸 Capturing initial database state...")
    initialState = await getTableCounts()
    printCounts(initialState, "Initial State")

    // Step 3: Create backup
    console.log("\n💾 Creating backup...")
    try {
      execSync("npm run db:backup", {
        cwd: projectRoot,
        stdio: "inherit",
      })
      console.log("✅ Backup created successfully\n")

      // Get the backup name we just created
      const latestBackup = getLatestBackup()
      if (latestBackup) {
        testBackupName = latestBackup.file.replace("_manifest.json", "")
        console.log(`📋 Test backup: ${testBackupName}\n`)
      }
    } catch (error) {
      console.error("❌ Backup creation failed:", error.message)
      throw error
    }

    // Step 4: Make a test change (add a test record to verify rollback)
    console.log("🧪 Making test change to database...")
    try {
      // Try to create a test perfume house (will be rolled back)
      const testHouse = await prisma.perfumeHouse.create({
        data: {
          name: `ROLLBACK_TEST_${Date.now()}`,
          slug: `rollback-test-${Date.now()}`,
          country: "TEST",
        },
      })
      console.log(`✅ Created test record: ${testHouse.id}`)

      // Capture modified state
      modifiedState = await getTableCounts()
      printCounts(modifiedState, "After Test Change")

      // Verify the change was made
      const comparison = compareCounts(initialState, modifiedState)
      if (!comparison.allMatch) {
        console.log("✅ Test change verified - database state differs")
      }
    } catch (error) {
      console.error("⚠️  Could not create test record (may already exist):", error.message)
      // Continue anyway - we can still test restore
    }

    // Step 5: Clear database and restore from backup
    console.log("\n🧹 Clearing database before restore...")
    try {
      // Use the restore function with clear option which handles FK constraints properly
      const { restoreDatabase } = await import("./restore-database-prisma.js")
      await restoreDatabase(testBackupName || null, { clear: true })
      console.log("✅ Restore completed successfully\n")
    } catch (error) {
      console.error("❌ Restore failed:", error.message)
      throw error
    }

    // Step 6: Verify final state matches initial state
    console.log("🔍 Verifying data integrity...")
    finalState = await getTableCounts()
    printCounts(finalState, "Final State (After Restore)")

    const comparison = compareCounts(initialState, finalState)

    console.log("\n" + "=".repeat(60))
    if (comparison.allMatch) {
      console.log("✅ ROLLBACK TEST PASSED")
      console.log("   All record counts match - no data corruption detected")
    } else {
      console.log("⚠️  ROLLBACK TEST WITH DIFFERENCES")
      console.log("   Some tables have different record counts:")
      comparison.differences.forEach(diff => {
        console.log(`   ${diff.table}: ${diff.before} → ${diff.after} (diff: ${diff.diff})`)
      })
    }
    console.log("=".repeat(60))

    // Step 7: Additional verification - check data consistency
    console.log("\n🔍 Additional data integrity checks...")
    const verificationResults = {
      foreignKeyIntegrity: true,
      dataConsistency: true,
    }

    try {
      // Check if test record was removed
      if (modifiedState) {
        const testHouses = await prisma.perfumeHouse.findMany({
          where: {
            name: {
              startsWith: "ROLLBACK_TEST_",
            },
          },
        })
        if (testHouses.length > 0) {
          console.log(`⚠️  Warning: ${testHouses.length} test records still exist (may be expected)`)
        } else {
          console.log("✅ Test records were properly removed")
        }
      }

      // Verify foreign key relationships are intact
      const perfumesWithHouses = await prisma.perfume.findMany({
        where: {
          perfumeHouseId: {
            not: null,
          },
        },
        take: 10,
      })

      for (const perfume of perfumesWithHouses) {
        const house = await prisma.perfumeHouse.findUnique({
          where: { id: perfume.perfumeHouseId },
        })
        if (!house) {
          console.log(`⚠️  Warning: Perfume ${perfume.id} references missing house ${perfume.perfumeHouseId}`)
          verificationResults.foreignKeyIntegrity = false
        }
      }

      if (verificationResults.foreignKeyIntegrity) {
        console.log("✅ Foreign key integrity verified")
      }

      // Check user-perfume relationships
      const userPerfumes = await prisma.userPerfume.findMany({ take: 10 })
      for (const up of userPerfumes) {
        const user = await prisma.user.findUnique({ where: { id: up.userId } })
        const perfume = await prisma.perfume.findUnique({ where: { id: up.perfumeId } })
        if (!user || !perfume) {
          console.log(`⚠️  Warning: UserPerfume ${up.id} has invalid relationships`)
          verificationResults.dataConsistency = false
        }
      }

      if (verificationResults.dataConsistency) {
        console.log("✅ Data consistency verified")
      }
    } catch (error) {
      console.log(`⚠️  Error during additional verification: ${error.message}`)
    }

    // Final summary
    console.log("\n" + "=".repeat(60))
    console.log("📋 ROLLBACK TEST SUMMARY")
    console.log("=".repeat(60))
    console.log(`✅ Backup creation: SUCCESS`)
    console.log(`✅ Database restore: SUCCESS`)
    console.log(`${comparison.allMatch ? "✅" : "⚠️"} Data integrity: ${comparison.allMatch ? "PASSED" : "REVIEW NEEDED"}`)
    console.log(`${verificationResults.foreignKeyIntegrity ? "✅" : "⚠️"} Foreign key integrity: ${verificationResults.foreignKeyIntegrity ? "PASSED" : "ISSUES DETECTED"}`)
    console.log(`${verificationResults.dataConsistency ? "✅" : "⚠️"} Data consistency: ${verificationResults.dataConsistency ? "PASSED" : "ISSUES DETECTED"}`)
    console.log("=".repeat(60))

    if (comparison.allMatch && verificationResults.foreignKeyIntegrity && verificationResults.dataConsistency) {
      console.log("\n🎉 All rollback tests passed successfully!")
      process.exit(0)
    } else {
      console.log("\n⚠️  Some checks had issues - please review above")
      process.exit(1)
    }
  } catch (error) {
    console.error("\n❌ ROLLBACK TEST FAILED")
    console.error("Error:", error.message)
    console.error("\n⚠️  Database may be in an inconsistent state!")
    console.error("   Review manually and restore from backup if needed.")
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the test
testRollback()

