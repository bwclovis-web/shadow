import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { IoMdCloseCircle } from "react-icons/io"

import VooDooCheck from "@/components/Atoms/VooDooCheck/VooDooCheck"
import {
  useToggleWishlist,
  WISHLIST_BOTTLE_PREFERENCE_OPTIONS,
  type WishlistBottlePreference,
} from "@/lib/mutations/wishlist"
import { normalizeRemoteImageSrc, styleMerge } from "@/utils/styleUtils"

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
  const [bottlePreference, setBottlePreference] = useState<WishlistBottlePreference>(
    item.bottlePreference ?? "any"
  )
  const t = useTranslations("wishlist.itemCard")
  const tBottle = useTranslations("wishlist.bottlePreference")
  const toggleWishlist = useToggleWishlist()

  useEffect(() => {
    setBottlePreference(item.bottlePreference ?? "any")
  }, [item.bottlePreference])

  const handleRemove = () => {
    toggleWishlist.mutate(
      { perfumeId: item.perfume.id, action: "remove" },
      { onSuccess: () => onRemove?.() }
    )
  }

  const handleBottlePreferenceChange = (next: WishlistBottlePreference) => {
    if (next === bottlePreference) return
    toggleWishlist.mutate(
      {
        perfumeId: item.perfume.id,
        action: "updateBottlePreference",
        bottlePreference: next,
      },
      {
        onSuccess: () => setBottlePreference(next),
        onError: error =>
          console.error("Error updating wishlist bottle preference:", error),
      }
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
        src={normalizeRemoteImageSrc(item.perfume.image) || "/placeholder-perfume.jpg"}
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
            />
          )}

          <div className="flex items-center justify-between mt-4">
            <span className={styleMerge(wishlistAddedVariants({ isAvailable }))}>
              Added on {new Date(item.createdAt).toLocaleDateString("en-US")}
            </span>
            <div className="flex items-center gap-2">
              <PrefetchLink
                href={`/perfume/${item.perfume.slug}`}
                prefetch={false}
                className="text-sm font-medium text-noir-blue/90 hover:text-noir-blue"
              >
                View Details
              </PrefetchLink>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-noir-gold-200">
            <div className="pb-4">
              <label
                htmlFor={`wishlist-bottle-${item.id}`}
                className={styleMerge(
                  wishlistVisibilityVariants({ isAvailable })
                )}
              >
                {t("bottlePreference")}
              </label>
              <select
                id={`wishlist-bottle-${item.id}`}
                value={bottlePreference}
                onChange={e =>
                  handleBottlePreferenceChange(
                    e.target.value as WishlistBottlePreference
                  )
                }
                disabled={toggleWishlist.isPending}
                className="mt-1 w-full rounded border border-noir-gold bg-noir-dark px-2 py-1.5 text-sm text-noir-cream disabled:opacity-50"
              >
                {WISHLIST_BOTTLE_PREFERENCE_OPTIONS.map(v => (
                  <option key={v} value={v}>
                    {tBottle(v)}
                  </option>
                ))}
              </select>
            </div>
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
