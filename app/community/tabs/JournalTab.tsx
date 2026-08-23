"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { apiFetch } from "@/lib/api-client"

import { loadCollectionPerfumeOptions, postCommunity } from "./community-api"
import type { JournalEntry, PerfumeOption } from "./types"

type JournalTabProps = {
  onMessage: (message: string | null) => void
  onError: (error: string | null) => void
}

export const JournalTab = ({ onMessage, onError }: JournalTabProps) => {
  const t = useTranslations("community")
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [perfumeOptions, setPerfumeOptions] = useState<PerfumeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [journalPerfumeId, setJournalPerfumeId] = useState("")
  const [journalNotes, setJournalNotes] = useState("")
  const [journalRating, setJournalRating] = useState("")

  const loadJournal = useCallback(async () => {
    setLoading(true)
    onError(null)
    try {
      const data = await apiFetch<{ entries: JournalEntry[] }>(
        "/api/community?kind=journal"
      )
      setEntries(data.entries ?? [])
    } catch (e) {
      onError(e instanceof Error ? e.message : t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [onError, t])

  useEffect(() => {
    void loadJournal()
  }, [loadJournal])

  useEffect(() => {
    void loadCollectionPerfumeOptions()
      .then(opts => {
        setPerfumeOptions(opts)
        if (opts[0]) setJournalPerfumeId(prev => prev || opts[0]!.perfumeId)
      })
      .catch(() => {
        /* collection optional */
      })
  }, [])

  const addJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    onMessage(null)
    onError(null)
    try {
      await postCommunity({
        intent: "wear-journal",
        perfumeId: journalPerfumeId,
        notes: journalNotes || null,
        rating: journalRating ? Number(journalRating) : null,
        wornOn: new Date().toISOString(),
      })
      setJournalNotes("")
      setJournalRating("")
      onMessage(t("journalSaved"))
      await loadJournal()
    } catch (err) {
      onError(err instanceof Error ? err.message : t("saveError"))
    }
  }

  if (loading) {
    return <p className="text-sm opacity-70">{t("loading")}</p>
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-4">
        <h2 className="text-lg text-noir-gold-500">{t("logWearTitle")}</h2>
        {perfumeOptions.length === 0 ? (
          <p className="text-sm opacity-70">
            {t("needCollection")}{" "}
            <PrefetchLink href="/the-archive" className="underline">
              {t("browseArchive")}
            </PrefetchLink>
          </p>
        ) : (
          <form onSubmit={addJournalEntry} className="space-y-3">
            <label className="block text-sm">
              <span className="opacity-80">{t("perfume")}</span>
              <select
                value={journalPerfumeId}
                onChange={e => setJournalPerfumeId(e.target.value)}
                className="mt-1 w-full bg-black/30 border border-noir-gold/30 rounded px-3 py-2"
              >
                {perfumeOptions.map(p => (
                  <option key={p.perfumeId} value={p.perfumeId}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="opacity-80">{t("rating")}</span>
              <input
                type="number"
                min={1}
                max={5}
                value={journalRating}
                onChange={e => setJournalRating(e.target.value)}
                className="mt-1 w-full bg-black/30 border border-noir-gold/30 rounded px-3 py-2"
                placeholder="1–5"
              />
            </label>
            <label className="block text-sm">
              <span className="opacity-80">{t("notes")}</span>
              <textarea
                value={journalNotes}
                onChange={e => setJournalNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full bg-black/30 border border-noir-gold/30 rounded px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="text-sm uppercase tracking-wide border border-noir-gold/40 px-3 py-2 rounded hover:bg-white/5"
            >
              {t("saveWear")}
            </button>
          </form>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg text-noir-gold-500">{t("wearHistory")}</h2>
        {entries.length === 0 ? (
          <p className="text-sm opacity-70">{t("noJournal")}</p>
        ) : (
          <ul className="space-y-3">
            {entries.map(entry => (
              <li key={entry.id} className="noir-border rounded-lg p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <PrefetchLink
                    href={`/perfume/${entry.perfume.slug}`}
                    className="text-noir-gold-500 hover:underline"
                  >
                    {entry.perfume.name}
                  </PrefetchLink>
                  <span className="opacity-60 text-xs">{entry.wornOn.slice(0, 10)}</span>
                </div>
                {entry.rating != null && (
                  <p className="opacity-80 mt-1">{t("rated", { rating: entry.rating })}</p>
                )}
                {entry.notes && <p className="opacity-70 mt-1">{entry.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
