"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { FaHandshake, FaNewspaper, FaStar } from "react-icons/fa6"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import ActivityFeedItem from "@/components/Containers/Exchange/ActivityFeedItem"
import { getArticleCoverUrl } from "@/lib/sanity/image"
import type { FollowedActivityItem } from "@/models/activity-feed.server"
import { formatTimeAgo } from "@/utils/time-ago"
import { getTraderDisplayName } from "@/utils/user"

type FollowedActivityFeedItemProps = {
  item: FollowedActivityItem
  compact?: boolean
}

const cardClass = (compact: boolean) =>
  `flex min-w-0 gap-3 rounded-md border border-noir-light/30 bg-noir-dark/50 p-2${
    compact ? " shrink-0 snap-start" : ""
  }`

const FollowedActivityFeedItem = ({ item, compact = false }: FollowedActivityFeedItemProps) => {
  const t = useTranslations("tradingPost.followedActivity")

  if (item.kind === "listing") {
    return <ActivityFeedItem listing={item.listing} compact={compact} />
  }

  if (item.kind === "trade_completed") {
    const traderName = getTraderDisplayName(item.trader)
    const perfumeLabel =
      item.perfumeNames.length > 0 ? item.perfumeNames.join(", ") : t("tradeFallbackPerfume")

    return (
      <article className={cardClass(compact)}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-noir-black/60 text-noir-gold">
          <FaHandshake className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-noir-gold">
            <PrefetchLink href={`/trader-profile/${item.trader.id}`} className="hover:underline">
              {traderName}
            </PrefetchLink>{" "}
            {t("completedTrade")}
          </p>
          <p className="mt-0.5 truncate text-xs text-noir-gold-100">{perfumeLabel}</p>
          <p className="mt-1 text-xs text-noir-gold-500">{formatTimeAgo(item.at)}</p>
        </div>
      </article>
    )
  }

  if (item.kind === "review") {
    const { feedback } = item
    const traderName = getTraderDisplayName(feedback.trader)
    const reviewerName = getTraderDisplayName(feedback.reviewer)

    return (
      <article className={cardClass(compact)}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-noir-black/60 text-noir-gold">
          <FaStar className="h-6 w-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-noir-gold">
            {reviewerName} {t("leftReview")}{" "}
            <PrefetchLink
              href={`/trader-profile/${feedback.traderId}#reviews`}
              className="hover:underline"
            >
              {traderName}
            </PrefetchLink>
          </p>
          <p className="mt-0.5 text-xs text-noir-gold-100">
            {t("rating", { count: feedback.rating })}
            {feedback.commentPreview ? ` — ${feedback.commentPreview}` : ""}
          </p>
          <p className="mt-1 text-xs text-noir-gold-500">{formatTimeAgo(item.at)}</p>
        </div>
      </article>
    )
  }

  const coverUrl = getArticleCoverUrl(item.article.coverImage, 112, 112)
  const blogHref = `/journal/${item.article.slug}`

  return (
    <article className={cardClass(compact)}>
      <PrefetchLink
        href={blogHref}
        className="relative block h-14 w-14 shrink-0 overflow-hidden rounded bg-noir-black"
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={item.article.coverImage?.alt ?? item.article.title}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-noir-gold">
            <FaNewspaper className="h-6 w-6" aria-hidden />
          </span>
        )}
      </PrefetchLink>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-noir-gold">
          <PrefetchLink href={blogHref} className="hover:underline line-clamp-2">
            {item.article.title}
          </PrefetchLink>
        </p>
        <p className="mt-0.5 text-xs text-noir-gold-100">{t("newArticle")}</p>
        <p className="mt-1 text-xs text-noir-gold-500">{formatTimeAgo(item.at)}</p>
      </div>
    </article>
  )
}

export default FollowedActivityFeedItem
