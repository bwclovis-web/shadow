"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { FaLeaf } from "react-icons/fa6"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import type { SeasonalTrendingPerfumeRow } from "@/models/seasonal-trending.server"
import type { SeasonKey } from "@/types/perfume-season-vote"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

type SeasonalTrendingSectionProps = {
  season: SeasonKey
  perfumes: SeasonalTrendingPerfumeRow[]
  /** `compact` is the homepage horizontal ranked strip; `sidebar` is the Exchange list. */
  variant?: "sidebar" | "compact"
  className?: string
}

type TrendingItemProps = {
  rank: number
  perfume: SeasonalTrendingPerfumeRow
}

const TrendingRow = ({ rank, perfume }: TrendingItemProps) => {
  const t = useTranslations("tradingPost.seasonalTrending")
  const imageSrc = normalizeRemoteImageSrc(perfume.image)

  return (
    <PrefetchLink
      href={`/perfume/${perfume.slug}`}
      className="flex min-w-0 gap-3 rounded-md border border-noir-light/30 bg-noir-dark/50 p-2 transition-colors hover:border-noir-gold/50 hover:bg-noir-dark/80"
      aria-label={t("viewPerfume", { name: perfume.name })}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-noir-gold/40 bg-noir-black/60 text-sm font-bold text-noir-gold tabular-nums"
        aria-hidden
      >
        {rank}
      </span>
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-noir-gold/30 bg-noir-black/40">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-xs text-noir-gold/60"
            aria-hidden
          >
            —
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold text-noir-gold">
          {perfume.name}
        </span>
        {perfume.perfumeHouse ? (
          <span className="mt-0.5 block truncate text-xs text-noir-gold-500">
            {perfume.perfumeHouse.name}
          </span>
        ) : null}
        <span className="mt-1 block text-xs text-noir-gold-100/80">
          {t("voteCount", { count: perfume.voteCount })}
        </span>
      </span>
    </PrefetchLink>
  )
}

const CompactTrendingItem = ({ rank, perfume }: TrendingItemProps) => {
  const imageSrc = normalizeRemoteImageSrc(perfume.image)

  return (
    <PrefetchLink
      href={`/perfume/${perfume.slug}`}
      className="flex h-full min-w-0 items-center gap-3 border border-noir-gold/30 bg-noir-black/40 p-2.5 transition-colors hover:border-noir-gold/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"
    >
      <span
        className="w-6 shrink-0 text-center font-headline text-2xl font-semibold leading-none text-noir-gold tabular-nums"
        aria-hidden
      >
        {rank}
      </span>
      <span className="relative h-12 w-12 shrink-0 overflow-hidden border border-noir-gold/30 bg-noir-black">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-contain"
            sizes="48px"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-semibold leading-snug text-noir-gold">
          {perfume.name}
        </span>
        {perfume.perfumeHouse ? (
          <span className="mt-0.5 block truncate text-xs text-noir-light/75">
            {perfume.perfumeHouse.name}
          </span>
        ) : null}
      </span>
    </PrefetchLink>
  )
}

const SeasonalTrendingSection = ({
  season,
  perfumes,
  variant = "sidebar",
  className = "",
}: SeasonalTrendingSectionProps) => {
  const isCompact = variant === "compact"
  const t = useTranslations(
    isCompact ? "home.seasonalTrending" : "tradingPost.seasonalTrending"
  )
  const tSeason = useTranslations("singlePerfume.seasonVote.season")

  if (perfumes.length === 0) return null
  const seasonLabel = tSeason(season)

  if (isCompact) {
    return (
      <section
        className={className}
        aria-labelledby="home-seasonal-trending-heading"
      >
        <div className="flex items-center gap-2">
          <FaLeaf className="h-4 w-4 shrink-0 text-noir-gold" aria-hidden />
          <h2
            id="home-seasonal-trending-heading"
            className="!text-[clamp(1.625rem,2.1vw,1.875rem)] !font-semibold"
          >
            {t("title", { season: seasonLabel })}
          </h2>
        </div>
        <ol className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
          {perfumes.map((perfume, index) => (
            <li
              key={perfume.perfumeId}
              className="w-[220px] shrink-0 snap-start xl:w-[calc((100%-3rem)/5)]"
            >
              <CompactTrendingItem rank={index + 1} perfume={perfume} />
            </li>
          ))}
        </ol>
      </section>
    )
  }

  return (
    <section
      className={className}
      aria-labelledby="exchange-seasonal-trending-heading"
    >
      <div className="flex items-start gap-3">
        <FaLeaf
          className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold"
          aria-hidden
        />
        <div>
          <h2
            id="exchange-seasonal-trending-heading"
            className="font-semibold text-noir-gold text-base"
          >
            {t("title", { season: seasonLabel })}
          </h2>
          <p className="mt-1 text-xs text-noir-gold-100">{t("description")}</p>
        </div>
      </div>
      <ol className="mt-4 space-y-2">
        {perfumes.map((perfume, index) => (
          <li key={perfume.perfumeId}>
            <TrendingRow rank={index + 1} perfume={perfume} />
          </li>
        ))}
      </ol>
    </section>
  )
}

export default SeasonalTrendingSection
