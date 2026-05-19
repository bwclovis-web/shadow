"use client"

import { useLocale, useTranslations } from "next-intl"
import { useCallback } from "react"
import { MdInfoOutline } from "react-icons/md"

import IconPopover from "@/components/Molecules/IconPopover"
import type { TradeMatchReason } from "@/services/trade-match"
import type { NoteFamilyId } from "@/utils/scent-dna/note-families"
import { styleMerge } from "@/utils/styleUtils"

const defaultChipClassName =
  "rounded border border-noir-gold/20 bg-noir-black/40 px-2 py-0.5 text-xs text-noir-gold-100"

const defaultTriggerClassName =
  "border border-noir-gold/35 text-noir-gold-400 hover:text-noir-gold-100 hover:border-noir-gold/55 rounded-full"

const defaultContentClassName =
  "text-sm text-noir-gold-100/90 leading-snug text-left px-1 m-0"

type TradeMatchReasonLineProps = {
  reasons: TradeMatchReason[]
  primaryReasons?: TradeMatchReason[]
  /** i18n root, e.g. tradingPost.matchReason */
  translationNamespace?: string
  className?: string
  chipClassName?: string
  panelClassName?: string
  buttonClassName?: string
  contentClassName?: string
}

export const TradeMatchReasonLine = ({
  reasons,
  primaryReasons,
  translationNamespace = "tradingPost.matchReason",
  className,
  chipClassName,
  panelClassName,
  buttonClassName,
  contentClassName,
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

  const inline = primaryReasons ?? reasons.slice(0, 2)
  const inlineLabels = inline
    .map(r => labelForReason(r))
    .filter((text): text is string => Boolean(text))

  if (inlineLabels.length === 0) return null

  const allLabels = reasons
    .map(r => labelForReason(r))
    .filter((text): text is string => Boolean(text))

  const showPopover = allLabels.length > inlineLabels.length

  return (
    <div className={styleMerge("flex flex-wrap items-center gap-1.5", className)}>
      <ul className="flex flex-wrap gap-1.5" aria-label={t("inlineAriaLabel")}>
        {inlineLabels.map((text, index) => (
          <li
            key={`${inline[index]?.kind ?? index}-${text}`}
            className={styleMerge(defaultChipClassName, chipClassName)}
          >
            {text}
          </li>
        ))}
      </ul>
      {showPopover ? (
        <IconPopover
          ariaLabel={t("whyAriaLabel")}
          icon={<MdInfoOutline size={18} className="text-current" />}
          panelClassName={panelClassName}
          buttonClassName={styleMerge(defaultTriggerClassName, buttonClassName)}
        >
          <ul
            className={styleMerge(
              "m-0 list-disc space-y-1 pl-4 text-left",
              defaultContentClassName,
              contentClassName
            )}
          >
            {allLabels.map(text => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </IconPopover>
      ) : null}
    </div>
  )
}
