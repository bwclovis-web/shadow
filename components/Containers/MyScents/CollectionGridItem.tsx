"use client"

import { memo } from "react"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Link } from "next-view-transitions"

import { Button, VooDooLink } from "@/components/Atoms/Button"
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

const LIST_ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,1.6fr)_5.5rem_5.5rem_minmax(11rem,auto)] md:items-center md:gap-4"

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
  /** Opens create-destash rail on the Collection page (preferred over full-page). */
  onCreateDestash?: (bottle: UserPerfumeForClient) => void
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
  onCreateDestash,
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
  const ownedMlLabel = owned.kind === "known" ? owned.labelMl : null
  const listedMlLabel = fragranceListed.labelMl
  const volumeInline =
    owned.kind === "known"
      ? t("ownedListedInline", { owned: ownedMlLabel!, listed: listedMlLabel })
      : t("ownedListedInlineUnknown", { listed: listedMlLabel })
  const listedHint = t("listedFragranceHint")
  const listedAria = t("listedFragranceAria", { ml: listedMlLabel })
  const showStatusChip =
    listingStatus === "listed" || listingStatus === "partiallyListed"

  const statusBadge = showStatusChip ? (
    <span
      className={styleMerge(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        listingStatus === "listed"
          ? "bg-noir-gold/80 text-noir-black"
          : "bg-noir-gold-500/70 text-noir-black"
      )}
    >
      {listingStatusLabel}
    </span>
  ) : null

  const actions = (
    <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
      <VooDooLink
        url={bottleHref}
        variant="primary"
        size="sm"
        className={styleMerge(
          "flex w-full items-center justify-center text-center md:w-full",
          focusRingClass
        )}
      >
        {t("viewBottle")}
      </VooDooLink>
      {onCreateDestash ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className={styleMerge(
            "flex w-full items-center justify-center text-center md:w-full",
            focusRingClass
          )}
          onClick={() => onCreateDestash(userPerfume)}
        >
          {tDestash("createDestash")}
        </Button>
      ) : (
        <VooDooLink
          url={createDestashHref}
          variant="secondary"
          size="sm"
          className={styleMerge(
            "flex w-full items-center justify-center text-center md:w-full",
            focusRingClass
          )}
        >
          {tDestash("createDestash")}
        </VooDooLink>
      )}
    </div>
  )

  if (variant === "list") {
    return (
      <li
        data-collection-card
        className="group relative border-b border-noir-gold/25 bg-transparent px-1 py-3 transition-colors duration-300 last:border-b-0 hover:bg-noir-black/25 md:px-2"
      >
        <div className={styleMerge("flex flex-col gap-3", LIST_ROW_GRID)}>
          <div className="flex min-w-0 items-start gap-3">
            <Link
              href={bottleHref}
              className={styleMerge(
                "relative h-14 w-14 shrink-0 overflow-hidden rounded-sm border border-noir-gold/30 bg-noir-black/40",
                focusRingClass
              )}
            >
              <Image
                src={imageSrc}
                alt={perfume.name ?? "Perfume Bottle"}
                fill
                quality={75}
                className={CARD_IMAGE_COLOR_HOVER_CLASS}
                sizes="56px"
                style={
                  {
                    viewTransitionName: userBottleImageTransitionName(userPerfume.id),
                  } as React.CSSProperties
                }
              />
            </Link>
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                {inReview && <ReviewStatusBadge />}
                {statusBadge}
              </div>
              {houseName ? (
                <p className="break-words text-sm font-medium text-noir-gold-100">
                  {houseName}
                </p>
              ) : null}
              <Link
                href={bottleHref}
                className={styleMerge(
                  "block break-words font-headline text-base font-semibold text-noir-gold hover:text-noir-gold-100",
                  focusRingClass
                )}
              >
                {perfume.name}
              </Link>
              {bottleLabel && (
                <p className="text-xs text-noir-gold-100">{bottleLabel}</p>
              )}
              <p
                className="text-sm text-noir-cream md:hidden"
                title={listedHint}
                aria-label={listedAria}
              >
                {volumeInline}
              </p>
            </div>
          </div>

          <p className="hidden text-sm text-noir-cream md:block">
            {owned.kind === "known" ? `${ownedMlLabel} ml` : "—"}
          </p>
          <p
            className="hidden text-sm text-noir-cream md:block"
            title={listedHint}
            aria-label={listedAria}
          >
            {listedMlLabel} ml
          </p>

          <div className="md:justify-self-end md:w-auto">{actions}</div>
        </div>
      </li>
    )
  }

  return (
    <li
      data-collection-card
      className="group relative flex h-full w-full flex-col border border-noir-gold/40 bg-transparent p-3 transition-colors duration-300 hover:border-noir-gold"
    >
      {inReview && (
        <ReviewStatusBadge className="absolute left-2 top-2 z-10" />
      )}
      {statusBadge ? (
        <span className="absolute right-2 top-2 z-10">{statusBadge}</span>
      ) : null}

      <Link
        href={bottleHref}
        className={styleMerge("block min-w-0", focusRingClass)}
      >
        <div className="relative mb-3 h-40 w-full overflow-hidden bg-noir-black/40 sm:h-44">
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
          <p className="break-words text-sm font-semibold text-noir-gold-100">
            {houseName}
          </p>
        ) : null}
        <p className="mt-0.5 break-words font-headline text-xl font-semibold leading-snug text-noir-gold">
          {perfume.name}
        </p>
        {bottleLabel && (
          <p className="mt-1 text-xs text-noir-gold-100">{bottleLabel}</p>
        )}
      </Link>

      <p
        className="mt-2 text-sm text-noir-cream"
        title={listedHint}
        aria-label={listedAria}
      >
        {volumeInline}
      </p>

      <div className="mt-auto pt-4">{actions}</div>
    </li>
  )
})
CollectionGridItem.displayName = "CollectionGridItem"
