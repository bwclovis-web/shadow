#!/usr/bin/env node
/**
 * Environment validation script
 * Usage: npm run validate:env
 *
 * In production (NODE_ENV=production), missing required keys exit 1.
 * In development, missing optional keys are warnings only.
 */

process.env.DOTENV_CONFIG_QUIET = "true"
import "dotenv/config"
import { randomBytes } from "crypto"

const isProd = process.env.NODE_ENV === "production"

const requiredAlways = ["DATABASE_URL", "JWT_SECRET"]
const requiredProd = [
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXT_PUBLIC_APP_URL",
]
const optionalDocumented = [
  "SESSION_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID_MEMBER",
  "STRIPE_PRICE_ID_PREMIUM",
  "STRIPE_PRICE_ID_COLLECTOR",
  "STRIPE_PRICE_ID",

  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "NEXT_PUBLIC_SANITY_PROJECT_ID",
  "NEXT_PUBLIC_SANITY_DATASET",
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "SCRAPER_INLINE_WORKER",
  "SCRAPER_PYTHON",
]

const generateSecureSecret = (length = 64) =>
  randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length)

const missing = []
const warnings = []

const required = isProd ? requiredProd : requiredAlways

for (const key of required) {
  const value = process.env[key]?.trim()
  if (!value) missing.push(key)
}

const jwt = process.env.JWT_SECRET?.trim()
if (jwt && jwt.length < 32) {
  missing.push("JWT_SECRET (must be at least 32 characters)")
} else if (jwt && jwt.length < 64 && isProd) {
  warnings.push("JWT_SECRET is under 64 characters — consider a longer secret in production")
}

if (isProd && process.env.DATABASE_URL?.includes("localhost")) {
  warnings.push("DATABASE_URL contains localhost in production — verify this is intentional")
}

if (isProd && process.env.SCRAPER_INLINE_WORKER !== "false") {
  warnings.push(
    'Set SCRAPER_INLINE_WORKER=false in production so long scrapes use `npm run scraper:worker`'
  )
}

console.log("Environment validation\n")

if (missing.length) {
  console.error("Missing required environment variables:")
  for (const key of missing) console.error(`  - ${key}`)
  console.error("\nCopy .env.example to .env and fill in values.")
  console.error(`Example JWT_SECRET=${generateSecureSecret(64)}`)
  process.exit(1)
}

console.log("Required variables present.")

for (const key of optionalDocumented) {
  if (!process.env[key]?.trim()) {
    warnings.push(`Optional not set: ${key}`)
  }
}

if (warnings.length) {
  console.log("\nWarnings:")
  for (const w of warnings) console.log(`  - ${w}`)
}

console.log("\nEnvironment validation completed.")
process.exit(0)
