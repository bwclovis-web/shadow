"use client"

import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { MdInfoOutline } from "react-icons/md"

import IconPopover from "@/components/Molecules/IconPopover"
import type { RecommendationReason } from "@/services/recommendations"
import { styleMerge } from "@/utils/styleUtils"

function formatNoteList(names: string[], locale: string) {
  if (names.length === 0) return ""
  return new Intl.ListFormat(locale, { style: "short", type: "conjunction" }).format(
    names
  )
}

const defaultTriggerClassName =
  "border border-noir-gold/35 text-noir-gold-400 hover:text-noir-gold-100 hover:border-noir-gold/55 rounded-full"

const defaultContentClassName =
  "text-sm text-noir-gold-100/90 leading-snug text-center px-1 m-0"

type RecommendationReasonLineProps = {
  reason?: RecommendationReason | null
  /** Classes on the IconPopover root (layout, alignment). */
  className?: string
  panelClassName?: string
  buttonClassName?: string
  /** Classes for the explanation paragraph inside the popover. */
  contentClassName?: string
}

/**
 * Short explainability line for rules-based picks (CF-013), shown in a click-to-open popover.
 */
export function RecommendationReasonLine({
  reason,
  className,
  panelClassName,
  buttonClassName,
  contentClassName,
}: RecommendationReasonLineProps) {
  const tReason = useTranslations("recommendations.reason")
  const tRec = useTranslations("recommendations")
  const locale = useLocale()

  const text = useMemo(() => {
    if (!reason) return null
    switch (reason.kind) {
      case "similar_notes": {
        if (reason.sharedNoteNames.length === 0) {
          return tReason("similarNotesFallback")
        }
        const notes = formatNoteList(reason.sharedNoteNames, locale)
        return tReason("similarNotes", { notes })
      }
      case "profile_match": {
        if (reason.matchedNoteNames.length === 0) {
          return tReason("profileMatchFallback")
        }
        const notes = formatNoteList(reason.matchedNoteNames, locale)
        return tReason("profileMatch", { notes })
      }
      case "popular":
        return tReason("popular")
      case "recent":
        return tReason("recent")
      case "same_house":
        return tReason("sameHouse")
      default:
        return null
    }
  }, [reason, locale, tReason])

  if (!text) return null

  return (
    <IconPopover
      ariaLabel={tRec("whyThesePicksAriaLabel")}
      icon={<MdInfoOutline size={20} className="text-current" />}
      className={className}
      panelClassName={panelClassName}
      buttonClassName={styleMerge(defaultTriggerClassName, buttonClassName)}
    >
      <p className={styleMerge(defaultContentClassName, contentClassName)}>{text}</p>
    </IconPopover>
  )
}
