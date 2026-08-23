"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { Button } from "@/components/Atoms/Button/Button"
import { useCSRF } from "@/hooks/useCSRF"
import type { SavedSearchQuery } from "@/models/saved-search.server"

type SaveSearchButtonProps = {
  name: string
  query: SavedSearchQuery
  className?: string
}

export const SaveSearchButton = ({
  name,
  query,
  className,
}: SaveSearchButtonProps) => {
  const t = useTranslations("savedSearches")
  const { addToHeaders } = useCSRF()
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "upgrade" | "error">(
    "idle"
  )
  const [error, setError] = useState<string | null>(null)

  const onSave = useCallback(async () => {
    setStatus("saving")
    setError(null)
    try {
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          ...addToHeaders({ "content-type": "application/json" }),
        },
        body: JSON.stringify({ name, query, alertEnabled: true }),
      })
      if (res.status === 403) {
        setStatus("upgrade")
        return
      }
      if (res.status === 401) {
        setStatus("error")
        setError(t("signInRequired"))
        return
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setStatus("error")
        setError(data.error ?? t("saveFailed"))
        return
      }
      setStatus("saved")
    } catch {
      setStatus("error")
      setError(t("saveFailed"))
    }
  }, [addToHeaders, name, query, t])

  if (status === "upgrade") {
    return (
      <div className={className}>
        <p className="text-sm text-noir-gold-100 mb-2">{t("premiumRequired")}</p>
        <Link
          href="/membership"
          className="text-sm text-noir-gold underline hover:text-noir-light"
        >
          {t("upgradeCta")}
        </Link>
      </div>
    )
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="icon"
        background="gold"
        size="sm"
        disabled={status === "saving" || status === "saved"}
        onClick={() => void onSave()}
      >
        {status === "saved" ? t("saved") : status === "saving" ? t("saving") : t("saveButton")}
      </Button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default SaveSearchButton
