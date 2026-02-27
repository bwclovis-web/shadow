#!/usr/bin/env node

/**
 * Pull production database down to local.
 * Reads from REMOTE_DATABASE_URL (production) and writes to LOCAL_DATABASE_URL
 * (or DATABASE_URL if LOCAL_DATABASE_URL is not set).
 *
 * Usage: node scripts/pull-production-to-local.js
 *        npm run db:pull:production
 *
 * Requires in .env:
 *   REMOTE_DATABASE_URL  - production DB (e.g. Prisma Accelerate or direct Postgres)
 *   LOCAL_DATABASE_URL   - local DB (or DATABASE_URL is used as target)
 *
 * WARNING: This CLEARS and REPLACES data in the local database for the tables
 * that are copied. Backup locally first if needed: npm run db:backup
 */

import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, "..")
dotenv.config({ path: join(projectRoot, ".env") })

const REMOTE_URL = process.env.REMOTE_DATABASE_URL
const LOCAL_URL = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL

if (!REMOTE_URL) {
  console.error("❌ REMOTE_DATABASE_URL is not set in .env")
  process.exit(1)
}
if (!LOCAL_URL) {
  console.error("❌ Neither LOCAL_DATABASE_URL nor DATABASE_URL is set in .env")
  process.exit(1)
}

// Same table set as backup-database-prisma.js / restore-database-prisma.js
const TABLE_CONFIG = [
  { name: "User", modelKey: "user" },
  { name: "PerfumeHouse", modelKey: "perfumeHouse" },
  { name: "Perfume", modelKey: "perfume" },
  { name: "UserPerfume", modelKey: "userPerfume" },
  { name: "UserPerfumeRating", modelKey: "userPerfumeRating" },
  { name: "UserPerfumeReview", modelKey: "userPerfumeReview" },
  { name: "UserPerfumeWishlist", modelKey: "userPerfumeWishlist" },
  { name: "UserPerfumeComment", modelKey: "userPerfumeComment" },
  { name: "PerfumeNotes", modelKey: "perfumeNotes" },
  { name: "WishlistNotification", modelKey: "wishlistNotification" },
  { name: "SecurityAuditLog", modelKey: "securityAuditLog" },
]

// Clear order: reverse FK dependency (same as restore-database-prisma.js)
const CLEAR_ORDER = [
  "securityAuditLog",
  "wishlistNotification",
  "userPerfumeComment",
  "userPerfumeWishlist",
  "userPerfumeReview",
  "userPerfumeRating",
  "userPerfume",
  "perfumeNotes",
  "perfume",
  "perfumeHouse",
  "user",
]

async function main() {
  const prismaRemote = new PrismaClient({
    datasources: { db: { url: REMOTE_URL } },
  })
  const prismaLocal = new PrismaClient({
    datasources: { db: { url: LOCAL_URL } },
  })

  try {
    console.log("📥 Pulling production → local")
    console.log("   Source: REMOTE_DATABASE_URL")
    console.log("   Target:", LOCAL_URL === process.env.DATABASE_URL ? "DATABASE_URL" : "LOCAL_DATABASE_URL")
    console.log("")

    // 1. Export from production
    console.log("📊 Exporting from production...")
    await prismaRemote.$connect()
    const tableData = []
    let totalRecords = 0
    for (const { name, modelKey } of TABLE_CONFIG) {
      const data = await prismaRemote[modelKey].findMany()
      tableData.push({ table: name, count: data.length, data })
      totalRecords += data.length
      console.log(`   ${name}: ${data.length} records`)
    }
    await prismaRemote.$disconnect()

    if (totalRecords === 0) {
      console.error("❌ Production database has no data in these tables. Nothing to pull.")
      process.exit(1)
    }
    console.log(`   Total: ${totalRecords} records\n`)

    // 2. Clear local (same order as restore script)
    console.log("🧹 Clearing local tables...")
    await prismaLocal.$connect()
    for (const table of CLEAR_ORDER) {
      try {
        const result = await prismaLocal[table].deleteMany()
        console.log(`   Cleared ${table}: ${result.count} records`)
      } catch (err) {
        console.log(`   Skipped ${table}: ${err.message}`)
      }
    }

    // 3. Restore into local
    console.log("\n📤 Restoring into local...")
    const BATCH_SIZE = 500
    for (const { table: tableName, count, data } of tableData) {
      if (count === 0) continue
      const modelKey = TABLE_CONFIG.find(t => t.name === tableName)?.modelKey
      if (!modelKey || !prismaLocal[modelKey]) continue
      const model = prismaLocal[modelKey]
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE)
        await model.createMany({ data: batch, skipDuplicates: true })
      }
      console.log(`   ${tableName}: ${count} records`)
    }

    await prismaLocal.$disconnect()
    console.log("\n✅ Done. Local database now has a copy of production data.")
  } catch (err) {
    console.error("❌ Error:", err.message)
    await prismaRemote.$disconnect().catch(() => {})
    await prismaLocal.$disconnect().catch(() => {})
    process.exit(1)
  }
}

main()
