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

const seasonIcon = (key: SeasonKey, filled: boolean) => {
  const props = { filled, className: "w-11 h-11 sm:w-12 sm:h-12" }
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
}

/**
 * Season icon toggles + “All seasons” — same control as the perfume detail page
 * (without community ranking or API calls).
 */
export function SeasonSelectionToggleRow({
  selection,
  onChange,
  disabled = false,
}: SeasonSelectionToggleRowProps) {
  const t = useTranslations("singlePerfume.seasonVote")
  const allSelected = SEASON_KEYS.every((k) => selection[k])
  const [animatedKey, setAnimatedKey] = useState<string | null>(null)

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

  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
      {SEASON_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => {
            setAnimatedKey(key)
            toggleSeason(key)
          }}
          className={`
            group relative flex flex-col items-center gap-1 rounded-lg border p-2 transition-[transform,opacity,border-color,background-color,box-shadow] duration-300 ease-out
            ${disabled ? "cursor-default opacity-80" : "cursor-pointer motion-safe:hover:-translate-y-0.5 hover:opacity-95"}
            ${
              selection[key]
                ? "border-noir-gold-100 bg-noir-gold/10 shadow-[0_0_0_1px_rgba(255,247,204,0.22),0_14px_28px_rgba(212,175,55,0.16)] -translate-y-0.5"
                : "border-white/10 bg-noir-black/20 hover:border-noir-gold/30"
            }
            ${animatedKey === key ? "motion-safe:animate-vault-stamp" : ""}
          `}
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
          {seasonIcon(key, selection[key])}
          <span
            className={`text-xs transition-[color,transform] duration-300 ${
              selection[key]
                ? "text-noir-gold scale-[1.03]"
                : "text-noir-gold-500"
            }`}
          >
            {t(`season.${key}`)}
          </span>
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setAnimatedKey(ALL_SEASONS_KEY)
          toggleAll()
        }}
        className={`
          group relative flex min-w-[5.25rem] flex-col items-center gap-1 rounded-lg border p-2 transition-[transform,opacity,border-color,background-color,box-shadow] duration-300 ease-out
          ${disabled ? "cursor-default opacity-80" : "cursor-pointer motion-safe:hover:-translate-y-0.5 hover:opacity-95"}
          ${
            allSelected
              ? "border-noir-gold-100 bg-noir-gold/10 shadow-[0_0_0_1px_rgba(255,247,204,0.22),0_14px_28px_rgba(212,175,55,0.16)] -translate-y-0.5"
              : "border-white/10 bg-noir-black/20 hover:border-noir-gold/30"
          }
          ${animatedKey === ALL_SEASONS_KEY ? "motion-safe:animate-vault-stamp" : ""}
        `}
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
        <AllSeasonsIcon filled={allSelected} className="w-11 h-11 sm:w-12 sm:h-12" />
        <span
          className={`text-xs uppercase tracking-[0.18em] transition-[color,transform] duration-300 ${
            allSelected
              ? "text-noir-gold scale-[1.03]"
              : "text-noir-gold-500"
          }`}
        >
          {t("allSeasons")}
        </span>
      </button>
    </div>
  )
}
