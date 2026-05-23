"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import {
  FaDna,
  FaFlask,
  FaHandshake,
  FaNewspaper,
  FaStar,
} from "react-icons/fa6"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { getArticleCoverUrl } from "@/lib/sanity/image"
import type { ScentJourneyItem } from "@/models/scent-journey.server"
import { formatTimeAgo } from "@/utils/time-ago"

type ScentJourneyTimelineItemProps = {
  item: ScentJourneyItem
  traderId: string
  viewerId: string | null
}

const cardClass =
  "flex min-w-0 gap-3 rounded-md border border-noir-light/30 bg-noir-dark/50 p-3"

const IconShell = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-noir-black/60 text-noir-gold">
    {children}
  </div>
)

const CtaLink = ({ href, label }: { href: string; label: string }) => (
  <PrefetchLink
    href={href}
    className="mt-2 inline-block text-xs font-medium text-noir-gold underline-offset-2 hover:underline"
  >
    {label}
  </PrefetchLink>
)

const ScentJourneyTimelineItem = ({
  item,
  traderId,
  viewerId,
}: ScentJourneyTimelineItemProps) => {
  const t = useTranslations("traderProfile.scentJourney")

  if (item.kind === "bottle_added") {
    const href = `/perfume/${item.perfumeSlug}`
    return (
      <article className={cardClass}>
        {item.perfumeImage ? (
          <PrefetchLink
            href={href}
            className="relative block h-12 w-12 shrink-0 overflow-hidden rounded bg-noir-black"
          >
            <Image
              src={item.perfumeImage}
              alt={item.perfumeName}
              fill
              className="object-cover"
              sizes="48px"
            />
          </PrefetchLink>
        ) : (
          <IconShell>
            <FaFlask className="h-5 w-5" aria-hidden />
          </IconShell>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-noir-gold">{t("bottleAdded")}</p>
          <p className="mt-0.5 truncate text-xs text-noir-gold-100">{item.perfumeName}</p>
          <p className="mt-1 text-xs text-noir-gold-500">{formatTimeAgo(item.at)}</p>
          <CtaLink href={href} label={t("viewPerfume")} />
        </div>
      </article>
    )
  }

  if (item.kind === "trade_completed") {
    const perfumeLabel =
      item.perfumeNames.length > 0
        ? item.perfumeNames.join(", ")
        : t("tradeFallbackPerfume")
    const viewerIsProfileOwner = viewerId === traderId
    const viewerIsCounterparty = viewerId === item.counterpartyId
    const viewerInTrade = viewerIsProfileOwner || viewerIsCounterparty
    const messagesOtherPartyId = viewerIsCounterparty ? traderId : item.counterpartyId
    const messagesHref = `/messages/${messagesOtherPartyId}`
    const partnerHref = `/trader-profile/${item.counterpartyId}`

    return (
      <article className={cardClass}>
        <IconShell>
          <FaHandshake className="h-5 w-5" aria-hidden />
        </IconShell>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-noir-gold">{t("tradeCompleted")}</p>
          <p className="mt-0.5 text-xs text-noir-gold-100">
            {t("tradeWith", { name: item.counterpartyName, perfumes: perfumeLabel })}
          </p>
          <p className="mt-1 text-xs text-noir-gold-500">{formatTimeAgo(item.at)}</p>
          {viewerInTrade && viewerId ? (
            <CtaLink href={messagesHref} label={t("viewTrade")} />
          ) : (
            <CtaLink href={partnerHref} label={t("viewSwapPartner")} />
          )}
        </div>
      </article>
    )
  }

  if (item.kind === "review_written") {
    const href = `/trader-profile/${item.traderId}#reviews`
    return (
      <article className={cardClass}>
        <IconShell>
          <FaStar className="h-5 w-5" aria-hidden />
        </IconShell>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-noir-gold">
            {t("reviewWritten", { name: item.traderName })}
          </p>
          <p className="mt-0.5 text-xs text-noir-gold-100">
            {t("rating", { count: item.rating })}
            {item.commentPreview ? ` — ${item.commentPreview}` : ""}
          </p>
          <p className="mt-1 text-xs text-noir-gold-500">{formatTimeAgo(item.at)}</p>
          <CtaLink href={href} label={t("viewReview")} />
        </div>
      </article>
    )
  }

  if (item.kind === "scent_dna") {
    const href = `/trader-profile/${traderId}/scent-dna`
    const description =
      item.variant === "quiz" ? t("scentDnaQuiz") : t("scentDnaRefined")
    return (
      <article className={cardClass}>
        <IconShell>
          <FaDna className="h-5 w-5" aria-hidden />
        </IconShell>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-noir-gold">{description}</p>
          <p className="mt-1 text-xs text-noir-gold-500">{formatTimeAgo(item.at)}</p>
          <CtaLink href={href} label={t("viewScentDna")} />
        </div>
      </article>
    )
  }

  const coverUrl = getArticleCoverUrl(item.article.coverImage, 96, 96)
  const blogHref = `/journal/${item.article.slug}`

  return (
    <article className={cardClass}>
      <PrefetchLink
        href={blogHref}
        className="relative block h-12 w-12 shrink-0 overflow-hidden rounded bg-noir-black"
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={item.article.coverImage?.alt ?? item.article.title}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-noir-gold">
            <FaNewspaper className="h-5 w-5" aria-hidden />
          </span>
        )}
      </PrefetchLink>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-noir-gold line-clamp-2">{item.article.title}</p>
        <p className="mt-0.5 text-xs text-noir-gold-100">
          {item.context === "house" ? t("blogHouse") : t("blogPerfume")}
        </p>
        <p className="mt-1 text-xs text-noir-gold-500">{formatTimeAgo(item.at)}</p>
        <CtaLink href={blogHref} label={t("viewArticle")} />
      </div>
    </article>
  )
}

export default ScentJourneyTimelineItem
