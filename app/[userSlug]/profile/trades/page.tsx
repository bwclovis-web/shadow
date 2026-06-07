import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { getTradesForUserProfile } from "@/models/trade.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

import TradesPageClient from "./TradesPageClient"

const BANNER_IMAGE = publicAssetUrl("/images/mytrades.png")

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("myTrades.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function MyTradesPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const { user } = await requireOwnedProfileSession(userSlug, { subPath: "trades" })
  const userId = user.id
  const [activeTrades, historyTrades] = await Promise.all([
    getTradesForUserProfile(userId, userId, "active"),
    getTradesForUserProfile(userId, userId, "history", { limit: null }),
  ])

  return (
    <TradesPageClient
      activeTrades={activeTrades}
      historyTrades={historyTrades}
      bannerImage={BANNER_IMAGE}
      userSlug={userSlug}
      userId={userId}
    />
  )
}
