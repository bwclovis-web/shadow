/**
 * Prints comparable DB target fingerprints for local and production URLs.
 *
 * Usage:
 *   npm run db:fingerprint
 */

const crypto = require("crypto")
const { config } = require("dotenv")
const { resolve } = require("path")
const { PrismaClient } = require("@prisma/client")

config({ path: resolve(process.cwd(), ".env") })

function hashUrl(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 12)
}

function safeHost(url) {
  try {
    return new URL(url).host
  } catch {
    return "invalid-url"
  }
}

async function fingerprint(label, url) {
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  })

  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT
        current_database() AS "database",
        current_schema() AS "schema",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='ScentProfile'
        ) AS "hasScentProfile",
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema='public' AND table_name='TraderContactMessage'
        ) AS "hasTraderContactMessage",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='User' AND column_name='subscriptionStatus'
        ) AS "hasUserSubscriptionStatus",
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='UserPerfumeReview' AND column_name='isApproved'
        ) AS "hasReviewIsApproved",
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public')::int AS "publicTableCount"
    `)

    const row = Array.isArray(result) ? result[0] : result
    return {
      label,
      host: safeHost(url),
      urlHash: hashUrl(url),
      ...row,
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const targets = []
  if (process.env.LOCAL_DATABASE_URL) {
    targets.push({ label: "local", url: process.env.LOCAL_DATABASE_URL })
  }
  if (process.env.REMOTE_DATABASE_URL) {
    targets.push({ label: "prod", url: process.env.REMOTE_DATABASE_URL })
  }

  if (!targets.length) {
    console.error("ERROR: No LOCAL_DATABASE_URL or REMOTE_DATABASE_URL found in .env")
    process.exit(1)
  }

  for (const target of targets) {
    try {
      const fp = await fingerprint(target.label, target.url)
      console.log(JSON.stringify(fp, null, 2))
      console.log("")
    } catch (error) {
      console.error(
        JSON.stringify(
          {
            label: target.label,
            host: safeHost(target.url),
            urlHash: hashUrl(target.url),
            error: error.message,
          },
          null,
          2
        )
      )
      console.log("")
    }
  }
}

main().catch(error => {
  console.error("Fingerprint command failed:", error.message)
  process.exit(1)
})
