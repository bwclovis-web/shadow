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
  variant?: "sidebar" | "compact"
  className?: string
}

const TrendingRow = ({
  rank,
  perfume,
  compact,
}: {
  rank: number
  perfume: SeasonalTrendingPerfumeRow
  compact: boolean
}) => {
  const t = useTranslations("tradingPost.seasonalTrending")
  const imageSrc = normalizeRemoteImageSrc(perfume.image)

  return (
    <PrefetchLink
      href={`/perfume/${perfume.slug}`}
      className={`flex min-w-0 gap-3 rounded-md border border-noir-light/30 bg-noir-dark/50 p-2 transition-colors hover:border-noir-gold/50 hover:bg-noir-dark/80 ${
        compact ? "shrink-0 snap-start" : ""
      }`}
      aria-label={t("viewPerfume", { name: perfume.name })}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-noir-gold/40 bg-noir-black/60 text-sm font-bold text-noir-gold tabular-nums"
        aria-hidden
      >
        {rank}
      </span>
      <span
        className={`relative shrink-0 overflow-hidden rounded-md border border-noir-gold/30 bg-noir-black/40 ${
          compact ? "h-12 w-12" : "h-14 w-14"
        }`}
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-cover"
            sizes={compact ? "48px" : "56px"}
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

  return (
    <section
      className={className}
      aria-labelledby={
        isCompact
          ? "home-seasonal-trending-heading"
          : "exchange-seasonal-trending-heading"
      }
    >
      <div className="flex items-start gap-3">
        <FaLeaf
          className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold"
          aria-hidden
        />
        <div>
          <h2
            id={
              isCompact
                ? "home-seasonal-trending-heading"
                : "exchange-seasonal-trending-heading"
            }
            className={`font-semibold text-noir-gold ${isCompact ? "text-lg" : "text-base"}`}
          >
            {t("title", { season: seasonLabel })}
          </h2>
          {!isCompact ? (
            <p className="mt-1 text-xs text-noir-gold-100">{t("description")}</p>
          ) : null}
        </div>
      </div>

      {isCompact ? (
        <ul className="mt-4 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
          {perfumes.map((perfume, index) => (
            <li
              key={perfume.perfumeId}
              className="min-w-[min(100%,280px)] max-w-[280px]"
            >
              <TrendingRow rank={index + 1} perfume={perfume} compact />
            </li>
          ))}
        </ul>
      ) : (
        <ol className="mt-4 space-y-2">
          {perfumes.map((perfume, index) => (
            <li key={perfume.perfumeId}>
              <TrendingRow rank={index + 1} perfume={perfume} compact={false} />
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export default SeasonalTrendingSection
