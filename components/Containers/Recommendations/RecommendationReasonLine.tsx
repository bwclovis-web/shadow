"use client"

import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { MdInfoOutline } from "react-icons/md"

import IconPopover from "@/components/Molecules/IconPopover"
import type { RecommendationReason } from "@/services/recommendations"
import { styleMerge } from "@/utils/styleUtils"

const formatNoteList = (names: string[], locale: string) => {
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

const boostParts = (
  boosts: NonNullable<RecommendationReason["boosts"]> | undefined,
  tReason: ReturnType<typeof useTranslations<"recommendations.reason">>
): string[] => {
  if (!boosts) return []
  const parts: string[] = []
  if (boosts.seasonAligned) parts.push(tReason("boostSeason"))
  if (boosts.priceAligned) parts.push(tReason("boostPrice"))
  if (boosts.houseTierAligned) parts.push(tReason("boostHouseTier"))
  if (boosts.concentrationAligned) parts.push(tReason("boostConcentration"))
  return parts
}

/**
 * Short explainability line for rules-based picks (CF-013), shown in a click-to-open popover.
 */
export const RecommendationReasonLine = ({
  reason,
  className,
  panelClassName,
  buttonClassName,
  contentClassName,
}: RecommendationReasonLineProps) => {
  const tReason = useTranslations("recommendations.reason")
  const tRec = useTranslations("recommendations")
  const locale = useLocale()

  const text = useMemo(() => {
    if (!reason) return null
    let base: string | null = null
    switch (reason.kind) {
      case "similar_notes": {
        if (reason.sharedNoteNames.length === 0) {
          base = tReason("similarNotesFallback")
        } else {
          const notes = formatNoteList(reason.sharedNoteNames, locale)
          base = tReason("similarNotes", { notes })
        }
        break
      }
      case "profile_match": {
        if (reason.matchedNoteNames.length === 0) {
          base = tReason("profileMatchFallback")
        } else {
          const notes = formatNoteList(reason.matchedNoteNames, locale)
          base = tReason("profileMatch", { notes })
        }
        break
      }
      case "popular":
        base = tReason("popular")
        break
      case "recent":
        base = tReason("recent")
        break
      case "same_house":
        base = tReason("sameHouse")
        break
      default:
        return null
    }
    const extras = boostParts(reason.boosts, tReason)
    if (extras.length === 0) return base
    return `${base} ${tReason("boostPrefix", { details: extras.join(", ") })}`
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
