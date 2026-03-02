import { useState } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { Link } from "next-view-transitions"
import { IoMdCloseCircle } from "react-icons/io"

import VooDooCheck from "@/components/Atoms/VooDooCheck/VooDooCheck"
import { useToggleWishlist } from "@/lib/mutations/wishlist"
import { styleMerge } from "@/utils/styleUtils"

import {
  wishlistAddedVariants,
  wishlistHouseVariants,
  wishlistVariants,
  wishlistVisibilityVariants,
} from "./wishlist-variants"
import WishListAvailabilityInfo from "./WishlistAvbalibilityInfo"

interface WishlistItemCardProps {
  item: any
  isAvailable: boolean
  availableAmount: number
  onRemove?: () => void
}

const WishlistItemCard = ({
  item,
  isAvailable,
  availableAmount,
  onRemove,
}: WishlistItemCardProps) => {
  const [isPublic, setIsPublic] = useState(item.isPublic)
  const t = useTranslations("wishlist.itemCard")
  const toggleWishlist = useToggleWishlist()

  const handleRemove = () => {
    toggleWishlist.mutate(
      { perfumeId: item.perfume.id, action: "remove" },
      { onSuccess: () => onRemove?.() }
    )
  }

  const handleVisibilityToggle = async () => {
    const newVisibility = !isPublic
    
    toggleWishlist.mutate(
      {
        perfumeId: item.perfume.id,
        action: "updateVisibility",
        isPublic: newVisibility,
      },
      {
        onSuccess: () => {
          setIsPublic(newVisibility)
        },
        onError: error => {
          console.error("Error updating wishlist visibility:", error)
          // The mutation's optimistic update will rollback on error
        },
      }
    )
  }

  return (
    <div className={styleMerge(wishlistVariants({ isAvailable }))}>
      <div className="absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={handleRemove}
          disabled={toggleWishlist.isPending}
          className="group flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-colors duration-200 hover:bg-red-600 disabled:opacity-50"
          title="Remove from wishlist"
        >
          <IoMdCloseCircle />
        </button>
      </div>

      {isAvailable && (
        <div className="bg-noir-light text-noir-dark text-xs font-bold px-3 py-1 text-center animate-pulse">
          {t("available")}
        </div>
      )}
      <Image
        src={item.perfume.image || "/placeholder-perfume.jpg"}
        alt={item.perfume.name}
        width={400}
        height={192}
        quality={75}
        className="h-48 w-full object-cover"
        sizes="(max-width: 640px) 100vw, 50vw"
      />
      <div>
        <h3 className="text-lg font-semibold mb-2 bg-noir-dark p-2">
          {item.perfume.name}
        </h3>
        <div className="px-4 pb-2">
          <p className={styleMerge(wishlistHouseVariants({ isAvailable }))}>
            by {item.perfume.perfumeHouse?.name || "Unknown House"}
          </p>

          {isAvailable && (
            <WishListAvailabilityInfo
              userPerfumes={item.perfume.userPerfume}
              availableAmount={availableAmount}
              perfumeName={item.perfume.name}
            />
          )}

          <div className="flex items-center justify-between mt-4">
            <span className={styleMerge(wishlistAddedVariants({ isAvailable }))}>
              Added on {new Date(item.createdAt).toLocaleDateString("en-US")}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={`/perfume/${item.perfume.slug}`}
                className="text-sm font-medium text-noir-blue/90 hover:text-noir-blue"
              >
                View Details
              </Link>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-noir-gold-200">
            <div className="flex items-center justify-between pb-4">
              <span
                className={styleMerge(wishlistVisibilityVariants({ isAvailable }))}
              >
                {t("visibility")}:
              </span>
              <VooDooCheck
                checked={isPublic}
                onChange={handleVisibilityToggle}
                labelChecked={t("public")}
                labelUnchecked={t("private")}
              />
            </div>
            <p className={styleMerge(wishlistVisibilityVariants({ isAvailable }))}>
              {isPublic
                ? t("availableMessage")
                : t("unavailableMessage")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WishlistItemCard
