"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { FaClockRotateLeft, FaUserGroup } from "react-icons/fa6"

import VooDooDetails from "@/components/Atoms/VooDooDetails"
import ActivityFeedItem from "@/components/Containers/Exchange/ActivityFeedItem"
import FollowedActivityFeedItem from "@/components/Containers/Exchange/FollowedActivityFeedItem"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import type {
  ActivityFeedListingRow,
  FollowedActivityItem,
} from "@/models/activity-feed.server"

const DESKTOP_MEDIA = "(min-width: 1024px)"

type ActivityFeedSectionProps = {
  listings: ActivityFeedListingRow[]
  followedItems?: FollowedActivityItem[]
  variant?: "full" | "compact"
  className?: string
}

const itemKey = (item: FollowedActivityItem) => {
  if (item.kind === "listing") return `listing-${item.listing.id}`
  if (item.kind === "trade_completed") return `trade-${item.tradeId}`
  if (item.kind === "review") return `review-${item.feedback.id}`
  return `blog-${item.article._id}`
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

const FollowedActivityFeedList = ({
  items,
  compact,
  listRef,
}: {
  items: FollowedActivityItem[]
  compact: boolean
  listRef?: React.RefObject<HTMLUListElement | null>
}) =>
  compact ? (
    <ul
      ref={listRef}
      className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
    >
      {items.map(item => (
        <li
          key={itemKey(item)}
          data-activity-feed-item
          className="min-w-[min(100%,260px)] max-w-[260px] shrink-0 snap-start opacity-0"
        >
          <FollowedActivityFeedItem item={item} compact />
        </li>
      ))}
    </ul>
  ) : (
    <ul ref={listRef} className="space-y-2">
      {items.map(item => (
        <li key={itemKey(item)} data-activity-feed-item className="opacity-0">
          <FollowedActivityFeedItem item={item} />
        </li>
      ))}
    </ul>
  )

const ActivityFeedSection = ({
  listings,
  followedItems = [],
  variant = "full",
  className = "",
}: ActivityFeedSectionProps) => {
  const tGlobal = useTranslations(
    variant === "compact" ? "home.activityFeed" : "tradingPost.activityFeed"
  )
  const tFollowed = useTranslations(
    variant === "compact" ? "home.followedActivityFeed" : "tradingPost.followedActivityFeed"
  )
  const isLg = useMediaQuery(DESKTOP_MEDIA)
  const [feedOpen, setFeedOpen] = useState(false)
  const globalListRef = useRef<HTMLUListElement>(null)
  const followedListRef = useRef<HTMLUListElement>(null)

  useGsapStagger(globalListRef, {
    selector: "[data-activity-feed-item]",
    deps: [listings.map(l => l.id).join(",")],
    enabled: listings.length > 0,
  })

  useGsapStagger(followedListRef, {
    selector: "[data-activity-feed-item]",
    deps: [followedItems.map(itemKey).join(",")],
    enabled: followedItems.length > 0,
  })

  useEffect(() => {
    setFeedOpen(isLg)
  }, [isLg])

  const isCompact = variant === "compact"
  const hasFollowed = followedItems.length > 0
  const hasGlobal = listings.length > 0

  if (!hasFollowed && !hasGlobal) return null

  const followedSection = hasFollowed ? (
    isCompact ? (
      <section className="mb-8" aria-labelledby="home-followed-activity-heading">
        <div className="flex items-start gap-3">
          <FaUserGroup className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold" aria-hidden />
          <h2
            id="home-followed-activity-heading"
            className="text-lg font-semibold text-noir-gold"
          >
            {tFollowed("title")}
          </h2>
        </div>
        <p className="mt-2 text-sm text-noir-gold-100">{tFollowed("description")}</p>
        <div className="mt-4">
          <FollowedActivityFeedList
            items={followedItems}
            compact
            listRef={followedListRef}
          />
        </div>
      </section>
    ) : (
      <VooDooDetails
        name="followedActivity"
        type="primary"
        background="dark"
        summary={tFollowed("title")}
        className="mb-4"
        open={feedOpen}
        onToggle={e => setFeedOpen(e.currentTarget.open)}
      >
        <div className="space-y-4 px-3 pb-4 pt-2">
          <p className="text-sm text-noir-gold-100">{tFollowed("description")}</p>
          <FollowedActivityFeedList
            items={followedItems}
            compact={false}
            listRef={followedListRef}
          />
        </div>
      </VooDooDetails>
    )
  ) : null

  const globalSection = hasGlobal ? (
    isCompact ? (
      <section aria-labelledby="home-activity-feed-heading">
        <div className="flex items-start gap-3">
          <FaClockRotateLeft className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold" aria-hidden />
          <h2 id="home-activity-feed-heading" className="text-lg font-semibold text-noir-gold">
            {tGlobal("title")}
          </h2>
        </div>
        <div className="mt-4">
          <ActivityFeedList listings={listings} compact listRef={globalListRef} />
        </div>
      </section>
    ) : (
      <VooDooDetails
        name="justListed"
        type="primary"
        background="dark"
        summary={tGlobal("title")}
        open={feedOpen}
        onToggle={e => setFeedOpen(e.currentTarget.open)}
      >
        <div className="space-y-4 px-3 pb-4 pt-2">
          <p className="text-sm text-noir-gold-100">{tGlobal("description")}</p>
          <ActivityFeedList listings={listings} compact={false} listRef={globalListRef} />
        </div>
      </VooDooDetails>
    )
  ) : null

  return (
    <div className={className}>
      {followedSection}
      {globalSection}
    </div>
  )
}

export default ActivityFeedSection
