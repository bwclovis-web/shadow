import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"

import { getOwnedSeekingPage } from "@/models/wishlist-seeking.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"
import { parseSeekingOwnedState } from "@/utils/seeking-params"

import WishlistPageClient from "./WishlistPageClient"

const BANNER_IMAGE = publicAssetUrl("/images/wishlist.png")

type Props = {
  params: Promise<{ userSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
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
  searchParams,
}: Props): Promise<React.ReactElement> {
  const { userSlug } = await params
  const rawParams = await searchParams
  const urlState = parseSeekingOwnedState(rawParams)
  const { user } = await requireOwnedProfileSession(userSlug, {
    subPath: "wishlist",
  })

  const seeking = await getOwnedSeekingPage({
    ownerUserId: user.id,
    search: urlState.search,
    visibility: urlState.visibility,
    availablePage: urlState.availablePage,
    stillSeekingPage: urlState.seekingPage,
  })

  return (
    <WishlistPageClient
      bannerImage={BANNER_IMAGE}
      userSlug={userSlug}
      userId={user.id}
      urlState={urlState}
      seeking={seeking}
    />
  )
}
