#!/usr/bin/env node

/**
 * Database Backup Script
 * Creates comprehensive backups of the PostgreSQL database including schema and data
 */

import { PrismaClient } from "@prisma/client"
import { execSync, spawnSync } from "child_process"
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs"
import { join, resolve } from "path"
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

// Initialize Prisma client for database checks
const prisma = new PrismaClient()

// Parse database URL
function parseDatabaseUrl(url) {
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required")
  }

  const urlObj = new URL(url)
  return {
    host: urlObj.hostname,
    port: urlObj.port || "5432",
    database: urlObj.pathname.slice(1),
    username: urlObj.username,
    password: urlObj.password,
  }
}

// Create backup filename
function createBackupFilename(type, extension = "sql") {
  return join(BACKUP_DIR, `${BACKUP_PREFIX}_${type}.${extension}`)
}

let cachedPgDumpPath = null

function resolvePgDumpExecutable() {
  if (cachedPgDumpPath) {
    return cachedPgDumpPath
  }

  const customPath = process.env.PG_DUMP_PATH?.trim()
  if (customPath) {
    const resolvedCustomPath = existsSync(customPath)
      ? customPath
      : resolve(projectRoot, customPath)
    if (existsSync(resolvedCustomPath)) {
      cachedPgDumpPath = resolvedCustomPath
      return cachedPgDumpPath
    }
    console.warn(`⚠️  PG_DUMP_PATH is set but the executable was not found at: ${resolvedCustomPath}`)
  }

  try {
    execSync("pg_dump --version", { stdio: "ignore" })
    cachedPgDumpPath = "pg_dump"
    return cachedPgDumpPath
  } catch (_error) {
    // continue to search common installation paths
  }

  if (process.platform === "win32") {
    const exeName = "pg_dump.exe"
    const candidateRoots = [
      process.env.PGROOT,
      process.env.PROGRAMFILES ? join(process.env.PROGRAMFILES, "PostgreSQL") : null,
      process.env["PROGRAMFILES(X86)"]
        ? join(process.env["PROGRAMFILES(X86)"], "PostgreSQL")
        : null,
      "C:\\Program Files\\PostgreSQL",
      "C:\\Program Files (x86)\\PostgreSQL",
    ].filter(Boolean)

    for (const root of candidateRoots) {
      if (!existsSync(root)) {
        continue
      }

      const directCandidate = join(root, "bin", exeName)
      if (existsSync(directCandidate)) {
        cachedPgDumpPath = directCandidate
        return cachedPgDumpPath
      }

      try {
        const entries = readdirSync(root, { withFileTypes: true })
        for (const entry of entries) {
          if (!entry.isDirectory()) {
            continue
          }
          const candidate = join(root, entry.name, "bin", exeName)
          if (existsSync(candidate)) {
            cachedPgDumpPath = candidate
            return cachedPgDumpPath
          }
        }
      } catch (_readError) {
        // Ignore read errors from restricted directories
      }
    }
  }

  throw new Error("pg_dump executable not found. Install PostgreSQL client tools or set PG_DUMP_PATH to the pg_dump binary.")
}

// Execute pg_dump command
function executePgDump(dbConfig, options, outputFile) {
  // Prefer explicit PGPASSWORD (handles special chars like @ in URL that break parsing)
  const password = process.env.PGPASSWORD ?? dbConfig.password
  const env = { ...process.env, PGPASSWORD: password }

  const pgDumpExecutable = resolvePgDumpExecutable()
  const args = [
    `--host=${dbConfig.host}`,
    `--port=${dbConfig.port}`,
    `--username=${dbConfig.username}`,
    `--dbname=${dbConfig.database}`,
    ...options,
    `--file=${outputFile}`,
    "--no-password",
    "--verbose",
  ]

  const logCommand = [pgDumpExecutable, ...args].join(" ").replace(password, "***")
  console.log(`Executing: ${logCommand}`)

  const result = spawnSync(pgDumpExecutable, args, {
    env,
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.error) {
    console.error(`❌ Error creating backup: ${result.error.message}`)
    throw result.error
  }

  if (result.status !== 0) {
    const stderrOutput = result.stderr?.toString().trim()
    if (stderrOutput) {
      console.error(stderrOutput)
    }
    throw new Error(`pg_dump exited with code ${result.status}${
        stderrOutput ? `: ${stderrOutput.split("\n").pop()}` : ""
      }`)
  }

  if (result.stderr?.length) {
    console.log(result.stderr.toString())
  }

  console.log(`✅ Backup created: ${outputFile}`)
}

// Main backup function
async function createBackup() {
  try {
    console.log("🚀 Starting database backup...")
    console.log(`📅 Timestamp: ${TIMESTAMP}`)
    console.log(`📁 Backup directory: ${BACKUP_DIR}`)

    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL)
    console.log(`🗄️  Database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`)

    // Check if database is empty before creating backups
    console.log("\n🔍 Checking if database contains data...")
    try {
      await prisma.$connect()
      
      // Check record counts from all main tables
      const tables = [
        { name: "User", model: prisma.user },
        { name: "PerfumeHouse", model: prisma.perfumeHouse },
        { name: "Perfume", model: prisma.perfume },
        { name: "UserPerfume", model: prisma.userPerfume },
        { name: "PerfumeNotes", model: prisma.perfumeNotes },
      ]
      
      let totalRecords = 0
      for (const table of tables) {
        const count = await table.model.count()
        totalRecords += count
        if (count > 0) {
          console.log(`  ${table.name}: ${count} records`)
        }
      }
      
      if (totalRecords === 0) {
        console.error("\n❌ ERROR: Database is empty (0 records found).")
        console.error("   Cannot create backup of an empty database.")
        console.error("   Please ensure your database contains data before running backup.")
        await prisma.$disconnect()
        process.exit(1)
      }
      
      console.log(`✅ Database contains ${totalRecords} total records - proceeding with backup...`)
      await prisma.$disconnect()
    } catch (error) {
      console.warn(`⚠️  Could not verify database contents: ${error.message}`)
      console.warn("   Proceeding with backup anyway (may fail if database is empty)...")
      try {
        await prisma.$disconnect()
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    // 1. Full backup (schema + data)
    console.log("\n📦 Creating full backup (schema + data)...")
    const fullBackupFile = createBackupFilename("full")
    executePgDump(
      dbConfig,
      [
        "--format=plain",
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "--create",
      ],
      fullBackupFile
    )

    // 2. Schema-only backup
    console.log("\n🏗️  Creating schema-only backup...")
    const schemaBackupFile = createBackupFilename("schema")
    executePgDump(
      dbConfig,
      [
        "--format=plain",
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "--create",
      ],
      schemaBackupFile
    )

    // 3. Data-only backup
    console.log("\n📊 Creating data-only backup...")
    const dataBackupFile = createBackupFilename("data")
    executePgDump(
      dbConfig,
      [
"--format=plain", "--data-only", "--no-owner", "--no-privileges"
],
      dataBackupFile
    )

    // 4. Custom format backup (for faster restore)
    console.log("\n⚡ Creating custom format backup...")
    const customBackupFile = createBackupFilename("custom", "dump")
    executePgDump(
      dbConfig,
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--clean",
        "--if-exists",
        "--create",
      ],
      customBackupFile
    )

    // 5. Create backup manifest
    const manifest = {
      timestamp: TIMESTAMP,
      database: dbConfig.database,
      host: dbConfig.host,
      port: dbConfig.port,
      files: {
        full: `${BACKUP_PREFIX}_full.sql`,
        schema: `${BACKUP_PREFIX}_schema.sql`,
        data: `${BACKUP_PREFIX}_data.sql`,
        custom: `${BACKUP_PREFIX}_custom.dump`,
      },
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
    for (const [type, size] of Object.entries(manifest.sizes)) {
      console.log(`  ${type}: ${size.human}`)
    }
  } catch (error) {
    console.error("\n❌ Backup failed:", error.message)
    process.exit(1)
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
if (process.argv[1] && process.argv[1].endsWith("backup-database.js")) {
  createBackup().catch(console.error)
}

export { createBackup, formatBytes, parseDatabaseUrl }
