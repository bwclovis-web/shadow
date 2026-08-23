#!/usr/bin/env node

/**
 * Apply Prisma migrations to a remote database URL (CLI argument).
 *
 * Usage: node scripts/migrate-remote-db-cli.js <remote_database_url>
 * Example: node scripts/migrate-remote-db-cli.js "postgresql://user:pass@host:5432/db"
 */

import { spawnSync } from "child_process"
import dotenv from "dotenv"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")
dotenv.config({ path: join(projectRoot, ".env") })

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
}

const log = (message, color = "reset") =>
  console.log(`${colors[color]}${message}${colors.reset}`)

const showUsage = () => {
  log("\nUsage:", "bright")
  log('  node scripts/migrate-remote-db-cli.js "<remote_database_url>"', "cyan")
  log("\nExample:", "bright")
  log(
    '  node scripts/migrate-remote-db-cli.js "postgresql://user:pass@host:5432/db"',
    "yellow"
  )
  log("\nApplies pending migrations from prisma/migrations/ via prisma migrate deploy.", "cyan")
}

const runPrisma = (args, remoteDatabaseUrl) => {
  const result = spawnSync("npx", ["prisma", ...args], {
    stdio: "inherit",
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: remoteDatabaseUrl },
    shell: process.platform === "win32",
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const main = () => {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage()
    return
  }

  const remoteDatabaseUrl = args[0]?.trim()
  if (!remoteDatabaseUrl) {
    log("Remote database URL is required.", "red")
    showUsage()
    process.exit(1)
  }

  log("Applying migrations to remote database", "bright")
  log(`Target: ${remoteDatabaseUrl.replace(/:([^:@/]+)@/, ":***@")}`, "cyan")

  runPrisma(["migrate", "status", "--schema=prisma/schema.prisma"], remoteDatabaseUrl)
  runPrisma(["migrate", "deploy", "--schema=prisma/schema.prisma"], remoteDatabaseUrl)
  runPrisma(["migrate", "status", "--schema=prisma/schema.prisma"], remoteDatabaseUrl)

  log("\nRemote migrate deploy completed.", "green")
}

main()
