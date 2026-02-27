#!/usr/bin/env node
/* eslint-disable max-statements */
/* eslint-disable no-console */

/**
 * Database Restore Script using Prisma
 * Restores database from Prisma-generated backups
 */

import { PrismaClient } from "@prisma/client"
import { existsSync, readdirSync, readFileSync, statSync } from "fs"
import { join } from "path"
import { dirname } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")

// Load environment variables
import dotenv from "dotenv"
process.env.DOTENV_CONFIG_QUIET = "true"
dotenv.config({ path: join(projectRoot, ".env") })

// Configuration
const BACKUP_DIR = join(projectRoot, "backups")

// Initialize Prisma client
const prisma = new PrismaClient()

// List available backups (only those that have both manifest and _data.json)
function listBackups() {
  if (!existsSync(BACKUP_DIR)) {
    console.log("❌ No backup directory found")
    return []
  }

  const files = readdirSync(BACKUP_DIR)
    .filter(file => file.endsWith("_manifest.json"))
    .map(file => {
      const manifestPath = join(BACKUP_DIR, file)
      const dataPath = join(BACKUP_DIR, file.replace("_manifest.json", "_data.json"))
      return { file, manifestPath, dataPath }
    })
    .filter(({ dataPath }) => existsSync(dataPath))
    .map(({ file, manifestPath, dataPath }) => {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
      const stats = statSync(manifestPath)
      return {
        file,
        manifest,
        created: stats.mtime,
        size: stats.size,
        dataPath,
      }
    })
    .sort((a, b) => b.created - a.created)

  return files
}

// Clear all data from tables
async function clearDatabase() {
  console.log("🧹 Clearing existing data...")

  // Clear in reverse order to respect foreign key constraints
  const tables = [
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

  for (const table of tables) {
    try {
      const result = await prisma[table].deleteMany()
      console.log(`  Cleared ${table}: ${result.count} records`)
    } catch (error) {
      console.log(`  Skipped ${table}: ${error.message}`)
    }
  }
}

// Restore data from JSON backup
async function restoreFromJson(backupFile) {
  console.log(`📖 Reading JSON backup: ${backupFile}`)
  const backup = JSON.parse(readFileSync(backupFile, "utf8"))

  console.log(`📊 Restoring ${backup.totalRecords} records from ${backup.tables.length} tables`)

  // Restore tables in order to respect foreign key constraints
  const tableOrder = [
    "User",
    "PerfumeHouse",
    "Perfume",
    "UserPerfume",
    "UserPerfumeRating",
    "UserPerfumeReview",
    "UserPerfumeWishlist",
    "UserPerfumeComment",
    "PerfumeNotes",
    "WishlistNotification",
    "SecurityAuditLog",
  ]

  for (const tableName of tableOrder) {
    const tableData = backup.tables.find(t => t.table === tableName)
    if (!tableData || tableData.count === 0) {
      console.log(`  ⏭️  Skipping ${tableName}: no data`)
      continue
    }

    console.log(`  📊 Restoring ${tableName}: ${tableData.count} records`)

    try {
      // Map table names to Prisma models
      const modelMap = {
        User: prisma.user,
        PerfumeHouse: prisma.perfumeHouse,
        Perfume: prisma.perfume,
        UserPerfume: prisma.userPerfume,
        UserPerfumeRating: prisma.userPerfumeRating,
        UserPerfumeReview: prisma.userPerfumeReview,
        UserPerfumeWishlist: prisma.userPerfumeWishlist,
        UserPerfumeComment: prisma.userPerfumeComment,
        PerfumeNotes: prisma.perfumeNotes,
        WishlistNotification: prisma.wishlistNotification,
        SecurityAuditLog: prisma.securityAuditLog,
      }

      const model = modelMap[tableName]
      if (!model) {
        console.log(`    ❌ Unknown model: ${tableName}`)
        continue
      }

      // Insert data in batches
      const batchSize = 1000
      const records = tableData.data

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize)
        await model.createMany({
          data: batch,
          skipDuplicates: true,
        })
        console.log(`    ✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`)
      }
    } catch (error) {
      console.error(`    ❌ Error restoring ${tableName}:`, error.message)
    }
  }
}

// Main restore function
async function restoreDatabase(backupName, options = {}) {
  try {
    console.log("🔄 Starting database restore...")

    // Test database connection
    await prisma.$connect()
    console.log("✅ Database connection successful")

    // Find backup
    const backups = listBackups()
    let selectedBackup = null

    if (backupName) {
      selectedBackup = backups.find(b => b.file.includes(backupName))
      if (!selectedBackup) {
        console.log("❌ Backup not found. Available backups:")
        backups.forEach((backup, index) => {
          console.log(`  ${index + 1}. ${backup.manifest.timestamp}`)
        })
        return
      }
    } else {
      if (backups.length === 0) {
        console.log("❌ No backups found")
        return
      }
      selectedBackup = backups[0] // Use latest
    }

    console.log(`📋 Selected backup: ${selectedBackup.manifest.timestamp}`)

    // Clear existing data if requested
    if (options.clear) {
      await clearDatabase()
    }

    const jsonBackupFile = selectedBackup.dataPath
    if (!existsSync(jsonBackupFile)) {
      console.log("❌ JSON backup file not found")
      return
    }

    // Restore data
    await restoreFromJson(jsonBackupFile)

    console.log("\n✅ Database restore completed successfully!")
  } catch (error) {
    console.error("\n❌ Restore failed:", error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2)
  const backupName = args[0]
  const options = {
    clear: args.includes("--clear"),
  }

  if (args.includes("--list")) {
    const backups = listBackups()
    if (backups.length === 0) {
      console.log("❌ No backups found")
    } else {
      console.log("📋 Available backups:")
      backups.forEach((backup, index) => {
        console.log(`  ${index + 1}. ${backup.manifest.timestamp}`)
        console.log(`     Records: ${backup.manifest.totalRecords}`)
        console.log(`     Created: ${backup.created.toLocaleString()}`)
        console.log("")
      })
    }
    return
  }

  if (backupName) {
    restoreDatabase(backupName, options)
  } else {
    console.log("🔄 Restoring latest backup...")
    restoreDatabase(null, options)
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("restore-database-prisma.js")) {
  main()
}

export { listBackups, restoreDatabase }
