"use client"

import { useLocale, useTranslations } from "next-intl"
import { useCallback, useMemo } from "react"
import { MdInfoOutline } from "react-icons/md"

import IconPopover from "@/components/Molecules/IconPopover"
import type { TradeMatchReason } from "@/services/trade-match"
import type { NoteFamilyId } from "@/utils/scent-dna/note-families"
import { styleMerge } from "@/utils/styleUtils"

const defaultTriggerClassName =
  "border border-noir-gold/35 text-noir-gold-400 hover:text-noir-gold-100 hover:border-noir-gold/55 rounded-full"

const defaultContentClassName =
  "text-sm text-noir-gold-100/90 leading-snug text-left px-1 m-0"

type TradeMatchReasonLineProps = {
  reasons: TradeMatchReason[]
  /** @deprecated All reasons are shown in the popover; ignored. */
  primaryReasons?: TradeMatchReason[]
  /** i18n root, e.g. tradingPost.matchReason */
  translationNamespace?: string
  className?: string
  panelClassName?: string
  buttonClassName?: string
  contentClassName?: string
  /** Show short label beside the info icon (default true). */
  showTriggerLabel?: boolean
}

export const TradeMatchReasonLine = ({
  reasons,
  translationNamespace = "tradingPost.matchReason",
  className,
  panelClassName,
  buttonClassName,
  contentClassName,
  showTriggerLabel = true,
}: TradeMatchReasonLineProps) => {
  const t = useTranslations(translationNamespace)
  const tFamilies = useTranslations("traderProfile.scentDna.families")
  const locale = useLocale()

  const labelForReason = useCallback(
    (reason: TradeMatchReason): string | null => {
      switch (reason.kind) {
        case "on_your_wishlist":
          return t("onYourWishlist")
        case "they_want_yours":
          return t("theyWantYours")
        case "wishlist_overlap_depth":
          return t("wishlistOverlapDepth", { count: reason.count })
        case "scent_dna_overlap": {
          const labels = reason.families.map((f: NoteFamilyId) => tFamilies(f))
          const familyText = new Intl.ListFormat(locale, {
            style: "short",
            type: "conjunction",
          }).format(labels)
          return t("scentDnaOverlap", { families: familyText })
        }
        case "same_region":
          return t("sameRegion")
        case "top_rated_swapper":
          return t("topRatedSwapper")
        case "fast_responder":
          return t("fastResponder")
        case "reliable_swapper":
          return t("reliableSwapper")
        case "similar_trade_history":
          return t("similarTradeHistory")
        default:
          return null
      }
    },
    [t, tFamilies, locale]
  )

  const labeledReasons = useMemo(
    () =>
      reasons
        .map((reason, index) => ({
          reason,
          index,
          text: labelForReason(reason),
        }))
        .filter((row): row is typeof row & { text: string } => Boolean(row.text)),
    [reasons, labelForReason]
  )

  if (labeledReasons.length === 0) return null

  return (
    <span className={styleMerge("inline-flex items-center gap-1.5", className)}>
      <IconPopover
        ariaLabel={t("whyAriaLabel")}
        icon={<MdInfoOutline size={18} className="text-current shrink-0" />}
        panelClassName={panelClassName}
        buttonClassName={styleMerge(defaultTriggerClassName, buttonClassName)}
      >
        <ul
          className={styleMerge(
            "m-0 list-disc space-y-1.5 pl-4 text-left",
            defaultContentClassName,
            contentClassName
          )}
        >
          {labeledReasons.map(({ reason, index, text }) => (
            <li key={`${reason.kind}-${index}`}>{text}</li>
          ))}
        </ul>
      </IconPopover>
    </span>
  )
}
