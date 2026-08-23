/**
 * Apply pending Prisma migrations to production (REMOTE_DATABASE_URL).
 *
 * Usage:
 *   npm run db:migrate:prod
 *   npm run db:migrate:prod:dry
 */

const { spawnSync } = require("child_process")
const { config } = require("dotenv")
const { resolve } = require("path")
const { PrismaClient } = require("@prisma/client")

config({ path: resolve(process.cwd(), ".env") })

const { REMOTE_DATABASE_URL } = process.env
const dryRun = process.argv.includes("--dry-run")

if (!REMOTE_DATABASE_URL) {
  console.error("ERROR: REMOTE_DATABASE_URL is not set in .env")
  process.exit(1)
}

const prodEnv = { ...process.env, DATABASE_URL: REMOTE_DATABASE_URL }
const maskedTarget = `${REMOTE_DATABASE_URL.substring(0, 60)}...`
const schemaArg = "--schema=prisma/schema.prisma"

const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: prodEnv,
    shell: process.platform === "win32",
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (dryRun) {
  console.log("DRY RUN: No changes will be applied.")
  console.log(`Target: ${maskedTarget}\n`)
  run("npx", ["prisma", "migrate", "status", schemaArg])
  console.log("\nPending SQL is in prisma/migrations/<name>/migration.sql")
  console.log("Apply with: npm run db:migrate:prod")
  process.exit(0)
}

console.log("Applying pending migrations to production...")
console.log(`Target: ${maskedTarget}\n`)

run("npx", ["prisma", "migrate", "deploy", schemaArg])

console.log("\nVerifying production schema...")

const verifySchema = async () => {
  const drift = spawnSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-url",
      REMOTE_DATABASE_URL,
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    { encoding: "utf8", env: prodEnv, shell: process.platform === "win32" }
  )

  if (drift.status === 2) {
    console.error("ERROR: Schema drift remains after migrate deploy.")
    if (drift.stdout) console.error(drift.stdout)
    process.exit(1)
  }
  if (drift.status !== 0 && drift.status !== null) {
    console.error("Verification failed:", drift.stderr || drift.stdout)
    process.exit(1)
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: REMOTE_DATABASE_URL } },
  })

  try {
    const checks = await prisma.$queryRawUnsafe(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'WearJournalEntry'
        ) AS "hasWearJournalEntry",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'ScraperJob'
        ) AS "hasScraperJob",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'membershipTier'
        ) AS "hasMembershipTier"
    `)

    const result = Array.isArray(checks) ? checks[0] : checks
    console.log("Verification result:", result)
    console.log("Production migrate deploy completed.")
  } finally {
    await prisma.$disconnect()
  }
}

verifySchema().catch(error => {
  console.error("Verification failed:", error.message)
  process.exit(1)
})
