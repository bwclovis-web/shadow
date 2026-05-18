import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { getTwoFactorStatus, isTwoFactorEnabled } from "@/models/two-factor.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { getProfileSlug } from "@/utils/user"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import SecurityPageClient from "./SecurityPageClient"

const BANNER_IMAGE = publicAssetUrl("/images/changePassword.png")

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("twoFactor")
  return {
    title: t("title"),
  }
}

export default async function SecurityPage({
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
  if (slug !== userSlug) {
    redirect(`/${slug}/profile/security`)
  }

  const twoFactorStatus = await getTwoFactorStatus(session.user.id)
  const twoFactorEnabled = twoFactorStatus
    ? isTwoFactorEnabled(twoFactorStatus)
    : false

  return (
    <SecurityPageClient
      bannerImage={BANNER_IMAGE}
      twoFactorEnabled={twoFactorEnabled}
      isAdmin={session.user.role === "admin" || session.user.role === "editor"}
    />
  )
}
