"use client"

import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"

import { CopyShareLinkButton } from "@/components/Atoms/CopyShareLinkButton"
import { ItemsSearchingFor } from "@/components/Containers/TraderProfile"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { PublicWishlistItem } from "@/models/wishlist.server"

type PublicWishlistClientProps = {
  traderId: string
  traderName: string
  items: PublicWishlistItem[]
  bannerImage: string
}

const PublicWishlistClient = ({
  traderId,
  traderName,
  items,
  bannerImage,
}: PublicWishlistClientProps) => {
  const t = useTranslations("wishlist.public")

  const wishlistItems = items.map(item => ({
    id: item.id,
    perfumeId: item.perfumeId,
    isPublic: item.isPublic,
    bottlePreference: item.bottlePreference,
    createdAt: item.createdAt.toISOString(),
    user: {
      id: traderId,
      firstName: traderName,
      lastName: "",
      username: "",
      email: "",
    },
    perfume: {
      ...item.perfume,
      image: item.perfume.image ?? undefined,
      perfumeHouse: item.perfume.perfumeHouse ?? undefined,
    },
  }))

  return (
    <section>
      <TitleBanner
        image={bannerImage}
        heading={t("heading", { traderName })}
        subheading={t("subheading")}
      >
        <div className="flex flex-col items-center gap-3">
          <p className="text-lg font-semibold text-noir-gold-500">
            {t("itemCount", { count: items.length })}
          </p>
          <CopyShareLinkButton sharePath={`/wishlist/${traderId}`} />
          <Link
            href={`/trader-profile/${traderId}`}
            className="text-sm text-noir-gold-100 underline hover:text-noir-gold"
          >
            {t("viewProfile")}
          </Link>
        </div>
      </TitleBanner>

      <div className="inner-container p-6">
        {items.length === 0 ? (
          <p className="text-center text-noir-gold-100">{t("empty")}</p>
        ) : (
          <ItemsSearchingFor wishlistItems={wishlistItems} />
        )}
      </div>
    </section>
  )
}

export default PublicWishlistClient
