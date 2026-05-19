"use client"

import Image from "next/image"
import { useTranslations } from "next-intl"
import { LuUsers } from "react-icons/lu"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { TraderAvatar } from "@/components/Molecules/TraderAvatar"
import { TradeMatchReasonLine } from "@/components/Molecules/TradeMatchReasonLine"
import type { TraderWantingUserListingEnriched } from "@/services/trade-match"
import { normalizeRemoteImageSrc } from "@/utils/styleUtils"
import { getTraderDisplayName } from "@/utils/user"

const BOTTLE_PLACEHOLDER = "/images/single-bottle.webp"

type WishlistDemandSectionProps = {
  demand: TraderWantingUserListingEnriched[]
}

const WishlistDemandSection = ({ demand }: WishlistDemandSectionProps) => {
  const t = useTranslations("myScents.wishlistDemand")

  if (demand.length === 0) return null

  return (
    <section
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
        {demand.map(row => {
          const traderName = getTraderDisplayName(row.trader)
          return (
            <li
              key={row.trader.id}
              className="rounded-md border border-noir-gold/30 bg-noir-gold/5 p-3"
            >
              <PrefetchLink
                href={`/trader-profile/${row.trader.id}`}
                className="flex items-center gap-3 hover:opacity-90"
              >
                <TraderAvatar
                  displayName={traderName}
                  avatarImage={row.trader.avatarImage}
                  size="sm"
                />
                <span className="font-medium text-noir-gold">{traderName}</span>
              </PrefetchLink>
              {row.matchExplanation ? (
                <div className="mt-2">
                  <TradeMatchReasonLine
                    reasons={row.matchExplanation.reasons}
                    primaryReasons={row.matchExplanation.primaryReasons}
                    translationNamespace="myScents.wishlistDemand.matchReason"
                  />
                </div>
              ) : null}
              <ul className="mt-3 flex flex-wrap gap-2">
                {row.perfumes.map(perfume => {
                  const thumb = normalizeRemoteImageSrc(perfume.image)
                  return (
                    <li
                      key={perfume.id}
                      className="flex items-center gap-2 rounded border border-noir-gold/20 bg-noir-black/40 px-2 py-1 text-sm text-noir-gold-100"
                    >
                      <Image
                        src={thumb ?? BOTTLE_PLACEHOLDER}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded object-cover"
                        sizes="32px"
                      />
                      <span>{perfume.name}</span>
                    </li>
                  )
                })}
              </ul>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default WishlistDemandSection
