import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { getTwoFactorStatus, isTwoFactorEnabled } from "@/models/two-factor.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

import SecurityPageClient from "./SecurityPageClient"
import { listActiveSessionsForUser } from "./actions"

const BANNER_IMAGE = publicAssetUrl("/images/changePassword.png")

type Props = {
  params: Promise<{ userSlug: string }>
  searchParams: Promise<{ require2fa?: string }>
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
  searchParams,
}: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const resolvedSearch = await searchParams
  const { user } = await requireOwnedProfileSession(userSlug, { subPath: "security" })
  const twoFactorStatus = await getTwoFactorStatus(user.id)
  const twoFactorEnabled = twoFactorStatus
    ? isTwoFactorEnabled(twoFactorStatus)
    : false
  const sessions = await listActiveSessionsForUser(user.id)

  return (
    <SecurityPageClient
      bannerImage={BANNER_IMAGE}
      twoFactorEnabled={twoFactorEnabled}
      isAdmin={user.role === "admin" || user.role === "editor"}
      require2fa={resolvedSearch.require2fa === "1"}
      sessions={sessions}
    />
  )
}
