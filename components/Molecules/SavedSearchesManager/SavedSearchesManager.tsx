"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { useCSRF } from "@/hooks/useCSRF"

type SavedSearchRow = {
  id: string
  name: string
  alertEnabled: boolean
  lastMatchedAt: string | null
  snoozedUntil: string | null
}

const isSnoozed = (snoozedUntil: string | null) => {
  if (!snoozedUntil) return false
  return new Date(snoozedUntil).getTime() > Date.now()
}

export const SavedSearchesManager = () => {
  const t = useTranslations("savedSearches")
  const { addToHeaders } = useCSRF()
  const [searches, setSearches] = useState<SavedSearchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/saved-searches", {
        credentials: "include",
        cache: "no-store",
      })
      if (res.status === 403) {
        setUpgradeRequired(true)
        setSearches([])
        return
      }
      if (!res.ok) {
        setError(t("loadFailed"))
        return
      }
      const data = (await res.json()) as { searches?: SavedSearchRow[] }
      setSearches(data.searches ?? [])
      setUpgradeRequired(false)
    } catch {
      setError(t("loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mutate = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/saved-searches", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...addToHeaders({ "content-type": "application/json" }),
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      setError(data.error ?? t("saveFailed"))
      return
    }
    await refresh()
  }

  if (loading) {
    return <p className="text-sm text-noir-gold-100">{t("loading")}</p>
  }

  if (upgradeRequired) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-noir-gold-100">{t("premiumRequired")}</p>
        <Link href="/membership" className="text-sm text-noir-gold underline">
          {t("upgradeCta")}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg text-noir-gold">{t("manageTitle")}</h3>
        <p className="mt-1 text-sm text-noir-gold-100">{t("inboxHint")}</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {searches.length === 0 ? (
        <p className="text-sm text-noir-gold-100">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {searches.map(s => {
            const snoozed = isSnoozed(s.snoozedUntil)
            return (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded border border-noir-gold-500/30 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-noir-gold">{s.name}</p>
                  <p className="text-xs text-noir-gold-100">
                    {snoozed
                      ? t("snoozedUntil", {
                          date: new Date(s.snoozedUntil!).toLocaleDateString(),
                        })
                      : s.alertEnabled
                        ? t("alertsOn")
                        : t("alertsOff")}
                    {!snoozed && s.lastMatchedAt
                      ? ` · ${t("lastMatch", {
                          date: new Date(s.lastMatchedAt).toLocaleDateString(),
                        })}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="icon"
                    background="gold"
                    size="sm"
                    onClick={() =>
                      void mutate({
                        intent: "toggle-alert",
                        id: s.id,
                        alertEnabled: !s.alertEnabled,
                      })
                    }
                  >
                    {s.alertEnabled ? t("mute") : t("unmute")}
                  </Button>
                  <Button
                    type="button"
                    variant="icon"
                    background="gold"
                    size="sm"
                    onClick={() =>
                      void mutate({
                        intent: snoozed ? "unsnooze" : "snooze",
                        id: s.id,
                      })
                    }
                  >
                    {snoozed ? t("unsnooze") : t("snooze")}
                  </Button>
                  <Button
                    type="button"
                    variant="icon"
                    background="gold"
                    size="sm"
                    onClick={() => void mutate({ intent: "delete", id: s.id })}
                  >
                    {t("delete")}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default SavedSearchesManager
