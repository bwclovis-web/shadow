"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

import type { DecantSplitForClient } from "@/types/decant-split"
import { isDecantSplitsEnabledClient } from "@/utils/decant-splits-enabled"

const DecantSplitsPanel = () => {
  const t = useTranslations("decantSplits.dashboard")
  const [hosted, setHosted] = useState<DecantSplitForClient[]>([])
  const [participating, setParticipating] = useState<DecantSplitForClient[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isDecantSplitsEnabledClient()) {
      setLoaded(true)
      return
    }
    void fetch("/api/decant-splits/mine", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setHosted(data.hosted ?? [])
          setParticipating(data.participating ?? [])
        }
      })
      .finally(() => setLoaded(true))
  }, [])

  if (!isDecantSplitsEnabledClient() || !loaded) return null
  if (hosted.length === 0 && participating.length === 0) return null

  const renderList = (items: DecantSplitForClient[], heading: string) =>
    items.length > 0 ? (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-noir-dark">{heading}</h4>
        <ul className="space-y-2">
          {items.map(split => (
            <li key={split.id}>
              <Link
                href={`/splits/${split.id}`}
                className="block rounded border border-noir-gold/30 px-3 py-2 text-sm text-noir-dark hover:bg-noir-gold/10"
              >
                <span className="font-medium">{split.perfumeName}</span>
                <span className="text-noir-gold-700">
                  {" "}
                  · {split.totalMl} ml · {split.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <section className="rounded-md border border-noir-gold/30 bg-noir-dark/20 p-4 space-y-4">
      <h3 className="text-lg text-noir-gold">{t("title")}</h3>
      {renderList(hosted, t("hosting"))}
      {renderList(participating, t("participating"))}
    </section>
  )
}

export default DecantSplitsPanel
