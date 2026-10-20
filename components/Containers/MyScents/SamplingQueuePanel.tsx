"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import Select from "@/components/Atoms/Select/Select"
import SearchBar from "@/components/Organisms/SearchBar"
import { apiFetch, getCSRFFromCookie, getCsrfHeaders } from "@/lib/api-client"
import { postAddToSamplingQueue } from "@/lib/sampling-queue-client"
import { THE_ARCHIVE_PATH } from "@/constants/routes"

type SamplingQueueItemRow = {
  id: string
  status: "queued" | "sampling" | "completed" | "skipped"
  perfume: {
    id: string
    name: string
    slug: string
    perfumeHouse?: { name: string | null } | null
  }
}

type SamplingQueuePanelProps = {
  /** Prefill from server (digest); otherwise fetch on mount. */
  initialItems?: Array<{
    id: string
    status: string
    perfumeName: string
    perfumeSlug: string
    houseName?: string | null
  }>
  compact?: boolean
}

const STATUS_OPTIONS = [
  { id: "queued", name: "queued", labelKey: "statusQueued" as const },
  { id: "sampling", name: "sampling", labelKey: "statusSampling" as const },
  { id: "completed", name: "completed", labelKey: "statusCompleted" as const },
  { id: "skipped", name: "skipped", labelKey: "statusSkipped" as const },
]

export const SamplingQueuePanel = ({
  initialItems,
  compact = false,
}: SamplingQueuePanelProps) => {
  const t = useTranslations("samplingQueue")
  const [items, setItems] = useState<SamplingQueueItemRow[]>(() =>
    (initialItems ?? []).map(row => ({
      id: row.id,
      status: row.status as SamplingQueueItemRow["status"],
      perfume: {
        id: row.id,
        name: row.perfumeName,
        slug: row.perfumeSlug,
        perfumeHouse: row.houseName ? { name: row.houseName } : null,
      },
    }))
  )
  const [loading, setLoading] = useState(!initialItems)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const res = await apiFetch<{ success: boolean; items: SamplingQueueItemRow[] }>(
        "/api/sampling-queue"
      )
      setItems(res.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!initialItems) {
      void refresh()
    }
  }, [initialItems, refresh])

  const addPerfume = async (perfumeId: string) => {
    if (!perfumeId || adding) return
    setAdding(true)
    setError(null)
    setNotice(null)
    try {
      await postAddToSamplingQueue(perfumeId)
      setNotice(t("addedToast"))
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("addError"))
    } finally {
      setAdding(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      setError(null)
      const csrf = getCSRFFromCookie()
      await apiFetch("/api/sampling-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          intent: "update-status",
          id,
          status,
          ...(csrf ? { _csrf: csrf } : {}),
        }),
      })
      setItems(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, status: status as SamplingQueueItemRow["status"] }
            : item
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updateError"))
    }
  }

  const removeItem = async (id: string) => {
    try {
      setError(null)
      const csrf = getCSRFFromCookie()
      await apiFetch("/api/sampling-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({
          intent: "remove",
          id,
          ...(csrf ? { _csrf: csrf } : {}),
        }),
      })
      setItems(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updateError"))
    }
  }

  const statusSelectData = STATUS_OPTIONS.map(o => ({
    id: o.id,
    name: o.name,
    label: t(o.labelKey),
  }))

  const addSearch = (
    <div className="w-full min-w-0 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-noir-gold-100">
        {t("addSearchLabel")}
      </p>
      <SearchBar
        variant="default"
        size="standard"
        searchType="perfume"
        inputId="try-next-add-search"
        placeholder={t("addSearchPlaceholder")}
        className="w-full"
        clearInputOnSelect
        disabled={adding}
        action={item => void addPerfume(item.id)}
      />
    </div>
  )

  if (loading) {
    return <p className="text-sm text-noir-gold-100">{t("loading")}</p>
  }

  if (items.length === 0) {
    return (
      <div className="space-y-3 rounded border border-noir-gold-500/30 bg-noir-dark/40 px-4 py-4">
        <p className="text-sm text-noir-gold-100">{t("empty")}</p>
        {addSearch}
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {notice ? <p className="text-sm text-noir-gold">{notice}</p> : null}
        <Link href={THE_ARCHIVE_PATH} className="text-sm text-noir-gold underline">
          {t("browseArchive")}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {addSearch}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {notice ? <p className="text-sm text-noir-gold">{notice}</p> : null}
      <ul className={`space-y-3 ${compact ? "" : ""}`}>
        {items.map(item => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded border border-noir-gold-500/30 bg-noir-dark/40 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/perfume/${item.perfume.slug}`}
                className="font-medium text-noir-gold hover:underline"
              >
                {item.perfume.name}
              </Link>
              {item.perfume.perfumeHouse?.name ? (
                <p className="text-xs text-noir-gold-500/80">
                  {item.perfume.perfumeHouse.name}
                </p>
              ) : null}
            </div>
            <Select
              selectId={`sampling-status-${item.id}`}
              label={t("statusLabel")}
              selectData={statusSelectData}
              value={item.status}
              action={e => void updateStatus(item.id, e.target.value)}
              className="w-40 max-w-none"
            />
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => void removeItem(item.id)}
            >
              {t("remove")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
