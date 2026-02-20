import { NextResponse } from "next/server"
import cookie from "cookie"

const SIGN_IN = "/sign-in"

export async function POST() {
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
