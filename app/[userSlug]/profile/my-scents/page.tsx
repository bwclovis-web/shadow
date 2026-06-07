import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { getTradersWantingUserListings } from "@/models/wishlist-matching.server"
import { loadTraderReputationsForUserIds } from "@/services/reputation/loadReputationInputs.server"
import { enrichWishlistDemandRows } from "@/services/trade-match"
import { getUserInventoryStats } from "@/models/user-inventory-stats.server"
import { getUserPerfumes } from "@/models/user.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

import MyScentsPageClient from "./MyScentsPageClient"

const BANNER_IMAGE = publicAssetUrl("/images/perfumes.png")

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({
  params,
}: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("myScents.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function MyScentsPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const { user } = await requireOwnedProfileSession(userSlug, { subPath: "my-scents" })

  const [userPerfumes, wishlistDemandRaw, inventoryStats] = await Promise.all([
    getUserPerfumes(user.id),
    getTradersWantingUserListings(user.id),
    getUserInventoryStats(user.id),
  ])

  const demandTraderIds = wishlistDemandRaw.map(row => row.trader.id)
  const reputationMap =
    demandTraderIds.length > 0
      ? await loadTraderReputationsForUserIds(demandTraderIds)
      : new Map()
  const wishlistDemand = await enrichWishlistDemandRows(
    user.id,
    wishlistDemandRaw,
    Object.fromEntries(reputationMap)
  )

  const serialized = userPerfumes.map((up) => ({
    ...up,
    createdAt: up.createdAt.toISOString(),
    available: up.available ?? null,
    pausedAvailable: up.pausedAvailable ?? null,
    price: up.price ?? null,
    placeOfPurchase: up.placeOfPurchase ?? null,
    tradePrice: up.tradePrice ?? null,
    tradePreference: up.tradePreference ?? null,
    tradeOnly: up.tradeOnly ?? null,
    type: up.type ?? null,
  }))

  return (
    <MyScentsPageClient
      userPerfumes={serialized}
      wishlistDemand={wishlistDemand}
      inventoryStats={inventoryStats}
      bannerImage={BANNER_IMAGE}
    />
  )
}
