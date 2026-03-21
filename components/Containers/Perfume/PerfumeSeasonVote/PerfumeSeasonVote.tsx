"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import type {
  PerfumeDetailSeasonAggregatesProp,
  PerfumeDetailUserSeasonVoteProp,
} from "@/components/Containers/Perfume/perfume-detail-types"
import { useSaveSeasonVote } from "@/lib/mutations/seasonVotes"
import {
  hasAnySeasonSelected,
  SEASON_KEYS,
  type SeasonKey,
  type SeasonSelection,
} from "@/types/perfume-season-vote"
import { useErrorHandler } from "@/hooks/useErrorHandler"

import {
  AllSeasonsIcon,
  FallSeasonIcon,
  SpringSeasonIcon,
  SummerSeasonIcon,
  WinterSeasonIcon,
} from "./SeasonVoteIcons"

const emptySelection = (): SeasonSelection => ({
  winter: false,
  spring: false,
  summer: false,
  fall: false,
})

type PerfumeSeasonVoteProps = {
  perfumeId: string
  userId?: string | null
  userSeasonVote: PerfumeDetailUserSeasonVoteProp
  seasonAggregates: PerfumeDetailSeasonAggregatesProp
}

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

const PerfumeSeasonVote = ({
  perfumeId,
  userId,
  userSeasonVote,
  seasonAggregates: initialAggregates,
}: PerfumeSeasonVoteProps) => {
  const t = useTranslations("singlePerfume.seasonVote")
  const { handleError } = useErrorHandler()
  const [aggregates, setAggregates] = useState(initialAggregates)
  const [selection, setSelection] = useState<SeasonSelection>(
    () => userSeasonVote ?? emptySelection()
  )
  const selectionRef = useRef(selection)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  const isLoggedIn = Boolean(userId) && userId !== "anonymous"
  const isInteractive = isLoggedIn

  useEffect(() => {
    setAggregates(initialAggregates)
  }, [initialAggregates])

  /** Primitives only — avoid resetting local selection when the parent passes a new object reference for the same server vote (e.g. after re-render). */
  const serverVoteFingerprint =
    userSeasonVote == null
      ? "none"
      : `${userSeasonVote.winter}-${userSeasonVote.spring}-${userSeasonVote.summer}-${userSeasonVote.fall}`

  useEffect(() => {
    setSelection(userSeasonVote ?? emptySelection())
    // Intentionally omit userSeasonVote: its reference can change every parent render while booleans stay the same.
  }, [perfumeId, serverVoteFingerprint])

  const refreshAggregates = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch(
        `/api/perfume-season-votes?${new URLSearchParams({ perfumeId })}`
      )
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error((errorPayload as { error?: string }).error ?? "Failed to refresh")
      }
      const data = (await response.json()) as {
        aggregates?: PerfumeDetailSeasonAggregatesProp
        userSelection?: SeasonSelection | null
      }
      if (data.aggregates) setAggregates(data.aggregates)
      if (Object.prototype.hasOwnProperty.call(data, "userSelection")) {
        setSelection(data.userSelection ?? emptySelection())
      }
    } catch (e) {
      console.error("Failed to refresh season votes", e)
    } finally {
      setIsRefreshing(false)
    }
  }, [perfumeId])

  const saveVote = useSaveSeasonVote()

  const allSelected = SEASON_KEYS.every(k => selection[k])

  const persist = useCallback(
    (next: SeasonSelection) => {
      if (!isInteractive || !userId || userId === "anonymous") return
      if (!hasAnySeasonSelected(next)) return

      const previous = selectionRef.current
      setSelection(next)

      saveVote.mutate(
        { perfumeId, ...next },
        {
          onSuccess: () => {
            void refreshAggregates()
          },
          onError: error => {
            setSelection(previous)
            handleError(error instanceof Error ? error : new Error(String(error)), {
              context: { perfumeId, userId },
            })
          },
        }
      )
    },
    [isInteractive, userId, perfumeId, saveVote, refreshAggregates, handleError]
  )

  const toggleSeason = (key: SeasonKey) => {
    if (!isInteractive) return
    const prev = selectionRef.current
    const next = { ...prev, [key]: !prev[key] }
    if (!hasAnySeasonSelected(next)) {
      setSelection(next)
      selectionRef.current = next
      return
    }
    persist(next)
  }

  const toggleAll = () => {
    if (!isInteractive) return
    if (allSelected) {
      setSelection(emptySelection())
      return
    }
    persist({
      winter: true,
      spring: true,
      summer: true,
      fall: true,
    })
  }

  return (
    <div className="bg-noir-dark/20 rounded-lg p-6 mt-4">
      <h2 className="text-xl font-bold text-noir-gold mb-1 text-center">
        {isInteractive ? t("titleVote") : t("titleCommunity")}
      </h2>

      {!isLoggedIn && (
        <p className="text-sm text-noir-gold-500 mb-4 text-center">{t("loginToVote")}</p>
      )}

      <p className="text-xs text-noir-gold-100/90 text-center mb-4">{t("subtitle")}</p>

      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-6">
        {SEASON_KEYS.map(key => (
          <button
            key={key}
            type="button"
            disabled={!isInteractive || saveVote.isPending}
            onClick={() => toggleSeason(key)}
            className={`
              flex flex-col items-center gap-1 rounded-lg p-2 transition-opacity
              ${isInteractive ? "hover:opacity-90 cursor-pointer" : "opacity-80 cursor-default"}
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
          disabled={!isInteractive || saveVote.isPending}
          onClick={toggleAll}
          className={`
            flex flex-col items-center gap-1 rounded-lg p-2 transition-opacity
            ${isInteractive ? "hover:opacity-90 cursor-pointer" : "opacity-80 cursor-default"}
            ${allSelected ? "ring-2 ring-noir-gold/70" : "ring-1 ring-white/10"}
          `}
          aria-pressed={allSelected}
          aria-label={t("allSeasons")}
        >
          <AllSeasonsIcon filled={allSelected} className="w-11 h-11 sm:w-12 sm:h-12" />
          <span className="text-xs text-noir-gold-500">{t("allSeasons")}</span>
        </button>
      </div>

      <div className="border-t border-white/10 pt-4">
        <h3 className="text-sm font-medium text-noir-gold mb-2 text-center">{t("rankingTitle")}</h3>
        {aggregates.totalVoters === 0 ? (
          <p className="text-xs text-noir-gold-100 text-center">{t("noVotesYet")}</p>
        ) : (
          <ol className="space-y-1.5 text-sm text-noir-gold-100">
            {aggregates.ranked.map((row, index) => (
              <li key={row.season} className="flex justify-between gap-2 px-1">
                <span>
                  {index + 1}. {t(`season.${row.season}`)}
                </span>
                <span className="text-noir-gold-500 shrink-0">
                  {row.count}
                  {row.percent != null ? ` (${row.percent}%)` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
        {aggregates.totalVoters > 0 && (
          <p className="text-xs text-noir-gold-500 mt-2 text-center">
            {t("totalVoters", { count: aggregates.totalVoters })}
            {isRefreshing ? " …" : ""}
          </p>
        )}
      </div>
    </div>
  )
}

export default PerfumeSeasonVote
