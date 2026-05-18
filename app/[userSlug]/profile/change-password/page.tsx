import type React from "react"
import { redirect } from "next/navigation"

import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getProfileSlug } from "@/utils/user"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

type Props = {
  params: Promise<{ userSlug: string }>
}

/** Legacy route — password settings live on Account Security. */
export default async function ChangePasswordRedirectPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const slug = getProfileSlug(session.user)
  redirect(`/${slug}/profile/security`)
}
