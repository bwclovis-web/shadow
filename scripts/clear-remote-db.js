// Script to clear all data from remote database
// This deletes data in reverse dependency order to respect foreign keys
//
// Usage: node scripts/clear-remote-db.js
// Add --confirm to actually run (without it, just shows what would be deleted)

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

const REMOTE_DATABASE_URL = process.env.REMOTE_DATABASE_URL

if (!REMOTE_DATABASE_URL) {
  console.error("❌ REMOTE_DATABASE_URL not set in .env")
  process.exit(1)
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: REMOTE_DATABASE_URL,
    },
  },
})

const CONFIRM = process.argv.includes("--confirm")

async function main() {
  console.log("🗑️  Clear Remote Database Script")
  console.log("================================")
  console.log(`Target: ${REMOTE_DATABASE_URL.substring(0, 50)}...`)
  console.log("")

  if (!CONFIRM) {
    console.log("⚠️  DRY RUN MODE - No data will be deleted")
    console.log("   Add --confirm to actually delete data")
    console.log("")
  }

  // Delete in reverse dependency order
  const tables = [
    // First: tables with no dependents
    { name: "MigrationState", model: prisma.migrationState },
    { name: "WishlistNotification", model: prisma.wishlistNotification },
    { name: "UserPerfumeComment", model: prisma.userPerfumeComment },
    { name: "UserPerfumeWishlist", model: prisma.userPerfumeWishlist },
    { name: "UserPerfumeReview", model: prisma.userPerfumeReview },
    { name: "UserPerfumeRating", model: prisma.userPerfumeRating },
    { name: "UserPerfume", model: prisma.userPerfume },
    { name: "UserAlert", model: prisma.userAlert },
    { name: "UserAlertPreferences", model: prisma.userAlertPreferences },
    { name: "PerfumeNoteRelation", model: prisma.perfumeNoteRelation },
    { name: "PerfumeNotes", model: prisma.perfumeNotes },
    { name: "TraderFeedback", model: prisma.traderFeedback },
    { name: "TraderContactMessage", model: prisma.traderContactMessage },
    { name: "PendingSubmission", model: prisma.pendingSubmission },
    { name: "SecurityAuditLog", model: prisma.securityAuditLog },
    // Then: tables with dependents
    { name: "Perfume", model: prisma.perfume },
    { name: "PerfumeHouse", model: prisma.perfumeHouse },
    { name: "User", model: prisma.user },
  ]

  for (const table of tables) {
    try {
      const count = await table.model.count()
      
      if (CONFIRM) {
        if (count > 0) {
          await table.model.deleteMany({})
          console.log(`✅ Deleted ${count} records from ${table.name}`)
        } else {
          console.log(`⏭️  ${table.name}: empty`)
        }
      } else {
        console.log(`   ${table.name}: ${count} records would be deleted`)
      }
    } catch (error) {
      console.error(`❌ Error with ${table.name}:`, error.message)
    }
  }

  console.log("")
  if (CONFIRM) {
    console.log("✅ Remote database cleared!")
    console.log("")
    console.log("Next steps:")
    console.log("  1. Run: node scripts/migrate-to-accelerate-fixed.js")
    console.log("  2. This will sync all local data to remote with matching IDs")
  } else {
    console.log("To actually delete, run:")
    console.log("  node scripts/clear-remote-db.js --confirm")
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
