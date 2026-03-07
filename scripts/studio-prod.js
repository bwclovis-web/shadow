/**
 * Open Prisma Studio against production URL from .env.
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

execSync("npx prisma studio --schema=prisma/schema.prisma", {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: REMOTE_DATABASE_URL },
})
