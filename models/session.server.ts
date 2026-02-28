/**
 * Session helpers for Next.js App Router.
 * Use getSessionFromCookieHeader (utils/session-from-request.server) in layout/pages;
 * use these helpers when you need requireUser, requireRoles, or login/logout tokens.
 */

import { redirect } from "next/navigation"

import { SIGN_IN } from "@/constants/routes"
import {
  createSession,
  invalidateAllUserSessions,
  invalidateSession,
  refreshAccessToken,
  verifyAccessToken,
} from "@/utils/security/session-manager.server"
import {
  getSessionFromCookieHeader,
  type SessionFromRequest,
} from "@/utils/session-from-request.server"

import { getUserById } from "./user.query"

/** Cookie header string (e.g. from next/headers cookies().getAll()) or existing session */
export type SessionContext =
  | string
  | null
  | { userSession?: { userId?: string } | null }
  | SessionFromRequest
  | null

const getUserIdFromContext = async (
  context: SessionContext
): Promise<string | null> => {
  if (context == null) return null
  if (typeof context === "string") {
    const session = await getSessionFromCookieHeader(context, {
      includeUser: false,
    })
    return session?.userId ?? null
  }
  const session = context as
    | SessionFromRequest
    | { userSession?: { userId?: string } | null }
  if ("userId" in session && typeof (session as SessionFromRequest).userId === "string") {
    return (session as SessionFromRequest).userId
  }
  if ("userSession" in session) {
    return session.userSession?.userId ?? null
  }
  return null
}

/** Get current user from cookie header or session context. Returns null if unauthenticated. */
export const getUser = async (
  context: SessionContext
): Promise<Awaited<ReturnType<typeof getUserById>> | null> => {
  const userId = await getUserIdFromContext(context)
  if (!userId) return null
  return getUserById(userId)
}

/** Require authenticated user; redirects to sign-in if none. Use in server components/actions. */
export const requireUser = async (
  context: SessionContext
): Promise<NonNullable<Awaited<ReturnType<typeof getUser>>>> => {
  const user = await getUser(context)
  if (!user) {
    redirect(SIGN_IN)
  }
  return user
}

/** Create session tokens for login. Caller must set cookies and redirect (e.g. in a Server Action). */
export const getLoginSession = async ({
  userId,
  redirectTo,
  userAgent,
  ipAddress,
}: {
  userId: string
  /** e.g. getProfilePathForUser(user) - must be passed when redirecting to profile */
  redirectTo?: string
  userAgent?: string
  ipAddress?: string
}) => {
  const { accessToken, refreshToken } = await createSession({
    userId,
    userAgent,
    ipAddress,
  })
  return { accessToken, refreshToken, redirectTo }
}

/** Prepare logout. Caller must clear cookies (maxAge: 0) and redirect to redirectTo. */
export const getLogoutRedirect = async ({
  sessionId,
}: {
  sessionId?: string
} = {}): Promise<{ redirectTo: string }> => {
  if (sessionId) {
    await invalidateSession(sessionId)
  }
  return { redirectTo: SIGN_IN }
}

/** Require user to have one of the given roles; redirects to sign-in if not. */
export const requireRoles = async (
  context: SessionContext,
  roles: string[]
): Promise<NonNullable<Awaited<ReturnType<typeof getUser>>>> => {
  const user = await getUser(context)
  if (!user || !roles.includes(user.role)) {
    redirect(SIGN_IN)
  }
  return user
}

/** Refresh access token using refresh token. Returns null on failure. */
export const refreshSession = async (refreshToken: string) => {
  try {
    const result = await refreshAccessToken(refreshToken)
    return result
      ? {
          accessToken: result.accessToken,
          userId: result.userId,
          sessionId: result.sessionId,
        }
      : null
  } catch {
    return null
  }
}

/** Invalidate all sessions for a user (e.g. after password change). */
export const invalidateAllSessions = (userId: string): Promise<void> =>
  invalidateAllUserSessions(userId)

/** Resolve user from access token. Returns null if token invalid or user not found. */
export const getUserFromToken = async (accessToken: string) => {
  const payload = verifyAccessToken(accessToken)
  if (!payload) return null
  return getUserById(payload.userId)
}
