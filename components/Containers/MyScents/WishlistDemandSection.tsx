"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { type CSSProperties, useMemo, useRef } from "react"
import { LuUsers } from "react-icons/lu"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { TraderAvatar } from "@/components/Molecules/TraderAvatar"
import { TradeMatchReasonLine } from "@/components/Molecules/TradeMatchReasonLine"
import { useGsapStagger } from "@/hooks/useGsapStagger"
import type { TraderWantingUserListingEnriched } from "@/services/trade-match"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"
import { getTraderDisplayName } from "@/utils/user"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"

type WishlistDemandSectionProps = {
  demand: TraderWantingUserListingEnriched[]
}

type WishlistDemandRowProps = {
  row: TraderWantingUserListingEnriched
  rowIndex: number
}

const buildRevealStyle = (
  rowIndex: number,
  baseDelayMs: number
): CSSProperties => ({
  animationDelay: `${rowIndex * 80 + baseDelayMs}ms`,
})

const WishlistDemandRow = ({ row, rowIndex }: WishlistDemandRowProps) => {
  const traderName = getTraderDisplayName(row.trader)

  return (
    <li
      key={row.trader.id}
      data-demand-row
      className="rounded-md border border-noir-gold/30 bg-noir-gold/5 p-3 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out motion-safe:hover:-translate-y-0.5 hover:border-noir-gold/45 hover:bg-noir-gold/10 hover:shadow-lg hover:shadow-noir-black/20"
    >
      <PrefetchLink
        href={`/trader-profile/${row.trader.id}`}
        className="flex items-center gap-3 hover:opacity-90 animate-fade-in-item"
        style={buildRevealStyle(rowIndex, 70)}
      >
        <TraderAvatar
          displayName={traderName}
          avatarImage={row.trader.avatarImage}
          size="sm"
        />
        <span className="font-medium text-noir-gold">{traderName}</span>
      </PrefetchLink>
      {row.matchExplanation ? (
        <div
          className="mt-2 animate-fade-in-item"
          style={buildRevealStyle(rowIndex, 140)}
        >
          <TradeMatchReasonLine
            reasons={row.matchExplanation.reasons}
            translationNamespace="myScents.wishlistDemand.matchReason"
          />
        </div>
      ) : null}
      <ul className="mt-3 flex flex-wrap gap-2">
        {row.perfumes.map((perfume, perfumeIndex) => {
          const thumb = normalizeRemoteImageSrc(perfume.image)
          return (
            <li
              key={perfume.id}
              className="group flex items-center gap-2 rounded border border-noir-gold/20 bg-noir-black/40 px-2 py-1 text-sm text-noir-gold-100 transition-[transform,background-color,border-color,box-shadow] duration-300 ease-out motion-safe:hover:-translate-y-0.5 hover:border-noir-gold/35 hover:bg-noir-black/60 hover:shadow-md hover:shadow-noir-black/20 animate-fade-in-item"
              style={buildRevealStyle(rowIndex, 210 + perfumeIndex * 40)}
            >
              <Image
                src={thumb ?? BOTTLE_PLACEHOLDER}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded object-cover transition-[transform,filter] duration-300 ease-out motion-safe:group-hover:scale-105 group-hover:brightness-110"
                sizes="32px"
              />
              <span>{perfume.name}</span>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

const WishlistDemandSection = ({ demand }: WishlistDemandSectionProps) => {
  const t = useTranslations("myScents.wishlistDemand")
  const sectionRef = useRef<HTMLElement>(null)
  const demandSignature = useMemo(
    () =>
      demand
        .map(row => `${row.trader.id}:${row.perfumes.map(perfume => perfume.id).join(",")}`)
        .join("|"),
    [demand]
  )

  useGsapStagger(sectionRef, {
    selector: "[data-demand-row]",
    deps: [demandSignature],
    enabled: demand.length > 0,
    stagger: 0.08,
    from: { opacity: 0, y: 18 },
    to: {
      opacity: 1,
      y: 0,
      duration: 0.45,
      clearProps: "transform,opacity",
    },
  })

  if (demand.length === 0) return null

  return (
    <section
      ref={sectionRef}
      className="noir-border relative mx-auto my-6 max-w-6xl p-4 text-left"
      aria-labelledby="wishlist-demand-heading"
    >
      <div className="flex items-start gap-3 border-b border-noir-gold/30 pb-3">
        <LuUsers
          className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold"
          aria-hidden
        />
        <div>
          <h2
            id="wishlist-demand-heading"
            className="text-lg font-semibold text-noir-gold"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-noir-gold-100">{t("description")}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-4">
        {demand.map((row, rowIndex) => (
          <WishlistDemandRow
            key={row.trader.id}
            row={row}
            rowIndex={rowIndex}
          />
        ))}
      </ul>
    </section>
  )
}

export default WishlistDemandSection
