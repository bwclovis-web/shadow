import crypto from "crypto"
import jwt from "jsonwebtoken"

import { prisma } from "@/lib/db"
import { getUserTokenVersion } from "@/models/user.query"
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

// Create access token (tokenVersion used for invalidation; callers pass 0 until session flow wires getUserTokenVersion)
export function createAccessToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    {
      userId,
      type: "access",
      tokenVersion,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: config.accessTokenExpiresIn } as jwt.SignOptions
  )
}

// Create refresh token (tokenVersion used for invalidation; callers pass 0 until session flow wires getUserTokenVersion)
export function createRefreshToken(userId: string, tokenVersion: number): string {
  return jwt.sign(
    {
      userId,
      type: "refresh",
      tokenVersion,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { expiresIn: config.refreshTokenExpiresIn } as jwt.SignOptions
  )
}

// Verify access token (async: checks payload.tokenVersion against current user.tokenVersion)
export async function verifyAccessToken(token: string): Promise<{ userId: string } | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId?: string
      type?: string
      tokenVersion?: number
    }
    if (payload.type !== "access" || !payload.userId) {
      return null
    }
    const payloadVersion =
      typeof payload.tokenVersion === "number" ? payload.tokenVersion : undefined
    if (payloadVersion === undefined) {
      return null
    }
    const currentVersion = await getUserTokenVersion(payload.userId)
    if (currentVersion === null) {
      return null
    }
    if (payloadVersion < currentVersion) {
      return null
    }
    return { userId: payload.userId }
  } catch {
    return null
  }
}

// Verify refresh token (async: checks payload.tokenVersion against current user.tokenVersion)
export async function verifyRefreshToken(token: string): Promise<{ userId: string } | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      userId?: string
      type?: string
      tokenVersion?: number
    }
    if (payload.type !== "refresh" || !payload.userId) {
      return null
    }
    const payloadVersion =
      typeof payload.tokenVersion === "number" ? payload.tokenVersion : undefined
    if (payloadVersion === undefined) {
      return null
    }
    const currentVersion = await getUserTokenVersion(payload.userId)
    if (currentVersion === null) {
      return null
    }
    if (payloadVersion < currentVersion) {
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
  tokenVersion: tokenVersionOpt,
  userAgent,
  ipAddress,
}: {
  userId: string
  tokenVersion?: number
  userAgent?: string
  ipAddress?: string
}) {
  const tokenVersion =
    tokenVersionOpt !== undefined ? tokenVersionOpt : (await getUserTokenVersion(userId)) ?? 0

  // Generate tokens (JWT refresh token for stateless verify in refreshAccessToken)
  const refreshToken = createRefreshToken(userId, tokenVersion)
  const accessToken = createAccessToken(userId, tokenVersion)

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

// Refresh access token using refresh token; issues new access (and new refresh) token with current tokenVersion
export async function refreshAccessToken(refreshToken: string) {
  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) {
    throw new Error("Invalid refresh token")
  }

  const currentVersion = (await getUserTokenVersion(payload.userId)) ?? 0
  const accessToken = createAccessToken(payload.userId, currentVersion)
  const newRefreshToken = createRefreshToken(payload.userId, currentVersion)

  return {
    accessToken,
    refreshToken: newRefreshToken,
    userId: payload.userId,
    sessionId: crypto.randomUUID(),
  }
}

// Invalidate a single session by id. No-op: we do not store sessions server-side; only "invalidate all" per user is supported via invalidateAllUserSessions(userId).
export async function invalidateSession(sessionId: string) {
  // No database operation; call invalidateAllUserSessions(userId) to revoke all tokens for a user.
}

// Invalidate all user sessions by incrementing tokenVersion so existing JWTs fail verification
export async function invalidateAllUserSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  })
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
