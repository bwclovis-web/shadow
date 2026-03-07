/**
 * Push local Prisma schema to production (schema/DDL only — no data).
 *
 * Reads REMOTE_DATABASE_URL from .env and runs:
 *   prisma db push --schema=prisma/schema.prisma
 *
 * Only additive changes (CREATE TABLE, ADD COLUMN) are applied automatically.
 * Any destructive change (DROP COLUMN, type change) causes Prisma to abort and
 * ask for explicit confirmation — do NOT pass --accept-data-loss on production.
 *
 * Usage:
 *   npm run db:push:prod
 */

import { execSync } from "child_process"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env") })

const { REMOTE_DATABASE_URL } = process.env

if (!REMOTE_DATABASE_URL) {
  console.error("❌ ERROR: REMOTE_DATABASE_URL is not set in .env")
  console.error("   Set it to your Prisma Postgres connection string:")
  console.error("   REMOTE_DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=...")
  process.exit(1)
}

console.log("🚀 Pushing schema to production (additive changes only)...")
console.log(`   Target: ${REMOTE_DATABASE_URL.substring(0, 60)}...`)
console.log("")

execSync("npx prisma db push --schema=prisma/schema.prisma", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: REMOTE_DATABASE_URL },
})
