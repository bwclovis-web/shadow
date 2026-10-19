"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { ListingImageBadges } from "@/components/Molecules/ListingPhotos/ListingPhotos"
import { PerfumeCompareToggle } from "@/components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle"
import TraderAvatar from "@/components/Molecules/TraderAvatar/TraderAvatar"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import type { HomeListing } from "@/types/home-listing"
import { getPrimaryListingImage } from "@/utils/listing-display"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"
import { formatTimeAgo } from "@/utils/time-ago"

type HomeListingCardProps = {
  listing: HomeListing
}

const isPositiveAmount = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return false
  const amount = Number(trimmed)
  return Number.isFinite(amount) && amount > 0
}

const HomeListingCard = ({ listing }: HomeListingCardProps) => {
  const t = useTranslations("home.galleryWalk.latest")
  const tListing = useTranslations("listing")
  const { perfume, trader } = listing
  const perfumeHref = `/perfume/${perfume.slug}`
  const imageSrc = normalizeRemoteImageSrc(
    getPrimaryListingImage({ images: listing.images, perfume })
  )

  const details = [
    isPositiveAmount(listing.availableMl)
      ? t("milliliters", { amount: listing.availableMl.trim() })
      : null,
    getPerfumeTypeLabel(listing.type ?? undefined) ?? null,
    listing.decantFormat
      ? tListing(`decantFormat.${listing.decantFormat}`)
      : null,
  ].filter((detail): detail is string => Boolean(detail))

  return (
    <article className="relative isolate flex w-full min-w-0 flex-col overflow-hidden border border-noir-gold/70 bg-noir-dark hover:border-noir-gold">
      <div className="group relative aspect-[4/3] overflow-hidden bg-noir-black">
        <PrefetchLink
          href={perfumeHref}
          tabIndex={-1}
          aria-hidden
          className="absolute inset-0 block"
        >
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt=""
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(min-width: 75rem) 290px, (min-width: 40rem) 50vw, 100vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-noir-dark to-noir-black" />
          )}
        </PrefetchLink>
        <div className="pointer-events-none absolute left-2 top-2 z-10">
          <ListingImageBadges
            condition={listing.condition}
            tradePreference={listing.tradePreference}
            tradeOnly={listing.tradeOnly}
          />
        </div>
        <PerfumeCompareToggle
          item={{
            id: perfume.id,
            slug: perfume.slug,
            name: perfume.name,
            image: perfume.image ?? undefined,
          }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 border-t border-noir-gold/50 p-4">
        <h3 className="!text-2xl !leading-tight lg:!text-[1.625rem]">
          <PrefetchLink
            href={perfumeHref}
            className="text-noir-gold hover:text-noir-gold-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"
          >
            {perfume.name}
          </PrefetchLink>
        </h3>
        {perfume.houseName ? (
          <p className="text-base text-noir-light">{perfume.houseName}</p>
        ) : null}
        {details.length > 0 ? (
          <p className="text-[0.9375rem] text-noir-light/75">{details.join(" · ")}</p>
        ) : null}

        <div className="mt-auto flex min-w-0 items-center justify-between gap-3 border-t border-noir-gold/25 pt-3">
          <PrefetchLink
            href={`/trader-profile/${trader.id}`}
            className="flex min-w-0 items-center gap-2 text-noir-gold-100 hover:text-noir-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"
          >
            <TraderAvatar
              displayName={trader.displayName}
              avatarImage={trader.avatarImage}
              size="sm"
            />
            <span className="truncate text-[0.8125rem]">{trader.displayName}</span>
          </PrefetchLink>
          <time
            dateTime={listing.createdAt.toISOString()}
            className="shrink-0 text-[0.8125rem] text-noir-light/60"
            suppressHydrationWarning
          >
            {formatTimeAgo(listing.createdAt)}
          </time>
        </div>
      </div>
    </article>
  )
}

export default HomeListingCard
