import { NextRequest, NextResponse } from "next/server"
import cookie from "cookie"
import { getAuthCookieFlags } from "@/utils/security/auth-cookie.server"
import { CSRFError, requireCSRF } from "@/utils/server/csrf.server"
import { authenticateUser } from "@/utils/server/auth.server"
import { invalidateAllUserSessions } from "@/utils/security/session-manager.server"
import { logSecurityAudit } from "@/utils/security/security-audit.server"
import { getClientIdentifier } from "@/utils/server/request.server"

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

  // Revoke all refresh/access tokens for this user before clearing cookies.
  const authResult = await authenticateUser(request)
  if (authResult.success && authResult.user?.id) {
    try {
      await invalidateAllUserSessions(authResult.user.id)
      await logSecurityAudit({
        userId: authResult.user.id,
        action: "LOGOUT",
        severity: "info",
        resource: "Session",
        ipAddress: getClientIdentifier(request),
        userAgent: request.headers.get("user-agent"),
        details: { reason: "user_logout" },
      })
    } catch {
      // Still clear cookies even if revocation/audit fails.
    }
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

  const res = NextResponse.redirect(
    new URL(SIGN_IN, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  )
  res.headers.set("Set-Cookie", [accessTokenCookie, refreshTokenCookie].join(", "))
  return res
}
