import { getFollowedActivity } from "@/models/activity-feed.server"
import { getCommunityStats } from "@/models/community-stats.server"
import { getCachedHomeLatestListings } from "@/models/home-listings.server"
import { shouldShowAds } from "@/utils/ads/should-show-ads"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCachedSeasonalTrendingPerfumes } from "@/models/seasonal-trending.server"
import { getLatestPublishedArticlesOrEmpty } from "@/lib/sanity/articles.server"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { isFeatureEnabled } from "@/utils/feature-flags"
import { getTranslations } from "next-intl/server"
import HomeClient from "./home-client"
import type { Metadata } from "next"

export const revalidate = 3600

const HOME_JOURNAL_ARTICLE_LIMIT = 3

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: "/",
  })
}

const HomePage = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, { includeUser: true })
  const viewerId = session?.user?.id ?? null

  const t = await getTranslations("home")

  const [
    communityStats,
    recentListings,
    followedActivity,
    seasonalTrending,
    articles,
  ] =
    await Promise.all([
      getCommunityStats(),
      getCachedHomeLatestListings(),
      viewerId ? getFollowedActivity(viewerId, 6) : Promise.resolve([]),
      getCachedSeasonalTrendingPerfumes(10),
      getLatestPublishedArticlesOrEmpty(HOME_JOURNAL_ARTICLE_LIMIT),
    ])

  return (
    <HomeClient
      communityStats={communityStats}
      heading={t("heading")}
      subheading={t("subheading")}
      recentListings={recentListings}
      followedActivity={followedActivity}
      seasonalTrending={seasonalTrending}
      articles={articles}
      publicTraysEnabled={isFeatureEnabled("communityShelves")}
      showAds={shouldShowAds(session?.user)}
      isGuest={!viewerId}
    />
  )
}

export default HomePage
