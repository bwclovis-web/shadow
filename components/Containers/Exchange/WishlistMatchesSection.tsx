"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { FaHeart } from "react-icons/fa6"

import type { ExchangePerfumeRow } from "@/app/the-exchange/exchange-types"
import { OrnamentalFrame } from "@/components/Atoms/OrnamentalFrame"
import { TradeMatchReasonLine } from "@/components/Molecules/TradeMatchReasonLine"
import type { WishlistExchangeMatchEnriched } from "@/services/trade-match"
import { Button } from "@/components/Atoms/Button"
import { TradeComposerModal } from "@/components/Containers/Trade/TradeComposerModal"
import { useTradeComposerModal } from "@/hooks/useTradeComposerModal"
import { ExchangeFragranceGroupCard } from "@/components/Molecules/ExchangeFragranceGroupCard"
import Modal from "@/components/Organisms/Modal"
import type { TraderReputationV1 } from "@/services/reputation/types"
import {
  getTradeCtaLabelKey,
  isCashOnlyListing,
  tradeListingSeedFromExchangeRow,
} from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"

type WishlistMatchesSectionProps = {
  matches: WishlistExchangeMatchEnriched[]
  viewerId: string
  traderReputationByUserId?: Record<string, TraderReputationV1>
}

const toExchangeRow = (
  match: WishlistExchangeMatchEnriched,
  viewerId: string
): ExchangePerfumeRow => {
  const listings = match.userPerfume.filter(up => up.userId !== viewerId)
  return {
    id: match.id,
    name: match.name,
    slug: match.slug,
    image: match.image,
    perfumeHouse: match.perfumeHouse,
    userPerfume: listings.map(up => ({
      id: up.id,
      userId: up.userId,
      available: up.available,
      type: up.type,
      tradePreference: up.tradePreference,
      tradeOnly: up.tradeOnly,
      price: up.price,
      tradePrice: up.tradePrice,
      images: up.images,
      condition: up.condition,
      decantFormat: up.decantFormat,
      mlRemaining: up.mlRemaining,
      user: {
        id: up.user.id,
        firstName: up.user.firstName,
        lastName: up.user.lastName,
        username: up.user.username,
        email: up.user.email,
      },
    })),
    offerCount: listings.length,
    collectorCount: new Set(listings.map(up => up.userId)).size,
  }
}

const WishlistMatchesSection = ({
  matches,
  viewerId,
  traderReputationByUserId = {},
}: WishlistMatchesSectionProps) => {
  const t = useTranslations("tradingPost.wishlistMatches")
  const tTradeComposer = useTranslations("tradeComposer")
  const {
    composerData,
    modalOpen: composerModalOpen,
    openComposer,
    openListingPicker,
    closeComposer,
  } = useTradeComposerModal()

  const handleProposeSwapFromCard = useCallback(
    (perfume: WishlistExchangeMatchEnriched, trigger: HTMLButtonElement | null) => {
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
        matchExplanationByListingId: perfume.listingMatchExplanations,
      })
    },
    [viewerId, openComposer, openListingPicker, traderReputationByUserId]
  )

  const getCardOfferCtaKey = (perfume: WishlistExchangeMatchEnriched) => {
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
    <OrnamentalFrame
      as="section"
      size="standard"
      className="rounded-md bg-noir-gold/10 p-4"
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
            className="min-w-[min(100%,20rem)] w-[min(100%,20rem)] shrink-0 snap-start"
          >
            <ExchangeFragranceGroupCard
              perfume={toExchangeRow(perfume, viewerId)}
              onViewCollectors={() => undefined}
              viewCollectorsLabel=""
              openSplitSlot={
                perfume.matchExplanation ? (
                  <TradeMatchReasonLine reasons={perfume.matchExplanation.reasons} />
                ) : null
              }
              footer={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  background="gold"
                  className="w-full max-w-full"
                  onClick={e =>
                    handleProposeSwapFromCard(perfume, e.currentTarget)
                  }
                >
                  {tTradeComposer(getCardOfferCtaKey(perfume))}
                </Button>
              }
            />
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
    </OrnamentalFrame>
  )
}

export default WishlistMatchesSection
