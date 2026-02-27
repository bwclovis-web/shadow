#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Post-install script for Prisma Client generation
 * Uses production schema on Vercel/production environments to avoid dev dependencies
 */

const { execSync } = require('child_process')
const path = require('path')

// Determine which schema to use based on environment
const isProduction = process.env.NODE_ENV === 'production'
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
const isCI = process.env.CI === 'true'

const schema = (isProduction || isVercel || isCI)
  ? 'prisma/schema.prod.prisma'
  : 'prisma/schema.prisma'

console.log(`[postinstall] Using schema: ${schema}`)
console.log(`[postinstall] Environment: ${isVercel ? 'Vercel' : isProduction ? 'Production' : 'Development'}`)

try {
  execSync(`npx prisma generate --no-engine --schema=${schema}`, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  })
  console.log('[postinstall] Prisma Client generated successfully')
} catch (error) {
  console.error('[postinstall] Failed to generate Prisma Client:', error.message)
  process.exit(1)
}

