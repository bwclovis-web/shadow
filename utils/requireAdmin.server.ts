import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getTwoFactorStatus, isTwoFactorEnabled } from "@/models/two-factor.server"
import type { SessionFromRequest } from "@/utils/session-from-request.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getProfilePathForUser } from "@/utils/user"

/**
 * Get session and require admin or editor role. Redirects to sign-in or unauthorized if not allowed.
 * Admin/editor accounts must have 2FA enabled before accessing /admin.
 * Use in server components and server actions.
 */
export const requireAdminSession = async (
  redirectPath: string
): Promise<SessionFromRequest & { user: NonNullable<SessionFromRequest["user"]> }> => {
  const store = await cookies()
  const cookieHeader = store
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect(`/sign-in?redirect=${encodeURIComponent(redirectPath)}`)
  }

  if (session.user.role !== "admin" && session.user.role !== "editor") {
    redirect("/unauthorized")
  }

  const twoFactorStatus = await getTwoFactorStatus(session.user.id)
  if (!twoFactorStatus || !isTwoFactorEnabled(twoFactorStatus)) {
    const securityPath = `${getProfilePathForUser(session.user)}/security`
    redirect(
      `${securityPath}?require2fa=1&redirect=${encodeURIComponent(redirectPath)}`
    )
  }

  return session as SessionFromRequest & {
    user: NonNullable<SessionFromRequest["user"]>
  }
}
