#!/usr/bin/env node

/**
 * Database Backup Script using Prisma
 * Creates backups using Prisma's introspection and data export capabilities
 * This works without requiring PostgreSQL client tools to be installed
 */

import { PrismaClient } from "@prisma/client"
import { existsSync, mkdirSync, writeFileSync } from "fs"
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
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
const BACKUP_PREFIX = `backup_${TIMESTAMP}`

// Ensure backup directory exists
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true })
}

// Initialize Prisma client
const prisma = new PrismaClient()

// Export data from a table
async function exportTableData(tableName, model) {
  try {
    console.log(`📊 Exporting ${tableName}...`)
    const data = await model.findMany()
    return {
      table: tableName,
      count: data.length,
      data: data,
    }
  } catch (error) {
    console.error(`❌ Error exporting ${tableName}:`, error.message)
    return {
      table: tableName,
      count: 0,
      data: [],
      error: error.message,
    }
  }
}

// Create SQL insert statements
function generateInsertStatements(tableData) {
  if (!tableData.data || tableData.data.length === 0) {
    return `-- No data in ${tableData.table}\n`
  }

  const tableName = tableData.table
  const records = tableData.data

  let sql = `-- Data for table: ${tableName}\n`
  sql += `-- Count: ${records.length} records\n\n`

  // Get column names from first record
  const columns = Object.keys(records[0])
  const columnList = columns.join(", ")

  // Generate INSERT statements
  for (const record of records) {
    const values = columns
      .map(col => {
        const value = record[col]
        if (value === null) {
          return "NULL"
        }
        if (typeof value === "string") {
          return `'${value.replace(/'/g, "''")}'`
        }
        if (typeof value === "boolean") {
          return value
        }
        if (typeof value === "number") {
          return value
        }
        if (value instanceof Date) {
          return `'${value.toISOString()}'`
        }
        if (typeof value === "object") {
          return `'${JSON.stringify(value).replace(/'/g, "''")}'`
        }
        return `'${String(value).replace(/'/g, "''")}'`
      })
      .join(", ")

    sql += `INSERT INTO "${tableName}" (${columnList}) VALUES (${values});\n`
  }

  sql += "\n"
  return sql
}

// Main backup function
async function createBackup() {
  try {
    console.log("🚀 Starting database backup using Prisma...")
    console.log(`📅 Timestamp: ${TIMESTAMP}`)
    console.log(`📁 Backup directory: ${BACKUP_DIR}`)

    // Test database connection
    await prisma.$connect()
    console.log("✅ Database connection successful")

    // Export all tables
    const tables = [
      { name: "User", model: prisma.user },
      { name: "PerfumeHouse", model: prisma.perfumeHouse },
      { name: "Perfume", model: prisma.perfume },
      { name: "UserPerfume", model: prisma.userPerfume },
      { name: "UserPerfumeRating", model: prisma.userPerfumeRating },
      { name: "UserPerfumeReview", model: prisma.userPerfumeReview },
      { name: "UserPerfumeWishlist", model: prisma.userPerfumeWishlist },
      { name: "UserPerfumeComment", model: prisma.userPerfumeComment },
      { name: "PerfumeNotes", model: prisma.perfumeNotes },
      { name: "WishlistNotification", model: prisma.wishlistNotification },
      { name: "SecurityAuditLog", model: prisma.securityAuditLog },
    ]

    console.log("\n📊 Exporting table data...")
    const tableData = []
    let totalRecords = 0

    for (const table of tables) {
      const data = await exportTableData(table.name, table.model)
      tableData.push(data)
      totalRecords += data.count
      console.log(`  ${table.name}: ${data.count} records`)
    }

    // Check if database is empty
    if (totalRecords === 0) {
      console.error("\n❌ ERROR: Database is empty (0 records found).")
      console.error("   Cannot create backup of an empty database.")
      console.error("   Please ensure your database contains data before running backup.")
      await prisma.$disconnect()
      process.exit(1)
    }

    console.log(`\n✅ Database contains ${totalRecords} total records - proceeding with backup...`)

    // Generate SQL backup
    console.log("\n📝 Generating SQL backup...")
    let sqlBackup = `-- Database Backup Generated: ${new Date().toISOString()}\n`
    sqlBackup += `-- Total Records: ${totalRecords}\n\n`
    sqlBackup += `-- Disable foreign key checks\n`
    sqlBackup += `SET session_replication_role = replica;\n\n`

    for (const table of tableData) {
      sqlBackup += generateInsertStatements(table)
    }

    sqlBackup += `-- Re-enable foreign key checks\n`
    sqlBackup += `SET session_replication_role = DEFAULT;\n`

    // Save SQL backup
    const sqlBackupFile = join(BACKUP_DIR, `${BACKUP_PREFIX}_data.sql`)
    writeFileSync(sqlBackupFile, sqlBackup)
    console.log(`✅ SQL backup created: ${sqlBackupFile}`)

    // Generate JSON backup
    console.log("\n📄 Generating JSON backup...")
    const jsonBackup = {
      timestamp: TIMESTAMP,
      totalRecords,
      tables: tableData.map(t => ({
        table: t.table,
        count: t.count,
        data: t.data,
      })),
    }

    const jsonBackupFile = join(BACKUP_DIR, `${BACKUP_PREFIX}_data.json`)
    writeFileSync(jsonBackupFile, JSON.stringify(jsonBackup, null, 2))
    console.log(`✅ JSON backup created: ${jsonBackupFile}`)

    // Create manifest
    const manifest = {
      timestamp: TIMESTAMP,
      method: "prisma",
      totalRecords,
      files: {
        sql: `${BACKUP_PREFIX}_data.sql`,
        json: `${BACKUP_PREFIX}_data.json`,
      },
      tables: tableData.map(t => ({
        name: t.table,
        count: t.count,
        hasError: !!t.error,
      })),
      sizes: {},
    }

    // Calculate file sizes
    const fs = await import("fs")
    for (const [type, filename] of Object.entries(manifest.files)) {
      const filePath = join(BACKUP_DIR, filename)
      if (existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        manifest.sizes[type] = {
          bytes: stats.size,
          human: formatBytes(stats.size),
        }
      }
    }

    const manifestFile = join(BACKUP_DIR, `${BACKUP_PREFIX}_manifest.json`)
    writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
    console.log(`📋 Manifest created: ${manifestFile}`)

    console.log("\n✅ Database backup completed successfully!")
    console.log(`📁 All backups saved to: ${BACKUP_DIR}`)
    console.log("\n📊 Backup Summary:")
    console.log(`  Total records: ${totalRecords}`)
    for (const [type, size] of Object.entries(manifest.sizes)) {
      console.log(`  ${type}: ${size.human}`)
    }
  } catch (error) {
    console.error("\n❌ Backup failed:", error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Helper function to format bytes
function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 Bytes"
  }
  const k = 1024
  const sizes = [
"Bytes", "KB", "MB", "GB"
]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// Run backup if called directly
if (process.argv[1] && process.argv[1].endsWith("backup-database-prisma.js")) {
  createBackup().catch(console.error)
}

export { createBackup, formatBytes }
