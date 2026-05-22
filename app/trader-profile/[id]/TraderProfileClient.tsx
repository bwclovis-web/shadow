"use client"

import { useTranslations } from "next-intl"

import TitleBanner from "@/components/Organisms/TitleBanner"
import VooDooDetails from "@/components/Atoms/VooDooDetails"
import {
  ItemsSearchingFor,
  ItemsToTrade,
} from "@/components/Containers/TraderProfile"
import { TraderAvatar } from "@/components/Molecules/TraderAvatar"
import { useTrader } from "@/hooks/useTrader"
import type { TraderResponse } from "@/lib/queries/user"
import type { TraderFeedbackResponse } from "@/lib/queries/traderFeedback"
import TraderProfileTrades from "@/components/Containers/TraderProfile/TraderProfileTrades/TraderProfileTrades"
import type { SafeUser, UserPerfumeI } from "@/types"
import type { TradeForClient } from "@/types/trade"
import { getTraderDisplayName } from "@/utils/user"
import TraderProfileHeaderStats from "@/components/Containers/TraderProfile/TraderProfileHeaderStats"
import TraderWishlistOverlapBanner from "@/components/Containers/TraderProfile/TraderWishlistOverlapBanner"
import { CopyShareLinkButton } from "@/components/Molecules/CopyShareLinkButton"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { ScentJourneyTimeline } from "@/components/Containers/TraderProfile/ScentJourneyTimeline"
import type { ScentDnaSnapshot } from "@/models/scent-dna.server"
import type { ScentJourneyItem } from "@/models/scent-journey.server"
import type { TraderWishlistOverlap } from "@/models/wishlist-matching.server"
import { DESKTOP_MEDIA } from "@/constants/breakpoints"
import { TraderProfileAside } from "./aside/aside"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

const BANNER_IMAGE = "/images/trade.webp"

type TraderProfileClientProps = {
  initialTrader: TraderResponse
  viewer: SafeUser | null
  feedback: TraderFeedbackResponse
  activeTrades?: TradeForClient[]
  wishlistOverlap?: TraderWishlistOverlap | null
  scentDna: ScentDnaSnapshot
  initialFollowing?: boolean
  followerCount?: number
  scentJourney?: ScentJourneyItem[]
  scentJourneyHasMore?: boolean
}

export default function TraderProfileClient({
  initialTrader,
  viewer,
  feedback,
  activeTrades = [],
  wishlistOverlap = null,
  scentDna,
  initialFollowing = false,
  followerCount = 0,
  scentJourney = [],
  scentJourneyHasMore = false,
}: TraderProfileClientProps) {
  const { data: trader } = useTrader(initialTrader.id, initialTrader)
  const t = useTranslations("traderProfile")
  const isLgView = useMediaQuery(DESKTOP_MEDIA)

  if (!trader) {
    return (
      <div className="p-4">
        Trader not found
      </div>
    )
  }

  const traderName = getTraderDisplayName(trader)
  const memberSince =
    typeof trader.createdAt === "string"
      ? trader.createdAt
      : trader.createdAt instanceof Date
        ? trader.createdAt.toISOString()
        : new Date().toISOString()

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading", { traderName })}
        subheading={t("subheading", { traderName })}
      >
        <TraderAvatar
          displayName={traderName}
          avatarImage={trader.avatarImage}
          size="lg"
        />
        <TraderProfileHeaderStats
          memberSince={memberSince}
          completedTradeCount={feedback.reputation.completedTradeCount}
          followerCount={followerCount}
          lastActiveAt={
            (trader as { lastActiveAt?: Date | string | null }).lastActiveAt ?? null
          }
          reputationBadges={feedback.reputation.badges}
          contributorBadges={feedback.contributorBadges}
        />
        <CopyShareLinkButton
          sharePath={`/trader-profile/${trader.id}`}
          className="mt-4 justify-center"
        />
      </TitleBanner>

      <PageWrapper>
      <div className="grid grid-cols-1 items-start gap-8 px-6 md:grid-cols-2 xl:grid-cols-3">
        {isLgView ? (
          <TraderProfileAside
            trader={trader}
            viewer={viewer}
            feedback={feedback}
            initialFollowing={initialFollowing}
            scentDna={scentDna}
            traderName={traderName}
          />
        ) : (
          <VooDooDetails
            type="primary"
            name="traderProfileAside"
            summary={t("traderProfileAside", { traderName })}
            background="dark"
            defaultOpen={false}
          >
            <div className="py-4">
              <TraderProfileAside
                trader={trader}
                viewer={viewer}
                feedback={feedback}
                initialFollowing={initialFollowing}
                scentDna={scentDna}
                traderName={traderName}
              />
            </div>
          </VooDooDetails>
        )}

        <div className="flex flex-col gap-4 md:col-span-2 xl:col-span-2">
          {wishlistOverlap && viewer?.id ? (
            <TraderWishlistOverlapBanner
              overlap={wishlistOverlap}
              traderName={traderName}
            />
          ) : null}
          {activeTrades.length > 0 && viewer?.id ? (
            <TraderProfileTrades
              activeTrades={activeTrades}
              viewerId={viewer.id}
            />
          ) : null}

          <div className="noir-border relative p-4">
            <h2 className="mb-2 text-center">{t("scentJourney.title")}</h2>
            <VooDooDetails
              type="primary"
              name="scentJourney"
              summary={t("scentJourney.summary", { traderName })}
              background="dark"
              defaultOpen={scentJourney.length > 0}
            >
              <ScentJourneyTimeline
                items={scentJourney}
                traderId={trader.id}
                viewerId={viewer?.id ?? null}
              />
              {scentJourneyHasMore ? (
                <p className="mt-4 text-center">
                  <PrefetchLink
                    href={`/trader-profile/${trader.id}/scent-journey`}
                    className="text-sm font-medium text-noir-gold underline-offset-2 hover:underline"
                  >
                    {t("scentJourney.viewFull")}
                  </PrefetchLink>
                </p>
              ) : null}
            </VooDooDetails>
          </div>

          <div className="noir-border relative p-4">
            <h2 className="mb-2 text-center">
              {t("itemsAvailable")}
            </h2>
            <VooDooDetails
              type="primary"
              name="itemsAvailable"
              summary={t("itemsAvailableSummary", { traderName })}
              background="dark"
              defaultOpen={false}
            >
              {trader.UserPerfume?.length ? (
                <ul className="mt-6">
                  {trader.UserPerfume.map((up) => (
                    <ItemsToTrade
                      key={up.id}
                      userPerfume={{ ...up, userId: trader.id } as UserPerfumeI}
                      trader={trader}
                      viewerId={viewer?.id}
                    />
                  ))}
                </ul>
              ) : (
                <p>{t("noItemsAvailable")}</p>
              )}
            </VooDooDetails>
          </div>

          <div className="noir-border relative w-full p-4">
            <h2 className="mb-2 text-center">
              {t("itemsSearchingFor")}
            </h2>
            <VooDooDetails
              type="primary"
              name="itemsSearchingFor"
              summary={t("itemsSummary", { traderName })}
              background="dark"
              defaultOpen={true}
            >
              <ItemsSearchingFor
                wishlistItems={(trader.UserPerfumeWishlist ?? []).map((item) => ({
                  id: item.id,
                  perfumeId: item.perfumeId,
                  isPublic: item.isPublic,
                  bottlePreference: item.bottlePreference,
                  createdAt: item.createdAt,
                  user: {
                    id: trader.id,
                    firstName: trader.firstName ?? "",
                    lastName: trader.lastName ?? "",
                    username: trader.username ?? "",
                    email: trader.email,
                  },
                  perfume: item.perfume,
                }))}
              />
            </VooDooDetails>
          </div>
        </div>
      </div>
      </PageWrapper>
    </main>
  )
}
