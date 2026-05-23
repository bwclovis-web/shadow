import { getFollowedActivity, getRecentlyListedActivity } from "@/models/activity-feed.server"
import { getCommunityStats } from "@/models/community-stats.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getSeasonalTrendingPerfumes } from "@/models/seasonal-trending.server"
import { getTranslations } from "next-intl/server"
import HomeClient from "./home-client"
import type { Metadata } from "next"

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "perfumer's hollow",
    description: "Discover and trade perfumes.",
  }
}

const HomePage = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, { includeUser: true })
  const viewerId = session?.user?.id ?? null

  const t = await getTranslations("home")

  const [communityStats, recentListings, followedActivity, seasonalTrending] =
    await Promise.all([
      getCommunityStats(),
      getRecentlyListedActivity(6),
      viewerId ? getFollowedActivity(viewerId, 6) : Promise.resolve([]),
      getSeasonalTrendingPerfumes(10),
    ])

  return (
    <HomeClient
      communityStats={communityStats}
      heading={t("heading")}
      subheading={t("subheading")}
      recentListings={recentListings}
      followedActivity={followedActivity}
      seasonalTrending={seasonalTrending}
    />
  )
}

export default HomePage