/**
 * Single "session-from-request" utility for auth
 * Consolidates cookie parsing + token verification + optional user lookup
 * Used across routes, loaders, and API handlers to avoid drift
 */

import cookie from "cookie"
import type { MembershipTier, SubscriptionStatus, UserRole } from "@prisma/client"
import { cache } from "react"

import { getUserById } from "@/models/user.query"
import {
  decodeAccessToken,
  refreshAccessToken,
  verifyAccessToken,
} from "@/utils/security/session-manager.server"
import { createSafeUser } from "./user"

// Canonical cookie names; temporary legacy fallback for migration (Fix #2)
const ACCESS_TOKEN_COOKIE = "accessToken"
const REFRESH_TOKEN_COOKIE = "refreshToken"
const LEGACY_TOKEN_COOKIE = "token"

export type SessionUser = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  username: string
  profileSlug?: string | null
  role: UserRole
  traderAbout?: string | null
  avatarImage?: string | null
  region?: string | null
  instagramHandle?: string | null
  fragranticaUrl?: string | null
  redditUsername?: string | null
  updatedAt?: Date
  /** Server-side participation / presence fields from the same user row. */
  subscriptionStatus: SubscriptionStatus
  membershipTier: MembershipTier
  isEarlyAdopter: boolean
  lastActiveAt: Date | null
}

export type SessionFromRequest = {
  userId: string
  user?: SessionUser
  tokens?: {
    accessToken?: string
    refreshToken?: string
  }
}

export type GetSessionOptions = {
  /** Fetch full user from DB (default: false for performance when only userId needed) */
  includeUser?: boolean
  /** Include raw tokens in result (default: false) */
  includeTokens?: boolean
  /** Try refresh token when access token invalid/expired (default: false) */
  attemptRefresh?: boolean
}

/** When refresh succeeds, caller should set this cookie (e.g. sharedLoader redirect) */
export type SessionWithRefresh = SessionFromRequest & {
  newAccessToken?: string
}

/**
 * Extract access/refresh tokens from cookie header string.
 * Uses canonical names with legacy fallback.
 */
export function getTokensFromCookieHeader(cookieHeader: string): {
  accessToken?: string
  refreshToken?: string
} {
  const cookies = cookie.parse(cookieHeader || "") ?? {}
  let accessToken = cookies[ACCESS_TOKEN_COOKIE]
  if (!accessToken && cookies[LEGACY_TOKEN_COOKIE]) {
    accessToken = cookies[LEGACY_TOKEN_COOKIE]
  }
  const refreshToken = cookies[REFRESH_TOKEN_COOKIE]
  return { accessToken, refreshToken }
}

/**
 * Get cookie header from Web Request or Express-like req
 */
function getCookieHeader(
  input: Request | { headers?: { cookie?: string; get?: (name: string) => string | undefined } }
): string {
  const headers = (input as Request).headers
  if (headers && typeof (headers as Headers).get === "function") {
    return (headers as Headers).get("cookie") || ""
  }
  const req = input as { headers?: { cookie?: string } }
  return req.headers?.cookie || ""
}

const toSessionUser = (fullUser: NonNullable<Awaited<ReturnType<typeof getUserById>>>): SessionUser | null => {
  const user = createSafeUser(fullUser)
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    username: user.username ?? "",
    profileSlug: user.profileSlug ?? null,
    role: user.role,
    traderAbout: user.traderAbout ?? null,
    avatarImage: fullUser.avatarImage ?? null,
    region: fullUser.region ?? null,
    instagramHandle: fullUser.instagramHandle ?? null,
    fragranticaUrl: fullUser.fragranticaUrl ?? null,
    redditUsername: fullUser.redditUsername ?? null,
    updatedAt: fullUser.updatedAt,
    subscriptionStatus: fullUser.subscriptionStatus,
    membershipTier: fullUser.membershipTier,
    isEarlyAdopter: fullUser.isEarlyAdopter,
    lastActiveAt: fullUser.lastActiveAt ?? null,
  }
}

/**
 * Resolve session with a single user read when includeUser is true
 * (JWT decode + getUserById; tokenVersion checked against the user row).
 */
const resolveSessionFromCookieHeader = async (
  cookieHeader: string,
  includeUser: boolean,
  includeTokens: boolean,
  attemptRefresh: boolean
): Promise<SessionFromRequest | SessionWithRefresh | null> => {
  const { accessToken, refreshToken } = getTokensFromCookieHeader(cookieHeader)

  let userId: string | null = null
  let accessTokenVersion: number | null = null
  let resolvedAccessToken = accessToken
  let didRefresh = false

  if (includeUser && accessToken) {
    const claims = decodeAccessToken(accessToken)
    if (claims) {
      userId = claims.userId
      accessTokenVersion = claims.tokenVersion
    }
  } else if (accessToken) {
    const payload = await verifyAccessToken(accessToken)
    if (payload?.userId) {
      userId = payload.userId
    }
  }

  if (!userId && attemptRefresh && refreshToken) {
    try {
      const refreshResult = await refreshAccessToken(refreshToken)
      if (refreshResult) {
        userId = refreshResult.userId
        resolvedAccessToken = refreshResult.accessToken
        didRefresh = true
        accessTokenVersion = null
      }
    } catch {
      // Token refresh failed
    }
  }

  if (!userId) {
    return null
  }

  const result: SessionFromRequest & Partial<SessionWithRefresh> = {
    userId,
    ...(includeTokens && resolvedAccessToken
      ? {
          tokens: {
            accessToken: resolvedAccessToken,
            refreshToken: refreshToken,
          },
        }
      : {}),
    ...(didRefresh && resolvedAccessToken
      ? { newAccessToken: resolvedAccessToken }
      : {}),
  }

  if (includeUser) {
    const fullUser = await getUserById(userId)
    if (!fullUser || fullUser.isBanned) {
      return null
    }
    // After refresh, session manager already validated tokenVersion.
    if (
      accessTokenVersion !== null &&
      accessTokenVersion < fullUser.tokenVersion
    ) {
      return null
    }
    const sessionUser = toSessionUser(fullUser)
    if (sessionUser) {
      result.user = sessionUser
    }
  }

  return result
}

/** Request-scoped dedupe for layout + page session lookups. */
const getSessionFromCookieHeaderCached = cache(resolveSessionFromCookieHeader)

/**
 * Core: get session from cookie header string.
 * Use this when you only have the raw cookie string (e.g. Express req.headers.cookie).
 */
export async function getSessionFromCookieHeader(
  cookieHeader: string,
  options: GetSessionOptions = {}
): Promise<SessionFromRequest | SessionWithRefresh | null> {
  return getSessionFromCookieHeaderCached(
    cookieHeader,
    options.includeUser ?? false,
    options.includeTokens ?? false,
    options.attemptRefresh ?? false
  )
}

/**
 * Get session from Web API Request (React Router loaders/actions).
 */
export async function getSessionFromRequest(
  request: Request,
  options: GetSessionOptions = {}
): Promise<SessionFromRequest | null> {
  const cookieHeader = getCookieHeader(request)
  return getSessionFromCookieHeader(cookieHeader, options)
}

/**
 * Get session from Express req (api/server.js, middleware).
 * Use for getLoadContext, requireAdminAuth, etc.
 */
export async function getSessionFromExpressRequest(
  req: { headers?: { cookie?: string; get?: (name: string) => string } },
  options: GetSessionOptions = {}
): Promise<SessionFromRequest | null> {
  const cookieHeader = getCookieHeader(req)
  return getSessionFromCookieHeader(cookieHeader, options)
}
