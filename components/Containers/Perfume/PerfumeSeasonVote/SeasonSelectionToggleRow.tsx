"use client"

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
          onClick={() => toggleSeason(key)}
          className={`
            flex flex-col items-center gap-1 rounded-lg p-2 transition-opacity
            ${disabled ? "cursor-default opacity-80" : "cursor-pointer hover:opacity-90"}
            ${selection[key] ? "ring-2 ring-noir-gold/70" : "ring-1 ring-white/10"}
          `}
          aria-pressed={selection[key]}
          aria-label={t(`season.${key}`)}
        >
          {seasonIcon(key, selection[key])}
          <span className="text-xs text-noir-gold-500">{t(`season.${key}`)}</span>
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={toggleAll}
        className={`
          flex flex-col items-center gap-1 rounded-lg p-2 transition-opacity
          ${disabled ? "cursor-default opacity-80" : "cursor-pointer hover:opacity-90"}
          ${allSelected ? "ring-2 ring-noir-gold/70" : "ring-1 ring-white/10"}
        `}
        aria-pressed={allSelected}
        aria-label={t("allSeasons")}
      >
        <AllSeasonsIcon filled={allSelected} className="w-11 h-11 sm:w-12 sm:h-12" />
        <span className="text-xs text-noir-gold-500">{t("allSeasons")}</span>
      </button>
    </div>
  )
}
