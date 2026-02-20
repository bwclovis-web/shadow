import crypto from "crypto"
import jwt from "jsonwebtoken"

import { getSessionConfig } from "@/utils/security/session-config.server"

// Validate JWT secret
function validateJwtSecret() {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required")
  }
  if (jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long")
  }
  return jwtSecret
}

const JWT_SECRET = validateJwtSecret()
const config = getSessionConfig()

// Create access token
export function createAccessToken(userId: string): string {
  return jwt.sign(
    {
      userId,
      type: "access",
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: config.accessTokenExpiresIn }
  )
}

// Create refresh token
export function createRefreshToken(userId: string): string {
  return jwt.sign(
    {
      userId,
      type: "refresh",
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: config.refreshTokenExpiresIn }
  )
}

// Verify access token
export function verifyAccessToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    if (payload.type !== "access") {
      return null
    }
    return { userId: payload.userId }
  } catch {
    return null
  }
}

// Verify refresh token
export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    if (payload.type !== "refresh") {
      return null
    }
    return { userId: payload.userId }
  } catch {
    return null
  }
}

// Create new session (simplified - no database storage)
export async function createSession({
  userId,
  userAgent,
  ipAddress,
}: {
  userId: string
  userAgent?: string
  ipAddress?: string
}) {
  // Generate tokens (JWT refresh token for stateless verify in refreshAccessToken)
  const refreshToken = createRefreshToken(userId)
  const accessToken = createAccessToken(userId)

  // Calculate expiration date
  const expiresAt = new Date()
  expiresAt.setTime(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

  // Return session data (no database storage)
  return {
    accessToken,
    refreshToken,
    sessionId: crypto.randomUUID(), // Generate a unique session ID
    expiresAt,
  }
}

// Refresh access token using refresh token (simplified - no database lookup)
export async function refreshAccessToken(refreshToken: string) {
  // Verify refresh token
  const payload = verifyRefreshToken(refreshToken)
  if (!payload) {
    throw new Error("Invalid refresh token")
  }

  // Generate new access token
  const accessToken = createAccessToken(payload.userId)

  return {
    accessToken,
    userId: payload.userId,
    sessionId: crypto.randomUUID(), // Generate new session ID
  }
}

// Invalidate session (simplified - no database operation needed)
export async function invalidateSession(sessionId: string) {
  // In a cookie-based system, invalidation happens by clearing cookies
  // No database operation needed
}

// Invalidate all user sessions (simplified - no database operation needed)
export async function invalidateAllUserSessions(userId: string) {
  // In a cookie-based system, invalidation happens by clearing cookies
  // No database operation needed
}

// Get active session (simplified - no database lookup)
export async function getActiveSession(sessionId: string) {
  // In a cookie-based system, we don't store sessions in the database
  // Return null to indicate no database session
  return null
}

// Clean up expired sessions (simplified - no database cleanup needed)
export async function cleanupExpiredSessions() {
  // In a cookie-based system, expired sessions are automatically invalid
  // No database cleanup needed
  return 0
}

// Get user's active sessions (simplified - no database lookup)
export async function getUserActiveSessions(userId: string) {
  // In a cookie-based system, we don't track sessions in the database
  // Return empty array
  return []
}
