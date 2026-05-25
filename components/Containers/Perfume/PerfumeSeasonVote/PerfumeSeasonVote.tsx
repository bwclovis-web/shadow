"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"

import type {
  PerfumeDetailSeasonAggregatesProp,
  PerfumeDetailUserSeasonVoteProp,
} from "@/components/Containers/Perfume/perfume-detail-types"
import { useSaveSeasonVote } from "@/lib/mutations/seasonVotes"
import { type SeasonSelection, emptySeasonSelection } from "@/types/perfume-season-vote"
import { useErrorHandler } from "@/hooks/useErrorHandler"

import { SeasonSelectionToggleRow } from "./SeasonSelectionToggleRow"

type PerfumeSeasonVoteProps = {
  perfumeId: string
  userId?: string | null
  userSeasonVote: PerfumeDetailUserSeasonVoteProp
  seasonAggregates: PerfumeDetailSeasonAggregatesProp
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
    () => userSeasonVote ?? emptySeasonSelection()
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

  const serverWinter = userSeasonVote?.winter ?? false
  const serverSpring = userSeasonVote?.spring ?? false
  const serverSummer = userSeasonVote?.summer ?? false
  const serverFall = userSeasonVote?.fall ?? false

  useEffect(() => {
    setSelection({
      winter: serverWinter,
      spring: serverSpring,
      summer: serverSummer,
      fall: serverFall,
    })
  }, [perfumeId, serverWinter, serverSpring, serverSummer, serverFall])

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
        setSelection(data.userSelection ?? emptySeasonSelection())
      }
    } catch (e) {
      console.error("Failed to refresh season votes", e)
    } finally {
      setIsRefreshing(false)
    }
  }, [perfumeId])

  const saveVote = useSaveSeasonVote()

  const persist = useCallback(
    (next: SeasonSelection) => {
      if (!isInteractive || !userId || userId === "anonymous") return

      const previous = selectionRef.current
      selectionRef.current = next
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

  return (
    <div className="space-y-2">
      <h3>
        {isInteractive ? t("titleVote") : t("titleCommunity")}
      </h3>

      {!isLoggedIn && (
        <p className="text-sm text-noir-gold-500 mb-4">{t("loginToVote")}</p>
      )}

      <p className="text-xs text-noir-gold-100/90 mb-4">{t("subtitle")}</p>

      <div
        className={`mb-6 rounded-lg border px-3 py-4 transition-[border-color,background-color,box-shadow] duration-300 ${
          Object.values(selection).some(Boolean)
            ? "border-noir-gold/40 bg-noir-gold/6 shadow-[0_10px_24px_rgba(212,175,55,0.08)]"
            : "border-noir-gold/15 bg-noir-black/15"
        }`}
      >
        <SeasonSelectionToggleRow
          selection={selection}
          disabled={!isInteractive || saveVote.isPending}
          onChange={(next) => {
            if (!isInteractive) return
            persist(next)
          }}
        />
      </div>

      <div className="border-t border-noir-gold/20 pt-4">
        <h3 className="mb-2">{t("rankingTitle")}</h3>
        {aggregates.totalVoters === 0 ? (
          <p className="text-xs text-noir-gold-100">{t("noVotesYet")}</p>
        ) : (
          <ol className="space-y-1.5 text-sm text-noir-gold-100">
            {aggregates.ranked.map((row, index) => (
              <li
                key={row.season}
                className="flex justify-between gap-2 rounded px-2 py-1 transition-colors duration-300 hover:bg-noir-gold/6"
              >
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
          <p className="text-xs text-noir-gold-500 mt-2">
            {t("totalVoters", { count: aggregates.totalVoters })}
            {isRefreshing ? " …" : ""}
          </p>
        )}
      </div>
    </div>
  )
}

export default PerfumeSeasonVote
