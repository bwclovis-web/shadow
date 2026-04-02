"use client"

import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"

import type { RecommendationReason } from "@/services/recommendations"

function formatNoteList(names: string[], locale: string) {
  if (names.length === 0) return ""
  return new Intl.ListFormat(locale, { style: "short", type: "conjunction" }).format(
    names
  )
}

type RecommendationReasonLineProps = {
  reason?: RecommendationReason | null
  className?: string
}

/**
 * Short explainability line for rules-based picks (CF-013).
 */
export function RecommendationReasonLine({
  reason,
  className = "text-center text-xs text-noir-gold-500/70 mt-1 px-1 leading-snug",
}: RecommendationReasonLineProps) {
  const t = useTranslations("recommendations.reason")
  const locale = useLocale()

  const text = useMemo(() => {
    if (!reason) return null
    switch (reason.kind) {
      case "similar_notes": {
        if (reason.sharedNoteNames.length === 0) {
          return t("similarNotesFallback")
        }
        const notes = formatNoteList(reason.sharedNoteNames, locale)
        return t("similarNotes", { notes })
      }
      case "profile_match": {
        if (reason.matchedNoteNames.length === 0) {
          return t("profileMatchFallback")
        }
        const notes = formatNoteList(reason.matchedNoteNames, locale)
        return t("profileMatch", { notes })
      }
      case "popular":
        return t("popular")
      case "recent":
        return t("recent")
      default:
        return null
    }
  }, [reason, locale, t])

  if (!text) return null
  return <p className={className}>{text}</p>
}
