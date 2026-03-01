import { NextRequest, NextResponse } from "next/server"
import cookie from "cookie"
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
  const accessTokenCookie = cookie.serialize("accessToken", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  const refreshTokenCookie = cookie.serialize("refreshToken", "", {
    httpOnly: true,
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  const res = NextResponse.redirect(new URL(SIGN_IN, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"))
  res.headers.set("Set-Cookie", [accessTokenCookie, refreshTokenCookie].join(", "))
  return res
}
