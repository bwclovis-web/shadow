#!/usr/bin/env node

/**
 * Environment validation script
 * Run this script to validate your environment configuration
 * Usage: node scripts/validate-env.js
 */

// Suppress dotenv informational messages
process.env.DOTENV_CONFIG_QUIET = "true"
import "dotenv/config"

import {
  validateCoreSecurityEnv,
  validateExtendedEnv,
} from "../app/utils/security/env.server.js"
import { generateSecureSecret } from "../app/utils/security/startup-validation.server.js"

console.log("🔍 Voodoo Perfumes Environment Validation\n")

try {
  // Validate core security variables
  console.log("Validating core security variables...")
  const coreEnv = validateCoreSecurityEnv()
  console.log("✅ Core security environment variables are valid\n")

  // Validate extended environment variables
  console.log("Validating extended environment variables...")
  const extendedEnv = validateExtendedEnv()
  if (extendedEnv) {
    console.log("✅ Extended environment variables are valid\n")
  } else {
    console.log("⚠️  Some optional environment variables may need attention\n")
  }

  // Security recommendations
  console.log("🔒 Security Recommendations:")

  if (coreEnv.JWT_SECRET.length < 64) {
    console.log("⚠️  Consider using a longer JWT_SECRET (64+ characters) for production")
  } else {
    console.log("✅ JWT_SECRET length is adequate")
  }

  if (coreEnv.SESSION_SECRET.length < 64) {
    console.log("⚠️  Consider using a longer SESSION_SECRET (64+ characters) for production")
  } else {
    console.log("✅ SESSION_SECRET length is adequate")
  }

  if (
    coreEnv.NODE_ENV === "production" &&
    coreEnv.DATABASE_URL.includes("localhost")
  ) {
    console.log("⚠️  DATABASE_URL contains localhost in production - verify this is correct")
  } else {
    console.log("✅ DATABASE_URL configuration looks good")
  }

  console.log("\n🎉 Environment validation completed successfully!")
  console.log("Your application is ready to start.")
} catch (error) {
  console.error("❌ Environment validation failed:")
  console.error(error.message)
  console.log("\n💡 To fix this:")
  console.log("1. Copy env_example.txt to .env")
  console.log("2. Fill in your actual values")
  console.log("3. Generate secure secrets if needed:")
  console.log(`   JWT_SECRET=${generateSecureSecret(64)}`)
  console.log(`   SESSION_SECRET=${generateSecureSecret(64)}`)
  console.log("4. Run this script again to validate")

  process.exit(1)
}
