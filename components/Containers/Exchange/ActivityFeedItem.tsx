"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"

import type { ActivityFeedListingRow } from "@/models/activity-feed.server"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import TraderAvatar from "@/components/Molecules/TraderAvatar/TraderAvatar"
import { getPrimaryListingImage } from "@/utils/listing-display"
import { formatTimeAgo } from "@/utils/time-ago"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"
import { perfumeImageTransitionName } from "@/utils/view-transition-names"
import { getTraderDisplayName } from "@/utils/user"

type ActivityFeedItemProps = {
  listing: ActivityFeedListingRow
  compact?: boolean
}

const ActivityFeedItem = ({ listing, compact = false }: ActivityFeedItemProps) => {
  const t = useTranslations("tradingPost.activityFeed")
  const imageSrc = normalizeRemoteImageSrc(
    getPrimaryListingImage({
      images: listing.images,
      perfume: listing.perfume,
    })
  )
  const traderName = getTraderDisplayName(listing.user)
  const thumbSize = compact ? 56 : 72

  return (
    <article
      className={`flex min-w-0 gap-3 rounded-md border border-noir-light/30 bg-noir-dark/50 p-2 ${
        compact ? "shrink-0 snap-start" : ""
      }`}
    >
      <PrefetchLink
        href={`/perfume/${listing.perfume.slug}`}
        className={`relative shrink-0 overflow-hidden rounded-md border border-noir-gold/30 bg-noir-black/40 ${
          compact ? "h-14 w-14" : "h-[4.5rem] w-[4.5rem]"
        }`}
        aria-label={t("viewPerfume", { name: listing.perfume.name })}
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-cover"
            sizes={`${thumbSize}px`}
            style={
              {
                viewTransitionName: perfumeImageTransitionName(listing.perfume.id),
              } as React.CSSProperties
            }
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-xs text-noir-gold/60"
            aria-hidden
          >
            —
          </span>
        )}
      </PrefetchLink>

      <div className="min-w-0 flex-1">
        <PrefetchLink
          href={`/perfume/${listing.perfume.slug}`}
          className="line-clamp-2 text-sm font-semibold text-noir-gold hover:text-noir-gold-100"
        >
          {listing.perfume.name}
        </PrefetchLink>
        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          <PrefetchLink
            href={`/trader-profile/${listing.userId}`}
            className="flex min-w-0 items-center gap-2 hover:opacity-90"
            aria-label={t("viewTrader", { name: traderName })}
          >
            <TraderAvatar
              displayName={traderName}
              avatarImage={listing.user.avatarImage}
              size="sm"
            />
            <span className="truncate text-xs text-noir-gold-100">{traderName}</span>
          </PrefetchLink>
        </div>
        <p className="mt-1 text-xs text-noir-gold-500">
          {formatTimeAgo(listing.createdAt)}
        </p>
      </div>
    </article>
  )
}

export default ActivityFeedItem
