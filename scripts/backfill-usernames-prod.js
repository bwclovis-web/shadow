/**
 * Run username backfill against production DB (REMOTE_DATABASE_URL).
 * Use this before opening Prisma Studio against production if the schema
 * has username as required but production still has null usernames.
 *
 * Usage: npm run backfill:usernames:prod
 */

const { execSync } = require("child_process")
const { config } = require("dotenv")
const { resolve } = require("path")

config({ path: resolve(process.cwd(), ".env") })

const { REMOTE_DATABASE_URL } = process.env

if (!REMOTE_DATABASE_URL) {
  console.error("ERROR: REMOTE_DATABASE_URL is not set in .env")
  process.exit(1)
}

console.log("Running username backfill against REMOTE_DATABASE_URL...")
execSync("npx tsx scripts/backfill-usernames.ts", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: REMOTE_DATABASE_URL },
})
