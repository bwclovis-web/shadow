"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { apiFetch } from "@/lib/api-client"

import { loadCollectionPerfumeOptions, postCommunity } from "./community-api"
import type { Challenge, PerfumeOption } from "./types"

type ChallengesTabProps = {
  onError: (error: string | null) => void
  onMessage?: (message: string | null) => void
  signedIn?: boolean
}

export const ChallengesTab = ({
  onError,
  onMessage,
  signedIn = false,
}: ChallengesTabProps) => {
  const t = useTranslations("community")
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading, setLoading] = useState(true)
  const [perfumeOptions, setPerfumeOptions] = useState<PerfumeOption[]>([])
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [perfumeId, setPerfumeId] = useState("")
  const [caption, setCaption] = useState("")

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

  useEffect(() => {
    if (!signedIn) return
    void loadCollectionPerfumeOptions()
      .then(opts => {
        setPerfumeOptions(opts)
        if (opts[0]) setPerfumeId(prev => prev || opts[0]!.perfumeId)
      })
      .catch(() => {
        /* optional */
      })
  }, [signedIn])

  const join = async (challengeId: string) => {
    onError(null)
    onMessage?.(null)
    try {
      await postCommunity({
        intent: "join-challenge",
        challengeId,
        perfumeId: perfumeId || null,
        caption: caption || null,
      })
      onMessage?.(t("challengeJoined"))
      setJoiningId(null)
      setCaption("")
      await loadChallenges()
    } catch (e) {
      onError(e instanceof Error ? e.message : t("saveError"))
    }
  }

  const buildTray = async (challenge: Challenge) => {
    onError(null)
    onMessage?.(null)
    try {
      await postCommunity({
        intent: "create-shelf",
        name: challenge.title.slice(0, 80),
        description: `Challenge tray: ${challenge.title}`,
        isPublic: true,
        challengeId: challenge.id,
      })
      onMessage?.(t("shelfCreated"))
    } catch (e) {
      onError(e instanceof Error ? e.message : t("saveError"))
    }
  }

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
            <li key={c.id} className="noir-border rounded-lg p-4 space-y-2">
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
              <div className="flex flex-wrap gap-2 pt-1">
                {c.slug && (
                  <Link
                    href={`/community/challenges/${c.slug}`}
                    className="text-xs underline text-noir-gold-500"
                  >
                    {t("viewChallenge")}
                  </Link>
                )}
                {signedIn && (
                  <>
                    <button
                      type="button"
                      className="text-xs underline text-noir-gold-500"
                      onClick={() => setJoiningId(joiningId === c.id ? null : c.id)}
                    >
                      {t("joinChallenge")}
                    </button>
                    <button
                      type="button"
                      className="text-xs underline text-noir-gold-500"
                      onClick={() => void buildTray(c)}
                    >
                      {t("buildChallengeTray")}
                    </button>
                  </>
                )}
              </div>
              {joiningId === c.id && (
                <form
                  className="space-y-2 border-t border-noir-gold/20 pt-3"
                  onSubmit={e => {
                    e.preventDefault()
                    void join(c.id)
                  }}
                >
                  {perfumeOptions.length > 0 && (
                    <label className="block text-sm">
                      <span className="opacity-80">{t("perfume")}</span>
                      <select
                        value={perfumeId}
                        onChange={e => setPerfumeId(e.target.value)}
                        className="mt-1 w-full bg-black/30 border border-noir-gold/30 rounded px-3 py-2"
                      >
                        {perfumeOptions.map(p => (
                          <option key={p.perfumeId} value={p.perfumeId}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="block text-sm">
                    <span className="opacity-80">{t("challengeCaption")}</span>
                    <input
                      value={caption}
                      onChange={e => setCaption(e.target.value)}
                      className="mt-1 w-full bg-black/30 border border-noir-gold/30 rounded px-3 py-2"
                    />
                  </label>
                  <button
                    type="submit"
                    className="text-sm border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5"
                  >
                    {t("joinChallenge")}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
