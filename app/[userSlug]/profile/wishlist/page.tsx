import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { getUserWishlist } from "@/models/wishlist.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

import WishlistPageClient from "./WishlistPageClient"

const BANNER_IMAGE = publicAssetUrl("/images/wishlist.png")

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("wishlist.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function WishlistPage({
  params,
}: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const { user } = await requireOwnedProfileSession(userSlug, { subPath: "wishlist" })
  const wishlist = await getUserWishlist(user.id)

  return (
    <WishlistPageClient
      wishlist={wishlist}
      bannerImage={BANNER_IMAGE}
      userSlug={userSlug}
      userId={user.id}
    />
  )
}
