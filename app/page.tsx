import { prisma } from "@/lib/db"
import { getRecentlyListedActivity } from "@/models/activity-feed.server"
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
  const [features, userCount, houseCount, perfumeCount, recentListings, seasonalTrending] =
    await Promise.all([
      getAllFeatures(),
      prisma.user.count(),
      prisma.perfumeHouse.count(),
      prisma.perfume.count(),
      getRecentlyListedActivity(6),
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
      seasonalTrending={seasonalTrending}
    />
  )
}

export default HomePage