import { NextResponse } from "next/server"
import cookie from "cookie"

import { refreshAccessToken } from "@/utils/security/session-manager.server"
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
  const cookieHeader = request.headers.get("cookie") ?? ""
  const { refreshToken } = getTokensFromCookieHeader(cookieHeader)

  if (!refreshToken) {
    return NextResponse.json({ success: false, error: "No refresh token" }, { status: 401 })
  }

  try {
    const result = await refreshAccessToken(refreshToken)
    const accessTokenCookie = cookie.serialize("accessToken", result.accessToken, {
      ...cookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    })
    const refreshTokenCookie = cookie.serialize("refreshToken", result.refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    })

    const res = NextResponse.json({ success: true })
    res.headers.set("Set-Cookie", [accessTokenCookie, refreshTokenCookie].join(", "))
    return res
  } catch {
    return NextResponse.json({ success: false, error: "Invalid or expired refresh token" }, { status: 401 })
  }
}
