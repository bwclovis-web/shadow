"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { apiFetch } from "@/lib/api-client"

import type { Challenge } from "./types"

type ChallengesTabProps = {
  onError: (error: string | null) => void
}

export const ChallengesTab = ({ onError }: ChallengesTabProps) => {
  const t = useTranslations("community")
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)

  const loadChallenges = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const data = await apiFetch<{ challenges: Challenge[] }>(
        "/api/community?kind=challenges"
      )
      setChallenges(data.challenges ?? [])
    } catch (e) {
      onError(e instanceof Error ? e.message : t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [onError, t])

  useEffect(() => {
    void loadChallenges()
  }, [loadChallenges])

  if (loading) {
    return <p className="text-sm opacity-70">{t("loading")}</p>
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg text-noir-gold-500">{t("liveChallenges")}</h2>
        <Link
          href="/community/challenges"
          className="text-xs uppercase tracking-wide underline text-noir-gold-500"
        >
          {t("fullChallengesPage")}
        </Link>
      </div>
      {challenges.length === 0 ? (
        <p className="text-sm opacity-70">{t("noChallenges")}</p>
      ) : (
        <ul className="space-y-3">
          {challenges.map(c => (
            <li key={c.id} className="noir-border rounded-lg p-4">
              <h3 className="text-noir-gold-500">{c.title}</h3>
              {c.description && (
                <p className="text-sm opacity-80 mt-1">{c.description}</p>
              )}
              <p className="text-xs opacity-60 mt-2">
                {t("challengeMeta", {
                  count: c._count.entries,
                  ends: c.endsAt.slice(0, 10),
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
