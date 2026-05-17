"use client"

import { useTranslations } from "next-intl"
import { FaHandshake } from "react-icons/fa6"

import type { TraderWishlistOverlap } from "@/models/wishlist-matching.server"

type TraderWishlistOverlapBannerProps = {
  overlap: TraderWishlistOverlap
  traderName: string
}

const TraderWishlistOverlapBanner = ({
  overlap,
  traderName,
}: TraderWishlistOverlapBannerProps) => {
  const t = useTranslations("traderProfile.wishlistOverlap")
  const perfumeList = overlap.matchingPerfumes.map(p => p.name).join(", ")

  return (
    <div
      className="noir-border mb-4 rounded-md border-noir-gold/50 bg-noir-gold/10 px-4 py-3"
      role="status"
      data-testid="trader-wishlist-overlap-banner"
    >
      <div className="flex items-start gap-3">
        <FaHandshake
          className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold"
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-noir-gold">
            {t("title")}
          </p>
          <p className="mt-1 text-sm text-noir-gold-100 leading-snug">
            {t("body", { traderName, perfumes: perfumeList })}
          </p>
        </div>
      </div>
    </div>
  )
}

export default TraderWishlistOverlapBanner
