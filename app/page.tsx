import { prisma } from "@/lib/db"
import { getFollowedActivity, getRecentlyListedActivity } from "@/models/activity-feed.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getSeasonalTrendingPerfumes } from "@/models/seasonal-trending.server"
import { getAllFeatures } from '@/models/feature.server'
import HomeClient from "./home-client"
import type { Metadata } from "next"

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Smell",
    description: "Discover and trade perfumes.",
  }
}

const HomePage = async () => {
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, { includeUser: true })
  const viewerId = session?.user?.id ?? null

  const [features, userCount, houseCount, perfumeCount, recentListings, followedActivity, seasonalTrending] =
    await Promise.all([
      getAllFeatures(),
      prisma.user.count(),
      prisma.perfumeHouse.count(),
      prisma.perfume.count(),
      getRecentlyListedActivity(6),
      viewerId ? getFollowedActivity(viewerId, 6) : Promise.resolve([]),
      getSeasonalTrendingPerfumes(10),
    ])

  const counts = {
    users: userCount,
    houses: houseCount,
    perfumes: perfumeCount,
  }

  return (
    <HomeClient
      features={features}
      counts={counts}
      recentListings={recentListings}
      followedActivity={followedActivity}
      seasonalTrending={seasonalTrending}
    />
  )
}

export default HomePage