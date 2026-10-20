"use client"

import { memo } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Link } from "next-view-transitions"

import { VooDooLink } from "@/components/Atoms/Button"
import ReviewStatusBadge from "@/components/Atoms/ReviewStatusBadge"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import {
  getCollectionOwnedDisplay,
  getFragranceListedMl,
} from "@/lib/collection-volume-display"
import { getInventoryListingStatus } from "@/lib/user-inventory"
import type { UserPerfumeForClient } from "@/types/my-scents-client"
import { CARD_IMAGE_COLOR_HOVER_CLASS } from "@/utils/card-motion"
import { normalizeRemoteImageSrc, styleMerge, validImageRegex } from "@/utils/styleUtils"
import { userBottleImageTransitionName } from "@/utils/view-transition-names"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"

const focusRingClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"

const buildBottleLabel = (up: UserPerfumeForClient, bottleCount: number): string | null => {
  if (bottleCount < 2) return null
  const typeLabel = getPerfumeTypeLabel(up.type ?? undefined)
  const owned = getCollectionOwnedDisplay(up.amount)
  const amtStr = owned.kind === "known" && owned.ml > 0 ? `${owned.labelMl} ml` : null
  const parts = [typeLabel, amtStr].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : null
}

export type CollectionGridItemProps = {
  userPerfume: UserPerfumeForClient
  allUserPerfumes: UserPerfumeForClient[]
  basePath: string
  bottleCount: number
  listingStatus: ReturnType<typeof getInventoryListingStatus>
  inReview: boolean
  listingStatusLabel: string
  /** Grid card or dense list row — same data and actions. */
  variant?: "grid" | "list"
}

export const CollectionGridItem = memo(({
  userPerfume,
  allUserPerfumes,
  basePath,
  bottleCount,
  listingStatus,
  inReview,
  listingStatusLabel,
  variant = "grid",
}: CollectionGridItemProps) => {
  const t = useTranslations("myScents.collection.card")
  const tDestash = useTranslations("myScents.destashManager")
  const { perfume } = userPerfume
  const normalized = normalizeRemoteImageSrc(perfume.image)
  const imageSrc =
    normalized && !validImageRegex.test(normalized)
      ? normalized
      : BOTTLE_PLACEHOLDER
  const bottleLabel = buildBottleLabel(userPerfume, bottleCount)
  const owned = getCollectionOwnedDisplay(userPerfume.amount)
  const fragranceListed = getFragranceListedMl(userPerfume.perfumeId, allUserPerfumes)
  const bottleHref = `${basePath}/${userPerfume.id}`
  const createDestashHref = `${basePath}/${userPerfume.id}?list=1`
  const houseName = perfume.perfumeHouse?.name
  const ownedLabel =
    owned.kind === "known" ? t("owned", { ml: owned.labelMl }) : t("ownedUnknown")
  const listedLabel = t("listedFragrance", { ml: fragranceListed.labelMl })
  const listedAria = t("listedFragranceAria", { ml: fragranceListed.labelMl })
  const listedHint = t("listedFragranceHint")

  const statusBadge = (
    <span
      className={styleMerge(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        listingStatus === "listed"
          ? "bg-noir-gold/80 text-noir-black"
          : listingStatus === "partiallyListed"
            ? "bg-noir-gold-500/70 text-noir-black"
            : "bg-noir-black/80 text-noir-gold-500"
      )}
    >
      {listingStatusLabel}
    </span>
  )

  const actions = (
    <div className="flex flex-wrap gap-2">
      <VooDooLink
        url={bottleHref}
        variant="secondary"
        size="sm"
        className="justify-center"
      >
        {t("viewBottle")}
      </VooDooLink>
      <VooDooLink
        url={createDestashHref}
        variant="secondary"
        size="sm"
        className="justify-center"
      >
        {tDestash("createDestash")}
      </VooDooLink>
    </div>
  )

  if (variant === "list") {
    return (
      <li
        data-collection-card
        className="group relative border border-noir-gold/40 bg-noir-black/30 p-3 transition-colors duration-300 hover:border-noir-gold md:p-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <Link
            href={bottleHref}
            className={styleMerge(
              "relative h-20 w-20 shrink-0 overflow-hidden rounded-sm bg-noir-black/40 md:h-24 md:w-24",
              focusRingClass
            )}
          >
            <Image
              src={imageSrc}
              alt={perfume.name ?? "Perfume Bottle"}
              fill
              quality={75}
              className={CARD_IMAGE_COLOR_HOVER_CLASS}
              sizes="96px"
              style={
                {
                  viewTransitionName: userBottleImageTransitionName(userPerfume.id),
                } as React.CSSProperties
              }
            />
          </Link>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-start gap-2">
              {inReview && <ReviewStatusBadge />}
              {statusBadge}
            </div>
            {houseName ? (
              <p className="break-words text-sm text-noir-gold-100">{houseName}</p>
            ) : null}
            <Link
              href={bottleHref}
              className={styleMerge(
                "block break-words font-semibold text-noir-gold hover:text-noir-gold-100",
                focusRingClass
              )}
            >
              {perfume.name}
            </Link>
            {bottleLabel && (
              <p className="text-xs text-noir-gold-100">{bottleLabel}</p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1 text-sm text-noir-cream md:w-44 md:shrink-0">
            <p className="m-0 break-words">{ownedLabel}</p>
            <p
              className="m-0 break-words"
              title={listedHint}
              aria-label={listedAria}
            >
              {listedLabel}
            </p>
          </div>

          <div className="md:shrink-0 md:self-center">{actions}</div>
        </div>
      </li>
    )
  }

  return (
    <li
      data-collection-card
      className="group relative flex h-full w-full flex-col border border-noir-gold/50 bg-noir-black/30 p-3 transition-colors duration-300 hover:border-noir-gold"
    >
      {inReview && (
        <ReviewStatusBadge className="absolute left-2 top-2 z-10" />
      )}
      <span className="absolute right-2 top-2 z-10">{statusBadge}</span>

      <Link
        href={bottleHref}
        className={styleMerge("block min-w-0", focusRingClass)}
      >
        <div className="relative mx-auto mb-3 aspect-[3/4] w-full max-w-[11rem] overflow-hidden rounded-sm bg-noir-black/40">
          <Image
            src={imageSrc}
            alt={perfume.name ?? "Perfume Bottle"}
            priority={false}
            fill
            quality={75}
            className={CARD_IMAGE_COLOR_HOVER_CLASS}
            sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 33vw"
            style={
              {
                viewTransitionName: userBottleImageTransitionName(userPerfume.id),
              } as React.CSSProperties
            }
          />
        </div>
        {houseName ? (
          <p className="break-words text-sm text-noir-gold-100">{houseName}</p>
        ) : null}
        <p className="break-words font-semibold text-noir-gold">{perfume.name}</p>
        {bottleLabel && (
          <p className="mt-1 text-xs text-noir-gold-100">{bottleLabel}</p>
        )}
      </Link>

      <div className="mt-2 space-y-0.5 text-sm text-noir-cream">
        <p className="m-0">{ownedLabel}</p>
        <p className="m-0" title={listedHint} aria-label={listedAria}>
          {listedLabel}
        </p>
      </div>

      <div className="mt-auto pt-3">{actions}</div>
    </li>
  )
})
CollectionGridItem.displayName = "CollectionGridItem"
