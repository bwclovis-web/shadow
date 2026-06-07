import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { getTwoFactorStatus, isTwoFactorEnabled } from "@/models/two-factor.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

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
  const { user } = await requireOwnedProfileSession(userSlug, { subPath: "security" })
  const twoFactorStatus = await getTwoFactorStatus(user.id)
  const twoFactorEnabled = twoFactorStatus
    ? isTwoFactorEnabled(twoFactorStatus)
    : false

  return (
    <SecurityPageClient
      bannerImage={BANNER_IMAGE}
      twoFactorEnabled={twoFactorEnabled}
      isAdmin={user.role === "admin" || user.role === "editor"}
    />
  )
}
