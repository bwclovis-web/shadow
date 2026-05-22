"use client"

import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"

import VooDooDetails from "@/components/Atoms/VooDooDetails"
import { TradeStatusCard } from "@/components/Molecules/TradeStatusCard"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { TradeForClient } from "@/types/trade"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

type TradesPageClientProps = {
  activeTrades: TradeForClient[]
  historyTrades: TradeForClient[]
  bannerImage: string
  userSlug: string
  userId: string
}

const TradesPageClient = ({
  activeTrades,
  historyTrades,
  bannerImage,
  userSlug,
  userId,
}: TradesPageClientProps) => {
  const t = useTranslations("myTrades")

  const hasAny = activeTrades.length > 0 || historyTrades.length > 0

  return (
    <main id="main-content">
      <TitleBanner
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <Link
          href={`/${userSlug}/profile`}
          className="text-sm text-noir-gold-100 underline hover:text-noir-gold"
        >
          {t("backToProfile")}
        </Link>
      </TitleBanner>

      <PageWrapper>
        {!hasAny ? (
          <h2 className="text-center text-noir-gold-100">{t("empty")}</h2>
        ) : (
          <div className="mx-auto flex flex-col gap-4">
            {activeTrades.length > 0 ? (
              <VooDooDetails
                name="myActiveTrades"
                summary={t("activeSummary", { count: activeTrades.length })}
                className="text-noir-gold"
                background="dark"
                defaultOpen
              >
                <div className="space-y-3 py-2">
                  {activeTrades.map(trade => (
                    <TradeStatusCard
                      key={trade.id}
                      trade={trade}
                      currentUserId={userId}
                    />
                  ))}
                </div>
              </VooDooDetails>
            ) : null}

            {historyTrades.length > 0 ? (
              <VooDooDetails
                name="myTradeHistory"
                summary={t("historySummary", { count: historyTrades.length })}
                className="text-noir-gold"
                background="dark"
                defaultOpen={false}
              >
                <div className="space-y-6 py-4">
                  {historyTrades.map(trade => (
                    <TradeStatusCard
                      key={trade.id}
                      trade={trade}
                      currentUserId={userId}
                      readOnly
                    />
                  ))}
                </div>
              </VooDooDetails>
            ) : null}
          </div>
        )}
      </PageWrapper>
    </main>
  )
}

export default TradesPageClient
