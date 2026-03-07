import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { getUserWishlist } from "@/models/wishlist.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getProfileSlug } from "@/utils/user"

import WishlistPageClient from "./WishlistPageClient"

const BANNER_IMAGE = "/images/wishlist.png"

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
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!session?.user) {
    redirect("/sign-in")
  }

  const slug = getProfileSlug(session.user)
  if (slug !== userSlug) {
    redirect(`/${slug}/profile/wishlist`)
  }

  const wishlist = await getUserWishlist(session.user.id)

  return (
    <WishlistPageClient
      wishlist={wishlist}
      bannerImage={BANNER_IMAGE}
      userSlug={userSlug}
    />
  )
}
