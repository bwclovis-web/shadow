import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

import { getPublicWishlistForUser } from "@/models/wishlist.server"
import { getTraderById } from "@/models/user.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { getTraderDisplayName } from "@/utils/user"

import PublicWishlistClient from "./PublicWishlistClient"

type Props = {
  params: Promise<{ userId: string }>
}

const BANNER_IMAGE = publicAssetUrl("/images/wishlist.png")

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { userId } = await params
  const trader = await getTraderById(userId)
  if (!trader) return { title: "Wishlist" }

  const t = await getTranslations("wishlist.public.meta")
  const traderName = getTraderDisplayName(trader)

  return {
    title: t("title", { traderName }),
    description: t("description", { traderName }),
    openGraph: {
      title: t("title", { traderName }),
      description: t("description", { traderName }),
      type: "profile",
    },
    twitter: {
      card: "summary",
      title: t("title", { traderName }),
      description: t("description", { traderName }),
    },
  }
}

export default async function PublicWishlistPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { userId } = await params
  if (!userId) notFound()

  const trader = await getTraderById(userId)
  if (!trader) notFound()

  const items = await getPublicWishlistForUser(userId)

  const traderName = getTraderDisplayName(trader)

  return (
    <PublicWishlistClient
      traderId={trader.id}
      traderName={traderName}
      items={items}
      bannerImage={BANNER_IMAGE}
    />
  )
}
