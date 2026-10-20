"use client"

import Image from "next/image"
import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"
import { useRef } from "react"

import { useGsapStagger } from "@/hooks/useGsapStagger"
import {
  CARD_STAGGER_DEFAULT,
  CARD_THUMB_HOVER_CLASS,
} from "@/utils/card-motion"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"

interface WishlistItem {
  id: string
  perfumeId: string
  isPublic: boolean
  bottlePreference: "sample" | "partial" | "full" | "any"
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    username: string
  }
  perfume: {
    id: string
    name: string
    slug?: string
    image?: string
    perfumeHouse?: {
      id: string
      name: string
    }
  }
}

interface ItemsSearchingForProps {
  wishlistItems: WishlistItem[]
}

const ItemsSearchingFor = ({ wishlistItems }: ItemsSearchingForProps) => {
  const t = useTranslations("traderProfile")
  const tBottle = useTranslations("wishlist.bottlePreference")
  const listRef = useRef<HTMLUListElement>(null)
  const itemIds = wishlistItems.map(item => item.id).join(",")

  useGsapStagger(listRef, {
    selector: "[data-seeking-card]",
    deps: [itemIds],
    enabled: wishlistItems.length > 0,
    ...CARD_STAGGER_DEFAULT,
  })

  if (wishlistItems.length === 0) {
    return (
      <div className="mt-6 px-2">
        <p className="text-noir-gold-100 italic">{t("noItemsSearchingFor")}</p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <ul ref={listRef} className="space-y-4">
        {wishlistItems.map(item => {
          const thumb = normalizeRemoteImageSrc(item.perfume.image)
          const href = item.perfume.slug
            ? `/perfume/${item.perfume.slug}`
            : undefined
          const name = (
            <h3 className="font-serif text-lg font-medium leading-tight text-noir-gold md:text-xl">
              {item.perfume.name}
            </h3>
          )
          return (
            <li
              key={item.id}
              data-seeking-card
              className="group relative flex items-center gap-3 rounded border border-noir-gold bg-noir-gold/10 p-3 transition-colors duration-300 hover:border-noir-gold"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center overflow-hidden rounded bg-noir-black">
                {thumb ? (
                  <Image
                    src={thumb}
                    alt={item.perfume.name}
                    fill
                    quality={70}
                    className={CARD_THUMB_HOVER_CLASS}
                    sizes="48px"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                {href ? (
                  <Link
                    href={href}
                    className="hover:underline underline-offset-2"
                  >
                    {name}
                  </Link>
                ) : (
                  name
                )}
                {item.perfume.perfumeHouse && (
                  <p className="text-sm text-noir-gold-100">
                    by {item.perfume.perfumeHouse.name}
                  </p>
                )}
                <p className="mt-1 text-sm text-noir-gold-200">
                  {t("wishlistBottleSeeking", {
                    preference: tBottle(item.bottlePreference),
                  })}
                </p>
              </div>
              <div className="absolute bottom-0 right-1 flex-shrink-0">
                <p className="text-xs text-noir-gold-500">
                  Added {new Date(item.createdAt).toLocaleDateString("en-US")}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default ItemsSearchingFor
