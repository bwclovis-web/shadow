"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import {
  SEASON_KEYS,
  type SeasonKey,
  type SeasonSelection,
  emptySeasonSelection,
} from "@/types/perfume-season-vote"

import {
  AllSeasonsIcon,
  FallSeasonIcon,
  SpringSeasonIcon,
  SummerSeasonIcon,
  WinterSeasonIcon,
} from "./SeasonVoteIcons"

const seasonIcon = (key: SeasonKey, filled: boolean, className: string) => {
  const props = { filled, className }
  switch (key) {
    case "winter":
      return <WinterSeasonIcon {...props} />
    case "spring":
      return <SpringSeasonIcon {...props} />
    case "summer":
      return <SummerSeasonIcon {...props} />
    case "fall":
      return <FallSeasonIcon {...props} />
    default:
      return null
  }
}

const ALL_SEASONS_KEY = "__all_seasons__"
const SEASON_TOGGLE_ANIMATION_MS = 560

export type SeasonSelectionToggleRowProps = {
  selection: SeasonSelection
  onChange: (next: SeasonSelection) => void
  disabled?: boolean
  /**
   * Opt-in filter-drawer variant: smaller SVGs, 2×2 → 4-up grid,
   * compact All seasons control. Detail page keeps defaults.
   */
  compact?: boolean
  /** When false, hides All seasons (rare). Default true. */
  showAllSeasons?: boolean
}

/**
 * Season icon toggles + “All seasons” — same control as the perfume detail page
 * (without community ranking or API calls).
 */
export function SeasonSelectionToggleRow({
  selection,
  onChange,
  disabled = false,
  compact = false,
  showAllSeasons = true,
}: SeasonSelectionToggleRowProps) {
  const t = useTranslations("singlePerfume.seasonVote")
  const allSelected = SEASON_KEYS.every(k => selection[k])
  const [animatedKey, setAnimatedKey] = useState<string | null>(null)
  const iconClass = compact ? "h-6 w-6" : "h-11 w-11 sm:h-12 sm:w-12"

  useEffect(() => {
    if (!animatedKey) return

    const timeoutId = window.setTimeout(() => {
      setAnimatedKey(current => (current === animatedKey ? null : current))
    }, SEASON_TOGGLE_ANIMATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [animatedKey])

  const toggleSeason = (key: SeasonKey) => {
    onChange({ ...selection, [key]: !selection[key] })
  }

  const toggleAll = () => {
    if (allSelected) onChange(emptySeasonSelection())
    else
      onChange({
        winter: true,
        spring: true,
        summer: true,
        fall: true,
      })
  }

  const seasonTileClass = (active: boolean, key: string) => `
    group relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-sm border
    transition-[transform,opacity,border-color,background-color,box-shadow] duration-300 ease-out
    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold
    ${compact ? "px-1.5 py-2" : "rounded-lg p-2"}
    ${disabled ? "cursor-default opacity-80" : "cursor-pointer motion-safe:hover:-translate-y-0.5 hover:opacity-95"}
    ${
      active
        ? "border-noir-gold bg-noir-gold/10 -translate-y-0.5 shadow-[0_0_0_1px_rgba(255,247,204,0.22),0_14px_28px_rgba(212,175,55,0.16)]"
        : "border-noir-gold/40 bg-noir-black/40 hover:border-noir-gold/70"
    }
    ${animatedKey === key ? "motion-safe:animate-vault-stamp" : ""}
  `

  return (
    <div
      className={
        compact
          ? "grid grid-cols-2 gap-2 sm:grid-cols-4"
          : "flex flex-wrap justify-center gap-3 sm:gap-4"
      }
    >
      {SEASON_KEYS.map(key => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => {
            setAnimatedKey(key)
            toggleSeason(key)
          }}
          className={seasonTileClass(selection[key], key)}
          aria-pressed={selection[key]}
          aria-label={t(`season.${key}`)}
        >
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-[3px] rounded-[inherit] border transition-opacity duration-300 ${
              selection[key]
                ? "border-noir-black/25 opacity-100"
                : "border-noir-gold/15 opacity-0 group-hover:opacity-100"
            }`}
          />
          {seasonIcon(key, selection[key], iconClass)}
          <span
            className={`text-xs capitalize transition-[color,transform] duration-300 ${
              selection[key]
                ? "scale-[1.03] text-noir-gold"
                : "text-noir-gold-100"
            }`}
          >
            {t(`season.${key}`)}
          </span>
        </button>
      ))}

      {showAllSeasons ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setAnimatedKey(ALL_SEASONS_KEY)
            toggleAll()
          }}
          className={
            compact
              ? `${seasonTileClass(allSelected, ALL_SEASONS_KEY)} col-span-2 sm:col-span-4 flex-row gap-2 py-2.5`
              : `
            group relative flex min-w-[5.25rem] flex-col items-center gap-1 rounded-lg border p-2 transition-[transform,opacity,border-color,background-color,box-shadow] duration-300 ease-out
            focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold
            ${disabled ? "cursor-default opacity-80" : "cursor-pointer motion-safe:hover:-translate-y-0.5 hover:opacity-95"}
            ${
              allSelected
                ? "border-noir-gold-100 bg-noir-gold/10 -translate-y-0.5 shadow-[0_0_0_1px_rgba(255,247,204,0.22),0_14px_28px_rgba(212,175,55,0.16)]"
                : "border-white/10 bg-noir-black/20 hover:border-noir-gold/30"
            }
            ${animatedKey === ALL_SEASONS_KEY ? "motion-safe:animate-vault-stamp" : ""}
          `
          }
          aria-pressed={allSelected}
          aria-label={t("allSeasons")}
        >
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-[3px] rounded-[inherit] border transition-opacity duration-300 ${
              allSelected
                ? "border-noir-black/25 opacity-100"
                : "border-noir-gold/15 opacity-0 group-hover:opacity-100"
            }`}
          />
          <AllSeasonsIcon
            filled={allSelected}
            className={compact ? "h-6 w-6" : "h-11 w-11 sm:h-12 sm:w-12"}
          />
          <span
            className={`text-xs transition-[color,transform] duration-300 ${
              compact
                ? allSelected
                  ? "capitalize text-noir-gold"
                  : "capitalize text-noir-gold-100"
                : allSelected
                  ? "scale-[1.03] uppercase tracking-[0.18em] text-noir-gold"
                  : "uppercase tracking-[0.18em] text-noir-gold-500"
            }`}
          >
            {t("allSeasons")}
          </span>
        </button>
      ) : null}
    </div>
  )
}
