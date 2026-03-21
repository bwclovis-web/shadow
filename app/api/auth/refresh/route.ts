import { NextResponse } from "next/server"
import cookie from "cookie"

import { validateRateLimit } from "@/utils/api-validation.server"
import { getAuthRateLimits } from "@/utils/rate-limit-config.server"
import { getAuthCookieFlags } from "@/utils/security/auth-cookie.server"
import { refreshAccessToken } from "@/utils/security/session-manager.server"
import { getClientIdentifier } from "@/utils/server/request.server"
import { getTokensFromCookieHeader } from "@/utils/session-from-request.server"

const ACCESS_TOKEN_MAX_AGE = 60 * 60 // 1 hour
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

const cookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
}

/**
 * POST /api/auth/refresh
 * Reads refresh token from cookie, issues new access + refresh tokens, sets new cookies.
 * Call with credentials: 'include' so cookies are sent and Set-Cookie is accepted.
 * No CSRF required (refresh token is httpOnly; we only issue new tokens).
 */
export async function POST(request: Request) {
  const authLimits = getAuthRateLimits()
  const clientId = getClientIdentifier(request)
  try {
    validateRateLimit(
      `auth:refresh:${clientId}`,
      authLimits.refresh.max,
      authLimits.refresh.windowMs
    )
  } catch (rateLimitResponse) {
    if (rateLimitResponse instanceof Response) {
      return rateLimitResponse
    }
    throw rateLimitResponse
  }

  const cookieHeader = request.headers.get("cookie") ?? ""
  const { refreshToken } = getTokensFromCookieHeader(cookieHeader)

  if (!refreshToken) {
    return NextResponse.json({ success: false, error: "No refresh token" }, { status: 401 })
  }

  try {
    const result = await refreshAccessToken(refreshToken)
    const cookieFlags = getAuthCookieFlags()
    const accessTokenCookie = cookie.serialize("accessToken", result.accessToken, {
      ...cookieFlags,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    })
    const refreshTokenCookie = cookie.serialize("refreshToken", result.refreshToken, {
      ...cookieFlags,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    })

    const res = NextResponse.json({ success: true })
    res.headers.set("Set-Cookie", [accessTokenCookie, refreshTokenCookie].join(", "))
    return res
  } catch {
    return NextResponse.json({ success: false, error: "Invalid or expired refresh token" }, { status: 401 })
  }
}
