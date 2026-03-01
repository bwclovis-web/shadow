import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import type { SessionFromRequest } from "@/utils/session-from-request.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

/**
 * Get session and require admin role. Redirects to sign-in or unauthorized if not allowed.
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

  if (session.user.role !== "admin") {
    redirect("/unauthorized")
  }

  return session as SessionFromRequest & {
    user: NonNullable<SessionFromRequest["user"]>
  }
}
