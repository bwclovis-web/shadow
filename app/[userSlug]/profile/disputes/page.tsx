import type { Metadata } from "next"
import type React from "react"
import { getTranslations } from "next-intl/server"
import { getDisputesForUser } from "@/models/trade-dispute.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

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
  const { user } = await requireOwnedProfileSession(userSlug, { subPath: "disputes" })
  const disputes = await getDisputesForUser(user.id)

  return (
    <MyDisputesPageClient
      disputes={disputes}
      bannerImage={BANNER_IMAGE}
      userSlug={userSlug}
      currentUserId={user.id}
    />
  )
}
