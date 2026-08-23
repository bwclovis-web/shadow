import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getCollectionInsights } from "@/models/collection-insights.server"
import { publicAssetUrl } from "@/utils/public-asset-url.server"
import { requireOwnedProfileSession } from "@/utils/server/require-profile-session.server"

import { CollectionInsightsClient } from "./CollectionInsightsClient"

const BANNER_IMAGE = publicAssetUrl("/images/perfumes.png")

type Props = {
  params: Promise<{ userSlug: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  await params
  const t = await getTranslations("collectionInsights.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const CollectionInsightsPage = async ({ params }: Props) => {
  const { userSlug } = await params
  const { user } = await requireOwnedProfileSession(userSlug, {
    subPath: "collection-insights",
  })
  const t = await getTranslations("collectionInsights")
  const insights = await getCollectionInsights(user.id)

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PageWrapper>
        <CollectionInsightsClient
          insights={insights}
          membershipHref="/membership"
          userSlug={userSlug}
        />
      </PageWrapper>
    </main>
  )
}

export default CollectionInsightsPage
