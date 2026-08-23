"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button"
import Select from "@/components/Atoms/Select/Select"
import { apiFetch, getCsrfHeaders } from "@/lib/api-client"

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

  const updateStatus = async (id: string, status: string) => {
    try {
      setError(null)
      await apiFetch("/api/sampling-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({ intent: "update-status", id, status }),
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
      await apiFetch("/api/sampling-queue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCsrfHeaders(),
        },
        body: JSON.stringify({ intent: "remove", id }),
      })
      setItems(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : t("updateError"))
    }
  }

  if (loading) {
    return <p className="text-sm text-noir-gold-100">{t("loading")}</p>
  }

  if (items.length === 0) {
    return (
      <div className="rounded border border-noir-gold-500/30 bg-noir-dark/40 px-4 py-4 space-y-3">
        <p className="text-sm text-noir-gold-100">{t("empty")}</p>
        <Link href="/the-archive" className="text-noir-gold underline text-sm">
          {t("browseArchive")}
        </Link>
      </div>
    )
  }

  const statusSelectData = STATUS_OPTIONS.map(o => ({
    id: o.id,
    name: o.name,
    label: t(o.labelKey),
  }))

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
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
