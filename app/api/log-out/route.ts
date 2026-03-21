import { NextRequest, NextResponse } from "next/server"
import cookie from "cookie"
import { getAuthCookieFlags } from "@/utils/security/auth-cookie.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"

const SIGN_IN = "/sign-in"

export async function POST(request: NextRequest) {
  try {
    await requireCSRF(request)
  } catch (error) {
    if (error instanceof CSRFError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    throw error
  }
  const cookieFlags = getAuthCookieFlags()
  const accessTokenCookie = cookie.serialize("accessToken", "", {
    ...cookieFlags,
    maxAge: 0,
  })
  const refreshTokenCookie = cookie.serialize("refreshToken", "", {
    ...cookieFlags,
    maxAge: 0,
  })

  const res = NextResponse.redirect(new URL(SIGN_IN, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"))
  res.headers.set("Set-Cookie", [accessTokenCookie, refreshTokenCookie].join(", "))
  return res
}
