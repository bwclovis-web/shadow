import { redirect } from "next/navigation"

import { requireParticipation } from "@/utils/membership/entitlements.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import type { SessionFromRequest, SessionUser } from "@/utils/session-from-request.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getProfileSlug } from "@/utils/user"

export type RequireOwnedProfileSessionOptions = {
  /** Profile sub-path after `/profile/` (e.g. `trades`, `wishlist`). Omit for profile root. */
  subPath?: string
}

export type OwnedProfileSession = {
  user: SessionUser
  session: SessionFromRequest & { user: SessionUser }
}

const buildProfileRedirect = (slug: string, subPath?: string): string => {
  const base = `/${slug}/profile`
  return subPath ? `${base}/${subPath}` : base
}

const subscribeRedirectForPath = (slug: string, subPath?: string): string => {
  const path = buildProfileRedirect(slug, subPath)
  return `/subscribe?tier=member&redirect=${encodeURIComponent(path)}`
}

export const requireOwnedProfileSession = async (
  userSlug: string,
  options: RequireOwnedProfileSessionOptions = {}
): Promise<OwnedProfileSession> => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const slug = getProfileSlug(session.user)
  if (slug !== userSlug) {
    redirect(buildProfileRedirect(slug, options.subPath))
  }

  const participation = await requireParticipation(session.user.id)
  if (!participation.ok) {
    redirect(subscribeRedirectForPath(slug, options.subPath))
  }

  return {
    user: session.user,
    session: session as OwnedProfileSession["session"],
  }
}
