#!/usr/bin/env node
/**
 * Verifies Sanity env vars and prints next steps.
 * Usage: node scripts/check-sanity-env.mjs
 */
import { config } from "dotenv"
import { existsSync } from "node:fs"

config({ path: ".env.local" })
config({ path: ".env" })

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim()
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET?.trim() || "production"
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2025-05-17"

console.log("Sanity — Behind the Bottle\n")

if (!existsSync(".env") && !existsSync(".env.local")) {
  console.log("⚠  No .env or .env.local found. Copy scripts/env.example → .env\n")
}

if (!projectId) {
  console.log("✗ NEXT_PUBLIC_SANITY_PROJECT_ID is missing\n")
  console.log("Next steps:")
  console.log("  1. npx sanity login")
  console.log("  2. npx sanity projects create \"Shadow and Sillage\" --dataset production")
  console.log("     (or create a project at https://sanity.io/manage)")
  console.log("  3. Add to .env:")
  console.log('     NEXT_PUBLIC_SANITY_PROJECT_ID="<your-project-id>"')
  console.log('     NEXT_PUBLIC_SANITY_DATASET="production"')
  console.log("  4. In Sanity Manage → API → CORS, allow:")
  console.log("     http://localhost:3000")
  console.log("     https://your-production-domain")
  console.log("  5. npm run sanity:dev   (or open http://localhost:3000/studio)")
  process.exit(1)
}

console.log("✓ NEXT_PUBLIC_SANITY_PROJECT_ID:", projectId)
console.log("✓ NEXT_PUBLIC_SANITY_DATASET:", dataset)
console.log("✓ NEXT_PUBLIC_SANITY_API_VERSION:", apiVersion)

if (process.env.SANITY_REVALIDATE_SECRET) {
  console.log("✓ SANITY_REVALIDATE_SECRET is set (webhook revalidation)")
} else {
  console.log("○ SANITY_REVALIDATE_SECRET optional — for publish webhooks")
}

console.log("\nStudio: npm run sanity:dev  or  http://localhost:3000/studio")
console.log("Blog:   http://localhost:3000/behind-the-bottle")
