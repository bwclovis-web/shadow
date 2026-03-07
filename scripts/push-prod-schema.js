/**
 * Production schema sync (no row/data migration).
 *
 * This runs ONE safe, idempotent SQL file against production:
 *   prisma/migrations/APPLY_TO_REMOTE_DB.sql
 *
 * The SQL file is additive-only (new tables/columns/indexes/constraints) and
 * designed to avoid data loss.
 *
 * Usage:
 *   npm run db:push:prod
 *   npm run db:push:prod:dry
 */

const { execSync } = require("child_process")
const { existsSync, readFileSync } = require("fs")
const { config } = require("dotenv")
const { resolve } = require("path")
const { PrismaClient } = require("@prisma/client")

config({ path: resolve(process.cwd(), ".env") })

const { REMOTE_DATABASE_URL } = process.env
const migrationFile = "prisma/migrations/APPLY_TO_REMOTE_DB.sql"
const dryRun = process.argv.includes("--dry-run")

if (!REMOTE_DATABASE_URL) {
  console.error("ERROR: REMOTE_DATABASE_URL is not set in .env")
  process.exit(1)
}

if (!existsSync(resolve(process.cwd(), migrationFile))) {
  console.error(`ERROR: Migration file not found: ${migrationFile}`)
  process.exit(1)
}

console.log("Applying safe production schema migration...")
console.log(`Target: ${REMOTE_DATABASE_URL.substring(0, 60)}...`)
console.log(`SQL file: ${migrationFile}`)
console.log("")

if (dryRun) {
  const sql = readFileSync(resolve(process.cwd(), migrationFile), "utf8")
  console.log("DRY RUN: No changes will be applied.")
  console.log("The following SQL would be executed:")
  console.log("")
  console.log(sql)
  console.log("")
  console.log("Dry run completed.")
  process.exit(0)
}

execSync(
  `npx prisma db execute --file "${migrationFile}" --url "${REMOTE_DATABASE_URL}"`,
  { stdio: "inherit" }
)

console.log("")
console.log("Running post-sync verification against production...")

async function verifySchema() {
  const prisma = new PrismaClient({
    datasources: { db: { url: REMOTE_DATABASE_URL } },
  })

  try {
    const checks = await prisma.$queryRawUnsafe(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'ScentProfile'
        ) AS "hasScentProfile",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'TraderContactMessage'
        ) AS "hasTraderContactMessage",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'User' AND column_name = 'subscriptionStatus'
        ) AS "hasUserSubscriptionStatus",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'UserPerfumeReview' AND column_name = 'isApproved'
        ) AS "hasReviewIsApproved",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'tokenVersion'
        ) AS "hasUserTokenVersion"
    `)

    const result = Array.isArray(checks) ? checks[0] : checks
    console.log("Verification result:")
    console.log(JSON.stringify(result, null, 2))
    console.log("")
    console.log("Production schema sync completed.")
  } finally {
    await prisma.$disconnect()
  }
}

verifySchema().catch(error => {
  console.error("Verification failed:", error.message)
  process.exit(1)
})
