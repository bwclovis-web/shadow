#!/usr/bin/env node

/**
 * Script to push local database to remote database (Command Line Version)
 * This script will:
 * 1. Create a backup of your current local database
 * 2. Update Prisma schema to use remote database URL
 * 3. Push the schema to the remote database
 * 4. Optionally restore local database configuration
 *
 * Usage: node push_local_to_remote_db_cli.js <remote_LOCAL_DATABASE_URL> [--keep-remote]
 * Example: node push_local_to_remote_db_cli.js "postgresql://user:pass@host:5432/db" --keep-remote
 */

import { execSync } from "child_process"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const BACKUP_DIR = join(__dirname, "../backups")
const SCHEMA_BACKUP_PATH = join(__dirname, "../backups/schema_backup.prisma")
const ENV_BACKUP_PATH = join(__dirname, "../backups/.env.backup")

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
}

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logStep(step, message) {
  log(`\n${step}: ${message}`, "cyan")
}

function logSuccess(message) {
  log(`✅ ${message}`, "green")
}

function logError(message) {
  log(`❌ ${message}`, "red")
}

function logWarning(message) {
  log(`⚠️  ${message}`, "yellow")
}

function logInfo(message) {
  log(`ℹ️  ${message}`, "blue")
}

function showUsage() {
  log("\n📖 Usage:", "bright")
  log(
    "node push_local_to_remote_db_cli.js <remote_LOCAL_DATABASE_URL> [--keep-remote]",
    "cyan"
  )
  log("\n📝 Examples:", "bright")
  log(
    'node push_local_to_remote_db_cli.js "postgresql://user:pass@host:5432/db"',
    "yellow"
  )
  log(
    'node push_local_to_remote_db_cli.js "postgresql://user:pass@host:5432/db" --keep-remote',
    "yellow"
  )
  log("\n🔧 Options:", "bright")
  log(
    "--keep-remote    Keep the remote database configuration after pushing",
    "yellow"
  )
  log("                  (default: restore local configuration)", "yellow")
  log("\n💡 Note:", "bright")
  log("The remote database URL should be in the format:", "cyan")
  log("postgresql://username:password@host:port/database", "yellow")
}

function runCommand(command, description) {
  try {
    log(`Running: ${command}`, "blue")
    const result = execSync(command, {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
      encoding: "utf8",
    })
    logSuccess(description)
    return result
  } catch (error) {
    logError(`Failed to ${description}: ${error.message}`)
    throw error
  }
}

function createBackupDirectory() {
  if (!existsSync(BACKUP_DIR)) {
    execSync(`mkdir -p "${BACKUP_DIR}"`, { stdio: "inherit" })
    logSuccess("Created backup directory")
  }
}

function backupCurrentSchema() {
  logStep("Step 1", "Creating backup of current Prisma schema")

  try {
    const schemaPath = join(__dirname, "../prisma/schema.prisma")
    const schemaContent = readFileSync(schemaPath, "utf8")

    // Create backup
    writeFileSync(SCHEMA_BACKUP_PATH, schemaContent)
    logSuccess("Schema backup created")

    return schemaContent
  } catch (error) {
    logError(`Failed to backup schema: ${error.message}`)
    throw error
  }
}

function backupEnvironmentFile() {
  logStep("Step 2", "Creating backup of environment file")

  try {
    const envPath = join(__dirname, "../.env")
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf8")
      writeFileSync(ENV_BACKUP_PATH, envContent)
      logSuccess("Environment file backup created")
      return envContent
    } else {
      logWarning("No .env file found, skipping backup")
      return null
    }
  } catch (error) {
    logError(`Failed to backup environment file: ${error.message}`)
    throw error
  }
}

function updateSchemaForRemoteDatabase(remoteDatabaseUrl) {
  logStep("Step 3", "Updating Prisma schema for remote database")

  try {
    const schemaPath = join(__dirname, "../prisma/schema.prisma")
    let schemaContent = readFileSync(schemaPath, "utf8")

    // Replace the datasource URL with remote database URL
    schemaContent = schemaContent.replace(
      /url\s*=\s*env\("LH_LOCAL_DATABASE_URL"\)/,
      `url = "${remoteDatabaseUrl}"`
    )

    writeFileSync(schemaPath, schemaContent)
    logSuccess("Schema updated for remote database")

    return schemaContent
  } catch (error) {
    logError(`Failed to update schema: ${error.message}`)
    throw error
  }
}

function pushSchemaToRemoteDatabase() {
  logStep("Step 4", "Pushing schema to remote database")

  try {
    // Generate Prisma client with new schema
    runCommand("npx prisma generate", "Generated Prisma client")

    // Push the schema to remote database
    runCommand("npx prisma db push", "Pushed schema to remote database")

    logSuccess("Schema successfully pushed to remote database")
  } catch (error) {
    logError(`Failed to push schema: ${error.message}`)
    throw error
  }
}

function restoreLocalConfiguration() {
  logStep("Step 5", "Restoring local database configuration")

  try {
    // Restore original schema
    const schemaPath = join(__dirname, "../prisma/schema.prisma")
    const originalSchema = readFileSync(SCHEMA_BACKUP_PATH, "utf8")
    writeFileSync(schemaPath, originalSchema)

    // Restore original environment file if it existed
    if (existsSync(ENV_BACKUP_PATH)) {
      const originalEnv = readFileSync(ENV_BACKUP_PATH, "utf8")
      const envPath = join(__dirname, "../.env")
      writeFileSync(envPath, originalEnv)
    }

    // Regenerate Prisma client for local database
    runCommand("npx prisma generate", "Regenerated Prisma client for local database")

    logSuccess("Local configuration restored")
  } catch (error) {
    logError(`Failed to restore local configuration: ${error.message}`)
    throw error
  }
}

function createRemoteDatabaseEnvFile(remoteDatabaseUrl) {
  logStep("Step 6", "Creating environment file for remote database")

  try {
    const remoteEnvContent = `# Remote Database Configuration
LH_LOCAL_DATABASE_URL="${remoteDatabaseUrl}"

# Keep your existing environment variables below
# JWT_SECRET=your_jwt_secret_here
# SESSION_SECRET=your_session_secret_here
`

    const remoteEnvPath = join(__dirname, "../.env.remote")
    writeFileSync(remoteEnvPath, remoteEnvContent)

    logSuccess("Remote database environment file created (.env.remote)")
    logWarning("To use remote database, copy .env.remote to .env")
  } catch (error) {
    logError(`Failed to create remote database environment file: ${error.message}`)
    throw error
  }
}

function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2)

    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      showUsage()
      return
    }

    const remoteDatabaseUrl = args[0]
    const shouldKeepRemote = args.includes("--keep-remote")

    if (!remoteDatabaseUrl || remoteDatabaseUrl.trim() === "") {
      logError("Remote database URL is required")
      showUsage()
      process.exit(1)
    }

    log("🚀 Starting database push to remote database", "bright")
    logInfo(`Using remote database URL: ${remoteDatabaseUrl}`)
    logInfo(`Keep remote configuration: ${shouldKeepRemote ? "Yes" : "No"}`)

    createBackupDirectory()
    backupCurrentSchema()
    backupEnvironmentFile()
    updateSchemaForRemoteDatabase(remoteDatabaseUrl)
    pushSchemaToRemoteDatabase()

    if (shouldKeepRemote) {
      createRemoteDatabaseEnvFile(remoteDatabaseUrl)
      log("\n🎉 Database push completed successfully!", "bright")
      log("\n📋 Next steps:", "cyan")
      log("1. Your schema has been pushed to the remote database", "yellow")
      log("2. To use remote database: cp .env.remote .env", "yellow")
      log("3. To switch back to local: restore from backups", "yellow")
    } else {
      restoreLocalConfiguration()
      log("\n🎉 Database push completed successfully!", "bright")
      log("\n📋 Configuration restored to local database", "cyan")
      log("Your local database configuration remains unchanged.", "yellow")
    }
  } catch (error) {
    log("\n💥 Database push failed!", "red")
    log("Check the error messages above and try again.", "red")
    log("Your local database and configuration remain unchanged.", "yellow")

    // Try to restore local configuration on failure
    try {
      log("\n🔄 Attempting to restore local configuration...", "yellow")
      restoreLocalConfiguration()
      logSuccess("Local configuration restored after failure")
    } catch (restoreError) {
      logError(`Failed to restore local configuration: ${restoreError.message}`)
      logWarning("Please manually restore from backup files")
    }

    process.exit(1)
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main }
