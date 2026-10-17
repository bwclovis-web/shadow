"use client"

import Image from "next/image"
import { type ChangeEvent, useState } from "react"
import { useTranslations } from "next-intl"

import Select from "@/components/Atoms/Select"
import CommunityStatsStrip from "@/components/Containers/Home/CommunityStatsStrip"
import SearchBar from "@/components/Organisms/SearchBar"
import type { CommunityStats } from "@/models/community-stats.server"

type SearchType = "perfume-house" | "perfume"

type HomeHeroProps = {
  communityStats: CommunityStats
  heading: string
  subheading: string
}

const HomeHero = ({
  communityStats,
  heading,
  subheading,
}: HomeHeroProps) => {
  const [searchType, setSearchType] = useState<SearchType>("perfume")
  const tHome = useTranslations("home")
  const tHero = useTranslations("home.galleryWalk.hero")
  const tSearch = useTranslations("components.search")

  const searchTypes = [
    {
      id: "perfume",
      name: tHero("searchTypes.perfume"),
      label: tHero("searchTypes.perfume"),
    },
    {
      id: "perfume-house",
      name: tHero("searchTypes.perfume-house"),
      label: tHero("searchTypes.perfume-house"),
    },
  ]

  const handleSearchTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSearchType(event.target.value as SearchType)
  }

  return (
    <section className="relative z-20 border-b border-noir-gold/30 bg-noir-black">
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        <Image
          src="/images/new/home.webp"
          alt=""
          priority
          fill
          quality={70}
          sizes="100vw"
          className="object-cover object-[72%_center] sepia-[0.7] saturate-[1.4] brightness-90"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-noir-black/70 via-noir-black/80 to-noir-black md:bg-gradient-to-r md:from-noir-black md:via-noir-black/75 md:via-45% md:to-noir-black/5" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-noir-black/80 to-transparent" />
      </div>

      <div className="relative pt-[var(--spacing-site-header-mobile)] lg:pt-[var(--spacing-site-header-desktop)] [[data-onboarding-banner]+main_&]:pt-0">
        <div className="mx-auto flex w-full max-w-[1280px] items-center px-5 py-6 sm:px-8 lg:min-h-[24rem] lg:px-10 lg:py-8">
          <div className="flex w-full flex-col items-start gap-4 text-left lg:w-[52%]">
            <div className="text-shadow-lg/90 text-shadow-noir-black">
              <h1 className="!text-[clamp(2.75rem,13vw,3.75rem)] !font-bold !leading-[1.05] lg:!text-[clamp(56px,5.5vw,80px)]">
                {heading}
              </h1>
              <p className="mt-2 font-headline text-[1.625rem] font-semibold leading-tight text-noir-light lg:text-[2.125rem]">
                {subheading}
              </p>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-noir-light/85 lg:text-[1.3125rem]">
                {tHome("description")}
              </p>
            </div>

            <div className="w-full max-w-[640px]">
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-0">
                <Select
                  size="expanded"
                  value={searchType}
                  action={handleSearchTypeChange}
                  selectId="home-search-type"
                  selectData={searchTypes}
                  className="min-h-12 w-full max-w-none self-stretch rounded-sm bg-noir-black/80 backdrop-blur-sm sm:w-40 sm:shrink-0 md:self-stretch md:text-base"
                  ariaLabel={tSearch("ariaLabel")}
                />
                <SearchBar
                  searchType={searchType}
                  variant="home"
                  placeholder={tHero(`placeholder.${searchType}`)}
                  className="min-h-12 bg-noir-black/80 backdrop-blur-sm sm:h-12 md:text-base"
                />
              </div>
              <p className="mt-2 text-sm text-noir-light/70">
                {tHero("searchHint")}
              </p>
            </div>

            <CommunityStatsStrip
              stats={communityStats}
              className="justify-start text-left text-sm md:text-sm"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

export default HomeHero
