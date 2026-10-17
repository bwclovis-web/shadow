"use client"

import AdSenseUnit from "@/components/Atoms/AdSenseUnit"
import SeasonalTrendingSection from "@/components/Containers/Exchange/SeasonalTrendingSection"
import HomeHero from "@/components/Containers/Home/HomeHero"
import HomeJournalSection from "@/components/Containers/Home/HomeJournalSection"
import HomeLatestListings from "@/components/Containers/Home/HomeLatestListings"
import HomePathways from "@/components/Containers/Home/HomePathways"
import HomePublicTraysFeature from "@/components/Containers/Home/HomePublicTraysFeature"
import { FoundingSpotsBanner } from "@/components/Molecules/FoundingSpotsBanner"
import type { ArticleListItem } from "@/lib/sanity/types"
import type { FollowedActivityItem } from "@/models/activity-feed.server"
import type { CommunityStats } from "@/models/community-stats.server"
import type { SeasonalTrendingResult } from "@/models/seasonal-trending.server"
import type { HomeListing } from "@/types/home-listing"

interface HomeClientProps {
  communityStats: CommunityStats
  heading: string
  subheading: string
  recentListings: HomeListing[]
  followedActivity: FollowedActivityItem[]
  seasonalTrending: SeasonalTrendingResult
  articles: ArticleListItem[]
  publicTraysEnabled: boolean
  showAds: boolean
  isGuest: boolean
}

const HomeClient = ({
  communityStats,
  heading,
  subheading,
  recentListings,
  followedActivity,
  seasonalTrending,
  articles,
  publicTraysEnabled,
  showAds,
  isGuest,
}: HomeClientProps) => {
  return (
    <main id="main-content" className="bg-noir-black">
      <HomeHero
        communityStats={communityStats}
        heading={heading}
        subheading={subheading}
      />
      <HomePathways />
      <HomeLatestListings
        listings={recentListings}
        followedItems={followedActivity}
      />
      <AdSenseUnit showAds={showAds} variant="display" />
      <HomePublicTraysFeature enabled={publicTraysEnabled} />
      <HomeJournalSection articles={articles} />
      {seasonalTrending.perfumes.length > 0 ? (
        <div className="mx-auto w-full max-w-[1280px] px-5 py-5 sm:px-8 lg:px-10 lg:py-6">
          <SeasonalTrendingSection
            season={seasonalTrending.season}
            perfumes={seasonalTrending.perfumes}
            variant="compact"
            className="border border-noir-gold/40 bg-noir-dark/70 p-4"
          />
        </div>
      ) : null}
      {isGuest ? (
        <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10">
          <FoundingSpotsBanner className="mb-5 py-3 lg:mb-6" />
        </div>
      ) : null}
    </main>
  )
}

export default HomeClient
