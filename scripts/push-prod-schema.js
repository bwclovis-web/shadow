/**
 * Production schema sync via `prisma db push` (no migrate, no hand-written SQL).
 *
 * Usage:
 *   npm run db:push:prod
 *   npm run db:push:prod:dry
 */

const { execSync } = require("child_process")
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

const maskedTarget = `${REMOTE_DATABASE_URL.substring(0, 60)}...`
const pushCommand = "npx prisma db push --schema=prisma/schema.prisma"

if (dryRun) {
  console.log("DRY RUN: No changes will be applied.")
  console.log(`Would run: ${pushCommand}`)
  console.log(`Target: ${maskedTarget}`)
  process.exit(0)
}

console.log("Pushing schema to production via prisma db push...")
console.log(`Target: ${maskedTarget}`)
console.log("")

execSync(pushCommand, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: REMOTE_DATABASE_URL },
})

console.log("")
console.log("Verifying production schema...")

const verifySchema = async () => {
  const prisma = new PrismaClient({
    datasources: { db: { url: REMOTE_DATABASE_URL } },
  })

  try {
    const checks = await prisma.$queryRawUnsafe(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'DecantSplit'
        ) AS "hasDecantSplit",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'DecantSplitSlot'
        ) AS "hasDecantSplitSlot",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'DecantSplitEvent'
        ) AS "hasDecantSplitEvent"
    `)

    const result = Array.isArray(checks) ? checks[0] : checks
    const required = ["hasDecantSplit", "hasDecantSplitSlot", "hasDecantSplitEvent"]
    const missing = required.filter(key => !result[key])

    if (missing.length > 0) {
      console.error(
        "ERROR: Production is still missing schema after db push:",
        missing.join(", ")
      )
      process.exit(1)
    }

    console.log("Production schema push completed.")
  } finally {
    await prisma.$disconnect()
  }
}

verifySchema().catch(error => {
  console.error("Verification failed:", error.message)
  process.exit(1)
})
