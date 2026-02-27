#!/usr/bin/env node

/**
 * Database Restore Script
 * Restores PostgreSQL database from backup files
 */

import { execSync } from "child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "fs"
import { basename, extname, join } from "path"
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

// List available backups
function listBackups() {
  if (!existsSync(BACKUP_DIR)) {
    console.log("❌ No backup directory found")
    return []
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
        size: stats.size,
      }
    })
    .sort((a, b) => b.created - a.created)

  return files
}

// Execute psql command
function executePsql(dbConfig, sql, options = []) {
  const env = { ...process.env, PGPASSWORD: dbConfig.password }

  const command = [
    "psql",
    `--host=${dbConfig.host}`,
    `--port=${dbConfig.port}`,
    `--username=${dbConfig.username}`,
    `--dbname=${dbConfig.database}`,
    ...options,
    "--no-password",
    "--quiet",
  ].join(" ")

  console.log(`Executing: ${command.replace(dbConfig.password, "***")}`)

  try {
    execSync(command, {
      env,
      input: sql,
      stdio: "pipe",
      cwd: projectRoot,
    })
    console.log("✅ Command executed successfully")
  } catch (error) {
    console.error(`❌ Error executing command: ${error.message}`)
    throw error
  }
}

// Execute pg_restore command
function executePgRestore(dbConfig, backupFile, options = []) {
  const env = { ...process.env, PGPASSWORD: dbConfig.password }

  const command = [
    "pg_restore",
    `--host=${dbConfig.host}`,
    `--port=${dbConfig.port}`,
    `--username=${dbConfig.username}`,
    `--dbname=${dbConfig.database}`,
    ...options,
    "--no-password",
    "--verbose",
    backupFile,
  ].join(" ")

  console.log(`Executing: ${command.replace(dbConfig.password, "***")}`)

  try {
    execSync(command, {
      env,
      stdio: "inherit",
      cwd: projectRoot,
    })
    console.log("✅ Restore completed successfully")
  } catch (error) {
    console.error(`❌ Error during restore: ${error.message}`)
    throw error
  }
}

// Restore from SQL file
function restoreFromSql(dbConfig, backupFile, options = {}) {
  console.log(`📖 Reading SQL file: ${backupFile}`)
  const sql = readFileSync(backupFile, "utf8")

  const psqlOptions = []
  if (options.clean) {
    psqlOptions.push("--single-transaction")
  }

  executePsql(dbConfig, sql, psqlOptions)
}

// Restore from custom dump file
function restoreFromDump(dbConfig, backupFile, options = {}) {
  console.log(`📦 Restoring from dump file: ${backupFile}`)

  const pgRestoreOptions = []
  if (options.clean) {
    pgRestoreOptions.push("--clean", "--if-exists")
  }
  if (options.create) {
    pgRestoreOptions.push("--create")
  }

  executePgRestore(dbConfig, backupFile, pgRestoreOptions)
}

// Main restore function
async function restoreDatabase(backupName, options = {}) {
  try {
    console.log("🔄 Starting database restore...")

    const dbConfig = parseDatabaseUrl(process.env.DATABASE_URL)
    console.log(`🗄️  Target database: ${dbConfig.database}@${dbConfig.host}:${dbConfig.port}`)

    // Find backup
    const backups = listBackups()
    let selectedBackup = null

    if (backupName) {
      selectedBackup = backups.find(b => b.file.includes(backupName))
      if (!selectedBackup) {
        console.log("❌ Backup not found. Available backups:")
        backups.forEach((backup, index) => {
          console.log(`  ${index + 1}. ${backup.manifest.timestamp} (${
              backup.manifest.database
            })`)
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
    console.log(`📊 Original database: ${selectedBackup.manifest.database}`)

    // Determine restore method based on available files
    const backupPrefix = selectedBackup.file.replace("_manifest.json", "")
    const fullBackupFile = join(BACKUP_DIR, `${backupPrefix}_full.sql`)
    const customBackupFile = join(BACKUP_DIR, `${backupPrefix}_custom.dump`)

    if (existsSync(customBackupFile)) {
      console.log("⚡ Using custom format restore (faster)...")
      restoreFromDump(dbConfig, customBackupFile, options)
    } else if (existsSync(fullBackupFile)) {
      console.log("📖 Using SQL format restore...")
      restoreFromSql(dbConfig, fullBackupFile, options)
    } else {
      console.log("❌ No suitable backup file found")
      return
    }

    console.log("\n✅ Database restore completed successfully!")
  } catch (error) {
    console.error("\n❌ Restore failed:", error.message)
    process.exit(1)
  }
}

// Interactive restore function
async function interactiveRestore() {
  const backups = listBackups()

  if (backups.length === 0) {
    console.log("❌ No backups found")
    return
  }

  console.log("📋 Available backups:")
  backups.forEach((backup, index) => {
    console.log(`  ${index + 1}. ${backup.manifest.timestamp} (${backup.manifest.database})`)
    console.log(`     Files: ${Object.keys(backup.manifest.files).join(", ")}`)
    console.log(`     Created: ${backup.created.toLocaleString()}`)
    console.log("")
  })

  // In a real implementation, you'd use a prompt library like inquirer
  // For now, we'll just use the latest backup
  console.log("🔄 Using latest backup...")
  await restoreDatabase()
}

// CLI interface
function main() {
  const args = process.argv.slice(2)
  const backupName = args[0]
  const options = {
    clean: args.includes("--clean"),
    create: args.includes("--create"),
  }

  if (args.includes("--list")) {
    const backups = listBackups()
    if (backups.length === 0) {
      console.log("❌ No backups found")
    } else {
      console.log("📋 Available backups:")
      backups.forEach((backup, index) => {
        console.log(`  ${index + 1}. ${backup.manifest.timestamp} (${
            backup.manifest.database
          })`)
        console.log(`     Files: ${Object.keys(backup.manifest.files).join(", ")}`)
        console.log(`     Created: ${backup.created.toLocaleString()}`)
        console.log("")
      })
    }
    return
  }

  if (backupName) {
    restoreDatabase(backupName, options)
  } else {
    interactiveRestore()
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith("restore-database.js")) {
  main()
}

export { listBackups, parseDatabaseUrl, restoreDatabase }
