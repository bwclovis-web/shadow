import { redirect } from "next/navigation"

import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getProfilePathForUser } from "@/utils/user"

/**
 * Deep-link for digest emails / CTAs — redirects signed-in users to their profile digest.
 */
const DigestRedirectPage = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect(`/sign-in?redirect=${encodeURIComponent("/digest")}`)
  }

  redirect(`${getProfilePathForUser(session.user)}/digest`)
}

export default DigestRedirectPage
