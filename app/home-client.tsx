"use client"

import { type ChangeEvent, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"

import Select from "@/components/Atoms/Select"
import ActivityFeedSection from "@/components/Containers/Exchange/ActivityFeedSection"
import CommunityStatsStrip from "@/components/Containers/Home/CommunityStatsStrip"
import SeasonalTrendingSection from "@/components/Containers/Exchange/SeasonalTrendingSection"
import SearchBar from "@/components/Organisms/SearchBar"
import { useMounted } from "@/hooks/useMounted"
import type {
  ActivityFeedListingRow,
  FollowedActivityItem,
} from "@/models/activity-feed.server"
import type { CommunityStats } from "@/models/community-stats.server"
import type { SeasonalTrendingResult } from "@/models/seasonal-trending.server"

const LANDING_HERO = "/images/landing-new.png"

type Feature = Awaited<ReturnType<typeof import("@/models/feature.server").getAllFeatures>>[number]

interface HomeClientProps {
  features: Feature[]
  communityStats: CommunityStats
  recentListings?: ActivityFeedListingRow[]
  followedActivity?: FollowedActivityItem[]
  seasonalTrending?: SeasonalTrendingResult
}

export default function HomeClient({
  features: _features,
  communityStats,
  recentListings = [],
  followedActivity = [],
  seasonalTrending = { season: "spring", perfumes: [] },
}: HomeClientProps) {
  const [searchType, setSearchType] = useState<"perfume-house" | "perfume">("perfume")
  const container = useRef<HTMLDivElement>(null)
  const tHome = useTranslations("home")
  const tComponents = useTranslations("components.search")
  const mounted = useMounted()

  // Lazy load GSAP animations after component mounts (skip when user prefers reduced motion)
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
        subtitle.style.opacity = "1"
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
        y: 50,
        duration: 1.2,
        ease: "power2.out",
      })
      gsap.fromTo(
        ".subtitle",
        {
          opacity: 0,
          filter: "blur(6px)",
          y: 20,
        },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          duration: 2,
          delay: 1.2,
          ease: "power3.out",
        }
      )
    }

    requestAnimationFrame(() => {
      loadAnimations()
    })
  }, [])

  const handleSelectType = (evt: ChangeEvent<HTMLSelectElement>) => {
    setSearchType(evt.target.value as "perfume-house" | "perfume")
  }

  const data = [
    {
      id: "perfume-house",
      name: mounted ? tHome("radio.houses") : "home.radio.houses",
      label: mounted ? tHome("radio.houses") : "home.radio.houses",
    },
    {
      id: "perfume",
      name: mounted ? tHome("radio.perfumes") : "home.radio.perfumes",
      label: mounted ? tHome("radio.perfumes") : "home.radio.perfumes",
    },
  ]

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
        sizes="100vw"
        className="object-cover filter grayscale-100% sepia-[0.5] mix-blend-multiply hero-image"
      />
      <div className="absolute inset-0 bg-noir-black/85 mask-radial-from-10% mask-radial-to-74% md:mask-radial-from-25% md:mask-radial-to-44%" />
      <section className="text-noir-gold relative z-10 flex flex-col items-center gap-4 pt-50 md:pt-40">
        <div className="text-shadow-lg/90 text-shadow-noir-black text-center">
          <h1 className="hero-title">
            {mounted ? tHome("heading") : "home.heading"}
          </h1>
          <p className="subtitle opacity-0">
            {mounted ? tHome("subheading") : "home.subheading"}
          </p>
        </div>
        <CommunityStatsStrip stats={communityStats} className="mt-4 mb-6 max-w-2xl" />
        <div className="flex flex-col-reverse md:flex-row items-baseline justify-start w-full max-w-4xl mt-6 gap-4 md:gap-0">
          <Select
            size="expanded"
            value={searchType}
            action={handleSelectType}
            selectId="search-type"
            selectData={data}
            className="md:mt-0.5"
            ariaLabel={
              mounted ? tComponents("ariaLabel") : "components.search.ariaLabel"
            }
          />
          <SearchBar
            searchType={searchType}
            variant="home"
            className="mt-2 md:mt-2 w-full"
          />
        </div>
      </section>

      {recentListings.length > 0 || seasonalTrending.perfumes.length > 0 ? (
        <section className="relative z-10 flex w-full max-w-4xl flex-col gap-6 px-4 pb-8">
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
              className="rounded-md border border-noir-gold/40 bg-noir-black/70 p-4 backdrop-blur-sm"
            />
          ) : null}
        </section>
      ) : null}
    </div>
  )
}
