"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import { VooDooLink } from "@/components/Atoms/Button/Button"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import WishlistItemCard from "@/components/Organisms/WishlistItemCard/WishlistItemCard"

/** Shape of a single wishlist item as returned by getUserWishlist (serializable from server). */
export type WishlistItemForClient = {
  id: string
  userId: string
  perfumeId: string
  isPublic: boolean
  createdAt: Date
  perfume: {
    id: string
    name: string
    slug: string
    image: string | null
    perfumeHouse: { id: string; name: string; slug: string } | null
    userPerfume: Array<{
      id: string
      perfumeId: string
      available: string | null
      userId: string
      user: { id: string; firstName: string | null; lastName: string | null; username: string | null; email: string }
    }>
  }
}

type WishlistPageClientProps = {
  wishlist: WishlistItemForClient[]
  bannerImage: string
}

const WishlistPageClient = ({
  wishlist,
  bannerImage,
}: WishlistPageClientProps) => {
  const t = useTranslations("wishlist")
  const router = useRouter()

  return (
    <section>
      <TitleBanner
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <p className="mx-auto block max-w-max rounded-lg text-lg font-semibold text-noir-gold-500 shadow-md">
          {wishlist.length} {t("itemsInWishlist")}
        </p>
      </TitleBanner>

      {wishlist.length === 0 ? (
        <div className="noir-border mx-auto my-6 flex max-w-max flex-col items-center justify-center gap-4 p-4 text-center">
          <h2>{t("empty.heading")}</h2>
          <p className="text-xl text-noir-gold-100">{t("empty.subheading")}</p>
          <VooDooLink
            url="/all-perfumes"
            className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Browse Perfumes
          </VooDooLink>
        </div>
      ) : (
        <div className="inner-container grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {wishlist.map((item) => {
            const isAvailable = item.perfume.userPerfume.length > 0
            const availableAmount = item.perfume.userPerfume.reduce(
              (total, userPerfume) =>
                total + parseFloat(userPerfume.available || "0"),
              0
            )
            return (
              <WishlistItemCard
                key={item.id}
                item={item}
                isAvailable={isAvailable}
                availableAmount={availableAmount}
                onRemove={() => router.refresh()}
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

export default WishlistPageClient
