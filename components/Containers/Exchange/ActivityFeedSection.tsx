"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { FaClockRotateLeft } from "react-icons/fa6"

import VooDooDetails from "@/components/Atoms/VooDooDetails"
import ActivityFeedItem from "@/components/Containers/Exchange/ActivityFeedItem"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import type { ActivityFeedListingRow } from "@/models/activity-feed.server"

const DESKTOP_MEDIA = "(min-width: 1024px)"

type ActivityFeedSectionProps = {
  listings: ActivityFeedListingRow[]
  variant?: "full" | "compact"
  className?: string
}

const ActivityFeedList = ({
  listings,
  compact,
  listRef,
}: {
  listings: ActivityFeedListingRow[]
  compact: boolean
  listRef?: React.RefObject<HTMLUListElement | null>
}) =>
  compact ? (
    <ul
      ref={listRef}
      className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
    >
      {listings.map(listing => (
        <li
          key={listing.id}
          data-activity-feed-item
          className="min-w-[min(100%,260px)] max-w-[260px] shrink-0 snap-start opacity-0"
        >
          <ActivityFeedItem listing={listing} compact />
        </li>
      ))}
    </ul>
  ) : (
    <ul ref={listRef} className="space-y-2">
      {listings.map(listing => (
        <li key={listing.id} data-activity-feed-item className="opacity-0">
          <ActivityFeedItem listing={listing} />
        </li>
      ))}
    </ul>
  )

const ActivityFeedSection = ({
  listings,
  variant = "full",
  className = "",
}: ActivityFeedSectionProps) => {
  const t = useTranslations(
    variant === "compact" ? "home.activityFeed" : "tradingPost.activityFeed"
  )
  const isLg = useMediaQuery(DESKTOP_MEDIA)
  const [feedOpen, setFeedOpen] = useState(false)
  const feedListRef = useRef<HTMLUListElement>(null)

  useGsapStagger(feedListRef, {
    selector: "[data-activity-feed-item]",
    deps: [listings.map(l => l.id).join(",")],
    enabled: listings.length > 0,
  })

  useEffect(() => {
    setFeedOpen(isLg)
  }, [isLg])

  if (listings.length === 0) return null

  const isCompact = variant === "compact"

  if (isCompact) {
    return (
      <section
        className={className}
        aria-labelledby="home-activity-feed-heading"
      >
        <div className="flex items-start gap-3">
          <FaClockRotateLeft
            className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold"
            aria-hidden
          />
          <h2
            id="home-activity-feed-heading"
            className="text-lg font-semibold text-noir-gold"
          >
            {t("title")}
          </h2>
        </div>
        <div className="mt-4">
          <ActivityFeedList listings={listings} compact listRef={feedListRef} />
        </div>
      </section>
    )
  }

  return (
    <VooDooDetails
      name="justListed"
      type="primary"
      background="dark"
      summary={t("title")}
      className={className}
      open={feedOpen}
      onToggle={e => setFeedOpen(e.currentTarget.open)}
    >
      <div className="space-y-4 px-3 pb-4 pt-2">
        <p className="text-sm text-noir-gold-100">{t("description")}</p>
        <ActivityFeedList listings={listings} compact={false} listRef={feedListRef} />
      </div>
    </VooDooDetails>
  )
}

export default ActivityFeedSection
