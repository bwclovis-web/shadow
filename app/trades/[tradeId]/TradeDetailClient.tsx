"use client"

import { Link } from "next-view-transitions"
import { useTranslations } from "next-intl"

import { CopyShareLinkButton } from "@/components/Molecules/CopyShareLinkButton"
import { TradeStatusCard } from "@/components/Molecules/TradeStatusCard"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import type { TradeForClient } from "@/types/trade"

type TradeDetailClientProps = {
  trade: TradeForClient
  viewerId: string
  userSlug: string
  hasActiveDispute: boolean
  bannerImage: string
}

const TradeDetailClient = ({
  trade,
  viewerId,
  userSlug,
  hasActiveDispute,
  bannerImage,
}: TradeDetailClientProps) => {
  const t = useTranslations("tradeDetail")

  return (
    <section>
      <TitleBanner
        image={bannerImage}
        heading={t("heading")}
        subheading={t("subheading")}
      >
        <div className="flex flex-col items-center gap-3">
          <CopyShareLinkButton sharePath={`/trades/${trade.id}`} />
          <Link
            href={`/messages/${trade.initiatorId === viewerId ? trade.counterpartyId : trade.initiatorId}`}
            className="text-sm text-noir-gold-100 underline hover:text-noir-gold"
          >
            {t("openMessages")}
          </Link>
        </div>
      </TitleBanner>

      <div className="inner-container mx-auto max-w-3xl p-6">
        <TradeStatusCard
          trade={trade}
          currentUserId={viewerId}
          userSlug={userSlug}
          hasActiveDispute={hasActiveDispute}
        />
      </div>
    </section>
  )
}

export default TradeDetailClient
