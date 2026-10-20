import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { brandPageTitle } from "@/lib/seo/metadata"
import { getPublicSeekingPage } from "@/models/wishlist-seeking.server"
import { getTraderById } from "@/models/user.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { parseSeekingPublicState } from "@/utils/seeking-params"
import { getTraderDisplayName } from "@/utils/user"

import PublicWishlistClient from "./PublicWishlistClient"

type Props = {
  params: Promise<{ userId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const BANNER_IMAGE = publicAssetUrl("/images/wishlist.png")

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { userId } = await params
  const trader = await getTraderById(userId)
  if (!trader) return { title: "Wishlist" }

  const t = await getTranslations("wishlist.public.meta")
  const traderName = getTraderDisplayName(trader)
  const title = t("title", { traderName })
  const description = t("description", { traderName })
  const socialTitle = brandPageTitle(title)

  return {
    title,
    description,
    openGraph: {
      title: socialTitle,
      description,
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: socialTitle,
      description,
    },
  }
}

export default async function PublicWishlistPage({
  params,
  searchParams,
}: Props): Promise<React.ReactElement> {
  const { userId } = await params
  if (!userId) notFound()

  const trader = await getTraderById(userId)
  if (!trader) notFound()

  const rawParams = await searchParams
  const urlState = parseSeekingPublicState(rawParams)
  const seeking = await getPublicSeekingPage({
    ownerUserId: userId,
    page: urlState.page,
  })

  const traderName = getTraderDisplayName(trader)

  return (
    <PublicWishlistClient
      traderId={trader.id}
      traderName={traderName}
      traderRegion={trader.region}
      seeking={seeking}
      urlState={urlState}
      bannerImage={BANNER_IMAGE}
    />
  )
}
