"use client"

import { type ChangeEvent, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Image from "next/image"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import Select from "@/components/Atoms/Select"
import CommunityStatsStrip from "@/components/Containers/Home/CommunityStatsStrip"
import { DeferredBelowFold } from "@/components/Molecules/DeferredBelowFold/DeferredBelowFold"
import SearchBar from "@/components/Organisms/SearchBar"
import {
  THE_ARCHIVE_PATH,
  THE_COLLECTORS_GUIDE_PATH,
} from "@/constants/routes"
import type {
  ActivityFeedListingRow,
  FollowedActivityItem,
} from "@/models/activity-feed.server"
import type { CommunityStats } from "@/models/community-stats.server"
import type { SeasonalTrendingResult } from "@/models/seasonal-trending.server"

const THE_EXCHANGE_PATH = "/the-exchange"

const ActivityFeedSection = dynamic(
  () => import("@/components/Containers/Exchange/ActivityFeedSection"),
  { ssr: false }
)

const SeasonalTrendingSection = dynamic(
  () => import("@/components/Containers/Exchange/SeasonalTrendingSection"),
  { ssr: false }
)

const LANDING_HERO = "/images/new/home.webp"
const HERO_SIZES = "(max-width: 768px) 100vw, 1600px"

interface HomeClientProps {
  communityStats: CommunityStats
  heading: string
  subheading: string
  recentListings?: ActivityFeedListingRow[]
  followedActivity?: FollowedActivityItem[]
  seasonalTrending?: SeasonalTrendingResult
}

const scheduleIdleWork = (work: () => void) => {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(work, { timeout: 2000 })
  } else {
    setTimeout(work, 0)
  }
}

export default function HomeClient({
  communityStats,
  heading,
  subheading,
  recentListings = [],
  followedActivity = [],
  seasonalTrending = { season: "spring", perfumes: [] },
}: HomeClientProps) {
  const [searchType, setSearchType] = useState<"perfume-house" | "perfume">("perfume")
  const container = useRef<HTMLDivElement>(null)
  const tHome = useTranslations("home")
  const tComponents = useTranslations("components.search")

  useEffect(() => {
    const showHeroWithoutAnimation = () => {
      if (!container.current) return
      const heroTitle = container.current.querySelector<HTMLElement>(".hero-title")
      const subtitle = container.current.querySelector<HTMLElement>(".subtitle")
      if (heroTitle) {
        heroTitle.style.opacity = "1"
        heroTitle.style.transform = "none"
      }
      if (subtitle) {
        subtitle.style.filter = "none"
        subtitle.style.transform = "none"
      }
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      showHeroWithoutAnimation()
      return
    }

    const loadAnimations = async () => {
      const { gsap } = await import("gsap")

      if (!container.current) return

      gsap.from(".hero-title", {
        opacity: 0,
        y: 24,
        duration: 0.6,
        ease: "power2.out",
      })
      gsap.from(".subtitle", {
        y: 16,
        filter: "blur(4px)",
        duration: 0.5,
        delay: 0.35,
        ease: "power2.out",
      })
    }

    scheduleIdleWork(() => {
      void loadAnimations()
    })
  }, [])

  const handleSelectType = (evt: ChangeEvent<HTMLSelectElement>) => {
    setSearchType(evt.target.value as "perfume-house" | "perfume")
  }

  const data = [
    {
      id: "perfume-house",
      name: tHome("radio.houses"),
      label: tHome("radio.houses"),
    },
    {
      id: "perfume",
      name: tHome("radio.perfumes"),
      label: tHome("radio.perfumes"),
    },
  ]

  const showFeedSection =
    recentListings.length > 0 || seasonalTrending.perfumes.length > 0

  return (
    <div
      className="relative z-10 flex flex-col gap-8 items-center md:justify-center px-4 bg-noir-gold-500/30 min-h-dvh pb-20 md:pb-0"
      ref={container}
    >
      <Image
        src={LANDING_HERO}
        alt=""
        priority
        fill
        quality={62}
        sizes={HERO_SIZES}
        className="object-cover filter grayscale-100% sepia-[0.5] mix-blend-multiply hero-image"
      />
      <div className="absolute inset-0 bg-noir-black/45 mask-radial-from-10% mask-radial-to-74% md:mask-radial-from-25% md:mask-radial-to-44%" />
      <section className="text-noir-gold relative z-10 flex flex-col items-center gap-4 pt-50 md:pt-40 w-full">
        <div className="text-shadow-lg/90 text-shadow-noir-black text-center">
          <h1 className="hero-title">{heading}</h1>
          <p className="subtitle">{subheading}</p>
        </div>
        <CommunityStatsStrip stats={communityStats} className="lg:my-2 max-w-2xl" />
        <div className="flex flex-col-reverse md:flex-row items-baseline justify-start w-full lg:mt-2 mt-0 gap-4 md:gap-0 max-w-4xl">
          <Select
            size="expanded"
            value={searchType}
            action={handleSelectType}
            selectId="search-type"
            selectData={data}
            className="md:mt-0.5 w-full backdrop-blur-sm bg-noir-black/10"
            ariaLabel={tComponents("ariaLabel")}
          />
          <SearchBar
            searchType={searchType}
            variant="home"
            className="mt-2 md:mt-2 w-full backdrop-blur-sm bg-noir-black/10"
          />
        </div>
        <nav
          aria-label={tHome("cta.navLabel")}
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm md:text-base max-w-4xl"
        >
          <PrefetchLink
            href={THE_ARCHIVE_PATH}
            className="text-noir-gold underline-offset-4 hover:underline hover:text-noir-light transition-colors"
          >
            {tHome("cta.archive")}
          </PrefetchLink>
          <span aria-hidden className="text-noir-gold/50">
            ·
          </span>
          <PrefetchLink
            href={THE_EXCHANGE_PATH}
            className="text-noir-gold underline-offset-4 hover:underline hover:text-noir-light transition-colors"
          >
            {tHome("cta.exchange")}
          </PrefetchLink>
          <span aria-hidden className="text-noir-gold/50">
            ·
          </span>
          <PrefetchLink
            href={THE_COLLECTORS_GUIDE_PATH}
            className="text-noir-gold underline-offset-4 hover:underline hover:text-noir-light transition-colors"
          >
            {tHome("cta.guide")}
          </PrefetchLink>
        </nav>
      </section>

      {showFeedSection ? (
        <DeferredBelowFold
          className="relative z-10 flex w-full max-w-4xl flex-col gap-6 lg:py-8"
          minHeight="16rem"
        >
          {seasonalTrending.perfumes.length > 0 ? (
            <SeasonalTrendingSection
              season={seasonalTrending.season}
              perfumes={seasonalTrending.perfumes}
              variant="compact"
              className="rounded-md border border-noir-gold/40 bg-noir-black/70 p-4 backdrop-blur-sm"
            />
          ) : null}
          {recentListings.length > 0 || followedActivity.length > 0 ? (
            <ActivityFeedSection
              listings={recentListings}
              followedItems={followedActivity}
              variant="compact"
              className="rounded-md border border-noir-gold/40 bg-noir-black/70 lg:p-4 p-2 backdrop-blur-sm"
            />
          ) : null}
        </DeferredBelowFold>
      ) : null}
    </div>
  )
}
