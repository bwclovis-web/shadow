"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { FaWandSparkles } from "react-icons/fa6"

import { Button } from "@/components/Atoms/Button"
import { TradeComposerModal } from "@/components/Containers/Trade/TradeComposerModal"
import { ExchangePerfumeCard } from "@/components/Molecules/ExchangePerfumeCard"
import { TradeMatchReasonLine } from "@/components/Molecules/TradeMatchReasonLine"
import Modal from "@/components/Organisms/Modal"
import { useTradeComposerModal } from "@/hooks/useTradeComposerModal"
import type { OnboardingTraderMatchEnriched } from "@/services/trade-match"
import type { TraderReputationV1 } from "@/services/reputation/types"
import {
  getTradeCtaLabelKey,
  tradeListingSeedFromExchangeRow,
} from "@/types/trade"

type PalateRecommendationsSectionProps = {
  matches: OnboardingTraderMatchEnriched[]
  viewerId: string
  traderReputationByUserId?: Record<string, TraderReputationV1>
}

const PalateRecommendationsSection = ({
  matches,
  viewerId,
  traderReputationByUserId = {},
}: PalateRecommendationsSectionProps) => {
  const t = useTranslations("tradingPost.palateRecommendations")
  const tTradeComposer = useTranslations("tradeComposer")
  const tRep = useTranslations("tradingPost.reputation")
  const {
    composerData,
    modalOpen: composerModalOpen,
    openComposer,
    closeComposer,
  } = useTradeComposerModal()

  const handlePropose = useCallback(
    (match: OnboardingTraderMatchEnriched, trigger: HTMLButtonElement | null) => {
      openComposer(
        {
          seed: tradeListingSeedFromExchangeRow(
            {
              id: match.userPerfumeId,
              userId: match.counterpartyId,
              available: match.available,
              type: null,
              tradePreference: match.tradePreference,
              tradeOnly: match.tradeOnly,
              price: match.price,
              tradePrice: match.tradePrice,
              images: match.images,
              condition: match.condition,
              decantFormat: match.decantFormat,
              mlRemaining: match.mlRemaining,
              user: {
                id: match.counterpartyId,
                firstName: null,
                lastName: null,
                username: null,
                email: null,
              },
            },
            {
              perfumeId: match.perfumeId,
              perfumeName: match.perfumeName,
              perfumeHouse: match.perfumeHouse,
              perfumeImage: match.perfumeImage,
            }
          ),
          counterpartyDisplayName: match.counterpartyDisplayName,
        },
        trigger
      )
    },
    [openComposer]
  )

  if (matches.length === 0) return null

  return (
    <section
      className="noir-border rounded-md border-noir-gold/40 bg-noir-dark/50 p-4"
      aria-labelledby="palate-recs-heading"
    >
      <div className="flex items-start gap-3">
        <FaWandSparkles
          className="mt-0.5 h-5 w-5 shrink-0 text-noir-gold"
          aria-hidden
        />
        <div>
          <h2
            id="palate-recs-heading"
            className="text-lg font-semibold text-noir-gold"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-noir-gold-100">{t("description")}</p>
        </div>
      </div>

      <ul className="mt-4 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {matches.map(match => {
          const reputation = traderReputationByUserId[match.counterpartyId]
          const cardPerfume = {
            id: match.perfumeId,
            name: match.perfumeName,
            slug: match.perfumeSlug,
            image: match.perfumeImage,
            perfumeHouse: match.perfumeHouse
              ? { id: "", name: match.perfumeHouse, slug: "", type: "" }
              : null,
            userPerfume: [
              {
                id: match.userPerfumeId,
                userId: match.counterpartyId,
                available: match.available,
                type: null,
                tradePreference: match.tradePreference,
                tradeOnly: match.tradeOnly,
                price: match.price,
                tradePrice: match.tradePrice,
                images: match.images,
                condition: match.condition,
                decantFormat: match.decantFormat,
                mlRemaining: match.mlRemaining,
                user: {
                  id: match.counterpartyId,
                  firstName: null,
                  lastName: null,
                  username: null,
                  email: null,
                },
              },
            ],
          }

          return (
            <li
              key={match.userPerfumeId}
              className="min-w-[min(100%,280px)] max-w-[280px] shrink-0 snap-start"
            >
              <ExchangePerfumeCard
                perfume={cardPerfume}
                viewerId={viewerId}
                enableSharedViewTransitions={false}
              >
                <div className="mt-2 space-y-2">
                  {match.matchExplanation ? (
                    <TradeMatchReasonLine reasons={match.matchExplanation.reasons} />
                  ) : null}
                  {reputation?.score != null ? (
                    <p className="text-xs text-noir-gold-500/80">
                      {tRep("exchangeTrust", { score: reputation.score })}
                    </p>
                  ) : null}
                  <p className="text-sm text-noir-gold-100">
                    {match.counterpartyDisplayName} · {match.available} ml
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    background="gold"
                    className="w-full max-w-full"
                    onClick={e => handlePropose(match, e.currentTarget)}
                  >
                    {tTradeComposer(
                      getTradeCtaLabelKey(match.tradePreference, match.tradeOnly)
                    )}
                  </Button>
                </div>
              </ExchangePerfumeCard>
            </li>
          )
        })}
      </ul>

      {composerData && composerModalOpen ? (
        <Modal innerType="dark" animateStart="top">
          <TradeComposerModal
            data={composerData}
            onClose={closeComposer}
            onViewProfileClick={closeComposer}
            traderReputationByUserId={traderReputationByUserId}
          />
        </Modal>
      ) : null}
    </section>
  )
}

export default PalateRecommendationsSection
