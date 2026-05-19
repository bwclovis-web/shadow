import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { notFound, redirect } from "next/navigation"

import { getActiveDisputeForTrade } from "@/models/trade-dispute.server"
import { getTradeByIdForViewer } from "@/models/trade.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { getProfileSlug } from "@/utils/user"

import TradeDetailClient from "./TradeDetailClient"

type Props = {
  params: Promise<{ tradeId: string }>
}

const BANNER_IMAGE = publicAssetUrl("/images/trade.webp")

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("tradeDetail.meta")
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: false, follow: false },
  }
}

export default async function TradeDetailPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { tradeId } = await params
  if (!tradeId) notFound()

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect(`/sign-in?redirect=${encodeURIComponent(`/trades/${tradeId}`)}`)
  }

  const trade = await getTradeByIdForViewer(tradeId, session.user.id, {
    viewerRole: session.user.role,
  })
  if (!trade) notFound()

  const activeDispute = await getActiveDisputeForTrade(tradeId, session.user.id)
  const userSlug = getProfileSlug(session.user)

  return (
    <TradeDetailClient
      trade={trade}
      viewerId={session.user.id}
      userSlug={userSlug}
      hasActiveDispute={Boolean(activeDispute)}
      bannerImage={BANNER_IMAGE}
    />
  )
}
