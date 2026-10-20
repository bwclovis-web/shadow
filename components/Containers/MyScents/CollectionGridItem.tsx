"use client"

import { memo } from "react"
import Image from "next/image"
import { Link } from "next-view-transitions"

import ReviewStatusBadge from "@/components/Atoms/ReviewStatusBadge"
import { getPerfumeTypeLabel } from "@/data/SelectTypes"
import { getInventoryListingStatus } from "@/lib/user-inventory"
import type { UserPerfumeForClient } from "@/types/my-scents-client"
import { CARD_IMAGE_HOVER_CLASS } from "@/utils/card-motion"
import { normalizeRemoteImageSrc, styleMerge, validImageRegex } from "@/utils/styleUtils"
import { userBottleImageTransitionName } from "@/utils/view-transition-names"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"

const buildBottleLabel = (up: UserPerfumeForClient, bottleCount: number): string | null => {
  if (bottleCount < 2) return null
  const typeLabel = getPerfumeTypeLabel(up.type ?? undefined)
  const amtNum = parseFloat((up.amount ?? "").replace(/[^0-9.]/g, "") || "0")
  const amtStr = up.amount && up.amount !== "0" && !isNaN(amtNum) ? `${amtNum.toFixed(1)} ml` : null
  const parts = [typeLabel, amtStr].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : null
}

export type CollectionGridItemProps = {
  userPerfume: UserPerfumeForClient
  basePath: string
  bottleCount: number
  listingStatus: ReturnType<typeof getInventoryListingStatus>
  inReview: boolean
  listingStatusLabel: string
}

export const CollectionGridItem = memo(({
  userPerfume,
  basePath,
  bottleCount,
  listingStatus,
  inReview,
  listingStatusLabel,
}: CollectionGridItemProps) => {
  const { perfume } = userPerfume
  const normalized = normalizeRemoteImageSrc(perfume.image)
  const imageSrc =
    normalized && !validImageRegex.test(normalized)
      ? normalized
      : BOTTLE_PLACEHOLDER
  const bottleLabel = buildBottleLabel(userPerfume, bottleCount)

  return (
    <li
      data-collection-card
      className="group relative flex flex-col items-center justify-center border-4 border-double border-noir-gold p-1 transition-colors duration-300 hover:border-noir-gold"
    >
      {inReview && (
        <ReviewStatusBadge className="absolute left-1 top-1 z-10" />
      )}
      <span
        className={styleMerge(
          "absolute right-1 top-1 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
          listingStatus === "listed"
            ? "bg-noir-gold/80 text-noir-black"
            : listingStatus === "partiallyListed"
              ? "bg-noir-gold-500/70 text-noir-black"
              : "bg-noir-black/80 text-noir-gold-500"
        )}
      >
        {listingStatusLabel}
      </span>
      <Link href={`${basePath}/${userPerfume.id}`} className="block">
        <div className="relative mx-auto mb-2 h-48 w-48 overflow-hidden rounded-lg">
          <Image
            src={imageSrc}
            alt={perfume.name ?? "Perfume Bottle"}
            priority={false}
            fill
            quality={75}
            className={CARD_IMAGE_HOVER_CLASS}
            sizes="(max-width: 768px) 50vw, 33vw"
            style={
              {
                viewTransitionName: userBottleImageTransitionName(userPerfume.id),
              } as React.CSSProperties
            }
          />
        </div>
        <span className="text-noir-gold">{perfume.name}</span>
        {bottleLabel && (
          <span className="mt-1 block text-xs text-noir-gold-100">
            {bottleLabel}
          </span>
        )}
      </Link>
    </li>
  )
})
CollectionGridItem.displayName = "CollectionGridItem"
