import Image from "next/image"
import type { CSSProperties } from "react"
import { FiArrowRight, FiChevronRight } from "react-icons/fi"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import ReviewStatusBadge from "@/components/Atoms/ReviewStatusBadge"
import { PerfumeCompareToggle } from "@/components/Molecules/PerfumeCompareToggle/PerfumeCompareToggle"
import type { CompareItem } from "@/hooks/compareStore"
import {
  CARD_IMAGE_HOVER_CLASS,
  CARD_THUMB_HOVER_CLASS,
} from "@/utils/card-motion"
import { normalizeRemoteImageSrc, validImageRegex } from "@/utils/styleUtils"

export type CatalogItemDisplay = {
  id: string
  href: string
  title: string
  subtitle?: string | null
  image: string | null
  fallbackImage: string
  imageAlt: string
  isPendingReview?: boolean
  /** Present for perfumes only. */
  compareItem?: CompareItem
  imageTransitionName?: string
  titleTransitionName?: string
}

const resolveImage = (item: CatalogItemDisplay): string => {
  const src = normalizeRemoteImageSrc(item.image)
  return src && !validImageRegex.test(src) ? src : item.fallbackImage
}

const transitionStyle = (name?: string): CSSProperties | undefined =>
  name ? ({ viewTransitionName: name } as CSSProperties) : undefined

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"

export const CatalogItemCard = ({
  item,
  imagePriority = false,
}: {
  item: CatalogItemDisplay
  imagePriority?: boolean
}) => (
  <article className="group relative flex h-full flex-col overflow-hidden border border-noir-gold/70 bg-noir-dark shadow-lg shadow-black/40 transition-colors duration-300 hover:border-noir-gold">
    <PrefetchLink
      href={item.href}
      prefetch={false}
      transitionVariant="list-to-detail"
      className={`flex h-full flex-col ${focusRing}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-noir-black">
        <Image
          src={resolveImage(item)}
          alt={item.imageAlt}
          fill
          priority={imagePriority}
          quality={75}
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 48vw"
          className={CARD_IMAGE_HOVER_CLASS}
          style={transitionStyle(item.imageTransitionName)}
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 border-t border-noir-gold/60 px-3 py-2.5 md:px-4 md:py-3">
        <h3
          className="!text-lg leading-tight wrap-break-word md:!text-xl"
          style={transitionStyle(item.titleTransitionName)}
        >
          {item.title}
        </h3>
        {item.subtitle ? (
          <p className="text-xs leading-snug text-noir-gold-100 md:text-sm">
            {item.subtitle}
          </p>
        ) : null}
        {item.isPendingReview ? (
          <div className="mt-1">
            <ReviewStatusBadge />
          </div>
        ) : null}
      </div>
    </PrefetchLink>
    {item.compareItem ? (
      <div className="pointer-events-none absolute inset-x-0 top-0 aspect-[4/3]">
        <PerfumeCompareToggle item={item.compareItem} />
      </div>
    ) : null}
  </article>
)

export const CatalogItemRow = ({
  item,
  actionLabel,
}: {
  item: CatalogItemDisplay
  actionLabel: string
}) => (
  <article className="group flex items-center gap-2 border border-noir-gold/60 bg-noir-dark pr-2 transition-colors duration-300 hover:border-noir-gold md:border-x-0 md:border-t-0 md:border-noir-gold/25 md:bg-transparent md:pr-0 md:hover:bg-noir-dark/40">
    <PrefetchLink
      href={item.href}
      prefetch={false}
      transitionVariant="list-to-detail"
      className={`flex min-w-0 flex-1 items-center gap-3 md:gap-5 md:py-2 ${focusRing}`}
    >
      <div className="relative size-16 shrink-0 overflow-hidden bg-noir-black md:size-14">
        <Image
          src={resolveImage(item)}
          alt={item.imageAlt}
          fill
          quality={70}
          sizes="64px"
          className={CARD_THUMB_HOVER_CLASS}
          style={transitionStyle(item.imageTransitionName)}
        />
      </div>
      <div className="min-w-0 flex-1 py-2 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] md:items-center md:gap-6 md:py-0">
        <div className="min-w-0">
          <h3
            className="!text-lg leading-tight md:!text-2xl"
            style={transitionStyle(item.titleTransitionName)}
          >
            {item.title}
          </h3>
          {item.isPendingReview ? (
            <div className="mt-1">
              <ReviewStatusBadge />
            </div>
          ) : null}
        </div>
        {item.subtitle ? (
          <p className="mt-0.5 truncate text-xs text-noir-gold-100 md:mt-0 md:text-sm">
            {item.subtitle}
          </p>
        ) : null}
      </div>
      <span className="hidden shrink-0 items-center gap-2 pr-2 text-sm font-medium text-noir-gold md:inline-flex">
        {actionLabel}
        <FiArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
      <FiChevronRight
        className="h-5 w-5 shrink-0 text-noir-gold md:hidden"
        aria-hidden
      />
    </PrefetchLink>
    {item.compareItem ? (
      <div className="relative h-12 w-12 shrink-0">
        <PerfumeCompareToggle item={item.compareItem} />
      </div>
    ) : null}
  </article>
)
