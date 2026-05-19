"use client"

import { useTranslations } from "next-intl"

import type { ScentJourneyItem } from "@/models/scent-journey.server"

import ScentJourneyTimelineItem from "./ScentJourneyTimelineItem"

type ScentJourneyTimelineProps = {
  items: ScentJourneyItem[]
  traderId: string
  viewerId: string | null
}

const ScentJourneyTimeline = ({
  items,
  traderId,
  viewerId,
}: ScentJourneyTimelineProps) => {
  const t = useTranslations("traderProfile.scentJourney")

  if (items.length === 0) {
    return <p className="text-sm text-noir-gold-100">{t("empty")}</p>
  }

  return (
    <ol className="space-y-3" aria-label={t("ariaLabel")}>
      {items.map(item => (
        <li
          key={`${item.kind}-${atKey(item.at)}-${journeyItemKey(item)}`}
        >
          <ScentJourneyTimelineItem
            item={item}
            traderId={traderId}
            viewerId={viewerId}
          />
        </li>
      ))}
    </ol>
  )
}

const atKey = (at: Date | string): string =>
  typeof at === "string" ? at : at.toISOString()

const journeyItemKey = (item: ScentJourneyItem): string => {
  switch (item.kind) {
    case "bottle_added":
      return item.userPerfumeId
    case "trade_completed":
      return item.tradeId
    case "review_written":
      return item.feedbackId
    case "scent_dna":
      return item.variant
    case "blog_mention":
      return item.article._id
    default:
      return "unknown"
  }
}

export default ScentJourneyTimeline
