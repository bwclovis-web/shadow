import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import { getDisputesForUser } from "@/models/trade-dispute.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { getProfileSlug } from "@/utils/user"

import MyDisputesPageClient from "./MyDisputesPageClient"

const BANNER_IMAGE = publicAssetUrl("/images/complaints.png")

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("myDisputes.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function MyDisputesPage({
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
    redirect(`/${slug}/profile/disputes`)
  }

  const disputes = await getDisputesForUser(session.user.id)

  return (
    <MyDisputesPageClient
      disputes={disputes}
      bannerImage={BANNER_IMAGE}
      userSlug={userSlug}
      currentUserId={session.user.id}
    />
  )
}
