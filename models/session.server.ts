// app/models/session.server.ts
import cookie from "cookie"
import { redirect } from "react-router"

import { ROUTE_PATH as ADMIN_PROFILE } from "~/routes/admin/profilePage"

// Use hardcoded path to avoid circular dependency with SignInPage
const SIGN_IN = "/sign-in"
import {
  createSession,
  getActiveSession,
  invalidateAllUserSessions,
  invalidateSession,
  refreshAccessToken,
  verifyAccessToken,
} from "~/utils/security/session-manager.server"

import { getUserById } from "./user.query"
export async function getUser(context: { userSession: any }) {
  const userId = context?.userSession?.userId
  if (!userId) {
    return null
  }
  return getUserById(userId)
}

export async function requireUser(context: { userSession: any }) {
  const user = await getUser(context)
  if (!user) {
    throw redirect(SIGN_IN)
  }
  return user
}

export async function login({
  context,
  userId,
  redirectTo = ADMIN_PROFILE,
  userAgent,
  ipAddress,
}: {
  context: { req: any; res?: any }
  userId: string
  redirectTo?: string
  userAgent?: string
  ipAddress?: string
}) {
  // Create new session
  const { accessToken, refreshToken, sessionId } = await createSession({
    userId,
    userAgent,
    ipAddress,
  })

  // Set both access and refresh token cookies
  const accessTokenCookie = cookie.serialize("accessToken", accessToken, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60, // 60 minutes
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  const refreshTokenCookie = cookie.serialize("refreshToken", refreshToken, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  throw redirect(redirectTo, {
    headers: {
      "Set-Cookie": [accessTokenCookie, refreshTokenCookie],
    },
  })
}

export async function logout({
  context,
  sessionId,
}: {
  context: { res?: any }
  sessionId?: string
}) {
  // Invalidate session if sessionId provided
  if (sessionId) {
    await invalidateSession(sessionId)
  }

  // Clear both cookies
  const accessTokenCookie = cookie.serialize("accessToken", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0, // Expire immediately
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  const refreshTokenCookie = cookie.serialize("refreshToken", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0, // Expire immediately
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  throw redirect(SIGN_IN, {
    headers: {
      "Set-Cookie": [accessTokenCookie, refreshTokenCookie],
    },
  })
}

export async function requireRoles(context: { userSession: any }, roles: string[]) {
  const user = await getUser(context)
  if (!user || !roles.includes(user.role)) {
    throw redirect(SIGN_IN) // or custom unauthorized route
  }
  return user
}

// Refresh access token using refresh token
export async function refreshSession(refreshToken: string) {
  try {
    const { accessToken, userId, sessionId } = await refreshAccessToken(refreshToken)
    return { accessToken, userId, sessionId }
  } catch (error) {
    console.error("Session refresh failed:", error)
    return null
  }
}

// Invalidate all user sessions (for password change)
export async function invalidateAllSessions(userId: string) {
  await invalidateAllUserSessions(userId)
}

// Get user from access token
export async function getUserFromToken(accessToken: string) {
  const payload = verifyAccessToken(accessToken)
  if (!payload) {
    return null
  }
  return await getUserById(payload.userId)
}
