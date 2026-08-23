import crypto from "crypto"
import jwt from "jsonwebtoken"

import { prisma } from "@/lib/db"
import { getUserTokenVersion } from "@/models/user.query"
import { getSessionConfig } from "@/utils/security/session-config.server"

const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex")

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

export const createAccessToken = (userId: string, tokenVersion: number): string => {
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

export const createRefreshToken = (userId: string, tokenVersion: number): string => {
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

export const verifyAccessToken = async (
  token: string
): Promise<{ userId: string } | null> => {
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

export const verifyRefreshToken = async (
  token: string
): Promise<{ userId: string } | null> => {
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

export const createSession = async (params: {
  userId: string
  tokenVersion?: number
  userAgent?: string
  ipAddress?: string
}) => {
  const { userId, tokenVersion: tokenVersionOpt, userAgent, ipAddress } = params
  const tokenVersion =
    tokenVersionOpt !== undefined ? tokenVersionOpt : (await getUserTokenVersion(userId)) ?? 0

  const refreshToken = createRefreshToken(userId, tokenVersion)
  const accessToken = createAccessToken(userId, tokenVersion)
  const familyId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const tokenHash = hashToken(refreshToken)

  const session = await prisma.refreshSession.create({
    data: {
      userId,
      tokenHash,
      familyId,
      userAgent: userAgent ?? null,
      ipAddress: ipAddress ?? null,
      expiresAt,
    },
  })

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
    expiresAt,
  }
}

/**
 * Rotate refresh token. Detects reuse of an already-rotated/revoked token
 * and invalidates the entire session family.
 */
export const refreshAccessToken = async (refreshToken: string) => {
  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) {
    throw new Error("Invalid refresh token")
  }

  const tokenHash = hashToken(refreshToken)
  const existing = await prisma.refreshSession.findUnique({
    where: { tokenHash },
  })

  // Legacy tokens (pre-persistence): create a new tracked session family.
  if (!existing) {
    const currentVersion = (await getUserTokenVersion(payload.userId)) ?? 0
    const accessToken = createAccessToken(payload.userId, currentVersion)
    const newRefreshToken = createRefreshToken(payload.userId, currentVersion)
    const familyId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const session = await prisma.refreshSession.create({
      data: {
        userId: payload.userId,
        tokenHash: hashToken(newRefreshToken),
        familyId,
        expiresAt,
      },
    })
    return {
      accessToken,
      refreshToken: newRefreshToken,
      userId: payload.userId,
      sessionId: session.id,
    }
  }

  if (existing.revokedAt || existing.replacedByHash) {
    // Reuse detection — revoke entire family and bump tokenVersion.
    await prisma.refreshSession.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: new Date(), reuseDetectedAt: new Date() },
    })
    await prisma.user.update({
      where: { id: existing.userId },
      data: { tokenVersion: { increment: 1 } },
    })
    throw new Error("Refresh token reuse detected")
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    await prisma.refreshSession.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    })
    throw new Error("Refresh token expired")
  }

  const currentVersion = (await getUserTokenVersion(payload.userId)) ?? 0
  const accessToken = createAccessToken(payload.userId, currentVersion)
  const newRefreshToken = createRefreshToken(payload.userId, currentVersion)
  const newHash = hashToken(newRefreshToken)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.refreshSession.update({
      where: { id: existing.id },
      data: {
        revokedAt: new Date(),
        replacedByHash: newHash,
      },
    }),
    prisma.refreshSession.create({
      data: {
        userId: payload.userId,
        tokenHash: newHash,
        familyId: existing.familyId,
        userAgent: existing.userAgent,
        ipAddress: existing.ipAddress,
        expiresAt,
      },
    }),
  ])

  const newSession = await prisma.refreshSession.findUniqueOrThrow({
    where: { tokenHash: newHash },
  })

  return {
    accessToken,
    refreshToken: newRefreshToken,
    userId: payload.userId,
    sessionId: newSession.id,
  }
}

export const invalidateSession = async (sessionId: string) => {
  await prisma.refreshSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export const invalidateAllUserSessions = async (userId: string) => {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
    prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])
}

export const getActiveSession = async (sessionId: string) => {
  const session = await prisma.refreshSession.findFirst({
    where: {
      id: sessionId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  return session
}

export const cleanupExpiredSessions = async () => {
  const result = await prisma.refreshSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { revokedAt: { not: null } },
      ],
    },
  })
  return result.count
}

export const getUserActiveSessions = async (userId: string) => {
  return prisma.refreshSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      familyId: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      expiresAt: true,
    },
  })
}
