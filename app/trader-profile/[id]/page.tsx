import type { Metadata } from "next"
import type React from "react"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import type { TraderResponse } from "@/lib/queries/user"
import type { SafeUser } from "@/types"
import { getTraderFeedbackForProfile } from "@/models/traderFeedback.server"
import { getTradesForUserProfile } from "@/models/trade.server"
import { getViewerOverlapWithTraderWishlist } from "@/models/wishlist-matching.server"
import { getScentDnaForUser } from "@/models/scent-dna.server"
import {
  getScentJourneyForUser,
  SCENT_JOURNEY_PROFILE_LIMIT,
} from "@/models/scent-journey.server"
import { getFollowStateForViewer } from "@/models/user-follow.server"
import { getTraderById } from "@/models/user.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import TraderProfileClient from "./TraderProfileClient"

type Props = {
  params: Promise<{ id: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { id } = await params
  const trader = await getTraderById(id)
  if (!trader) return { title: "Trader" }
  const t = await getTranslations("traderProfile.meta")
  const traderName =
    [trader.firstName, trader.lastName].filter(Boolean).join(" ").trim() ||
    trader.username ||
    "Trader"
  return {
    title: t("title"),
    description: t("description", { traderName }),
  }
}

export default async function TraderProfilePage({
  params,
}: Props): Promise<React.ReactElement> {
  const { id } = await params
  if (!id) notFound()

  const trader = await getTraderById(id)
  if (!trader) notFound()

  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })
  const viewer = session?.user ?? null
  const viewerId = viewer?.id ?? null

  const [feedback, activeTrades, wishlistOverlap, scentDna, followState, scentJourney] =
    await Promise.all([
      getTraderFeedbackForProfile(trader.id, viewerId),
      getTradesForUserProfile(trader.id, viewerId, "active"),
      getViewerOverlapWithTraderWishlist(viewerId, trader.id),
      getScentDnaForUser(trader.id),
      getFollowStateForViewer(viewerId, "user", trader.id),
      getScentJourneyForUser(trader.id, SCENT_JOURNEY_PROFILE_LIMIT + 1),
    ])

  const scentJourneyHasMore = scentJourney.length > SCENT_JOURNEY_PROFILE_LIMIT
  const scentJourneyPreview = scentJourney.slice(0, SCENT_JOURNEY_PROFILE_LIMIT)

  return (
    <TraderProfileClient
      initialTrader={trader as TraderResponse}
      viewer={viewer as SafeUser | null}
      feedback={feedback}
      activeTrades={activeTrades}
      wishlistOverlap={wishlistOverlap}
      scentDna={scentDna}
      initialFollowing={followState.following}
      followerCount={followState.followerCount ?? 0}
      scentJourney={scentJourneyPreview}
      scentJourneyHasMore={scentJourneyHasMore}
    />
  )
}
