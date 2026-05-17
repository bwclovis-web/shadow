"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { FaHeart } from "react-icons/fa6"

import type { WishlistExchangeMatchRow } from "@/models/wishlist-matching.server"
import { Button } from "@/components/Atoms/Button"
import { TradeComposerModal } from "@/components/Containers/Trade/TradeComposerModal"
import { useTradeComposerModal } from "@/hooks/useTradeComposerModal"
import LinkCard from "@/components/Organisms/LinkCard"
import Modal from "@/components/Organisms/Modal"
import type { TraderReputationV1 } from "@/services/reputation/types"
import {
  getTradeCtaLabelKey,
  isCashOnlyListing,
  tradeListingSeedFromExchangeRow,
} from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"

type WishlistMatchesSectionProps = {
  matches: WishlistExchangeMatchRow[]
  viewerId: string
  traderReputationByUserId?: Record<string, TraderReputationV1>
}

const WishlistMatchesSection = ({
  matches,
  viewerId,
  traderReputationByUserId = {},
}: WishlistMatchesSectionProps) => {
  const t = useTranslations("tradingPost.wishlistMatches")
  const tListings = useTranslations("tradingPost.listings")
  const tTradeComposer = useTranslations("tradeComposer")
  const {
    composerData,
    modalOpen: composerModalOpen,
    openComposer,
    openListingPicker,
    closeComposer,
  } = useTradeComposerModal()

  const handleProposeSwapFromCard = useCallback(
    (perfume: WishlistExchangeMatchRow, trigger: HTMLButtonElement | null) => {
      const listings = perfume.userPerfume.filter(up => up.userId !== viewerId)
      if (listings.length === 0) return

      const perfumeMeta = {
        perfumeId: perfume.id,
        perfumeName: perfume.name,
        perfumeHouse: perfume.perfumeHouse?.name,
        perfumeImage: perfume.image ?? null,
      }

      if (listings.length === 1) {
        const up = listings[0]!
        openComposer(
          {
            seed: tradeListingSeedFromExchangeRow(up, perfumeMeta),
            counterpartyDisplayName: getTraderDisplayName(up.user),
          },
          trigger
        )
        return
      }

      openListingPicker(listings, perfumeMeta, {
        trigger,
        traderReputationByUserId,
      })
    },
    [viewerId, openComposer, openListingPicker, traderReputationByUserId]
  )

  const getCardOfferCtaKey = (perfume: WishlistExchangeMatchRow) => {
    const listings = perfume.userPerfume.filter(up => up.userId !== viewerId)
    if (listings.length === 1) {
      const up = listings[0]!
      return getTradeCtaLabelKey(up.tradePreference, up.tradeOnly)
    }
    if (listings.every(up => isCashOnlyListing(up.tradePreference, up.tradeOnly))) {
      return "connectAboutBottle"
    }
    if (
      listings.every(
        up => !isCashOnlyListing(up.tradePreference, up.tradeOnly)
      )
    ) {
      return "proposeSwap"
    }
    return "chooseListing"
  }

  if (matches.length === 0) return null

  return (
    <section
      className="noir-border rounded-md border-noir-gold/40 bg-noir-gold/10 p-4"
      aria-labelledby="wishlist-matches-heading"
    >
      <div className="flex items-start gap-3">
        <FaHeart
          className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold"
          aria-hidden
        />
        <div>
          <h2
            id="wishlist-matches-heading"
            className="text-lg font-semibold text-noir-gold"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-noir-gold-100">{t("description")}</p>
        </div>
      </div>

      <ul className="mt-4 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {matches.map(perfume => (
          <li
            key={perfume.id}
            className="min-w-[min(100%,280px)] max-w-[280px] shrink-0 snap-start"
          >
            <LinkCard
              data={{
                ...perfume,
                image: perfume.image ?? undefined,
                perfumeHouse: perfume.perfumeHouse
                  ? { name: perfume.perfumeHouse.name }
                  : undefined,
              }}
              type="perfume"
            >
              <MatchCardFooter
                countLabel={tListings("summary", {
                  count: perfume.userPerfume.length,
                })}
                ctaLabel={tTradeComposer(getCardOfferCtaKey(perfume))}
                onOffer={trigger => handleProposeSwapFromCard(perfume, trigger)}
              />
            </LinkCard>
          </li>
        ))}
      </ul>

      {composerData && composerModalOpen ? (
        <Modal innerType="dark" animateStart="top">
          <TradeComposerModal
            data={composerData}
            onClose={closeComposer}
            onViewProfileClick={closeComposer}
            traderReputationByUserId={traderReputationByUserId}
            onListingPicked={init => {
              closeComposer()
              setTimeout(() => openComposer(init), 0)
            }}
          />
        </Modal>
      ) : null}
    </section>
  )
}

const MatchCardFooter = ({
  countLabel,
  ctaLabel,
  onOffer,
}: {
  countLabel: string
  ctaLabel: string
  onOffer: (trigger: HTMLButtonElement | null) => void
}) => (
  <div className="mt-2 space-y-2">
    <p className="text-sm font-medium text-noir-gold">{countLabel}</p>
    <Button
      type="button"
      variant="primary"
      size="sm"
      background="gold"
      className="w-full max-w-full"
      onClick={e => onOffer(e.currentTarget)}
    >
      {ctaLabel}
    </Button>
  </div>
)

export default WishlistMatchesSection
