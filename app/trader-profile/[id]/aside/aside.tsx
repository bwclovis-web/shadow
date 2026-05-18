import FollowButton from "@/components/Containers/Follow/FollowButton"
import ContactTraderButton from "@/components/Containers/TraderProfile/ContactTraderButton"
import ReportTraderButton from "@/components/Containers/TraderProfile/ReportTraderButton"
import ScentDnaCard from "@/components/Containers/TraderProfile/ScentDnaCard/ScentDnaCard"
import TraderFeedbackSection from "@/components/Containers/TraderProfile/TraderFeedbackSection"
import TraderProfileAboutExtras from "@/components/Containers/TraderProfile/TraderProfileAboutExtras"
import TraderTrustSummary from "@/components/Containers/TraderProfile/TraderTrustSummary"
import { TraderFeedbackResponse } from "@/lib/queries/traderFeedback"
import { TraderResponse } from "@/lib/queries/user"
import type { ScentDnaSnapshot } from "@/models/scent-dna.server"
import { resolveTraderCountry } from "@/utils/country-list"
import { SafeUser } from "@/types"
import { useTranslations } from "next-intl"

interface TraderProfileAsideProps {
  trader: TraderResponse
  viewer: SafeUser | null
  feedback: TraderFeedbackResponse
  initialFollowing?: boolean
  scentDna: ScentDnaSnapshot
  traderName: string
}

export const TraderProfileAside = ({
  trader,
  viewer,
  feedback,
  initialFollowing = false,
  scentDna,
  traderName,
}: TraderProfileAsideProps) => {
  const t = useTranslations("traderProfile")
  const hasAboutText = Boolean(trader.traderAbout?.trim())
  const hasCountry = Boolean(resolveTraderCountry(trader.region))
  const hasSocial =
    Boolean(trader.instagramHandle?.trim()) ||
    Boolean(trader.fragranticaUrl?.trim()) ||
    Boolean(trader.redditUsername?.trim())
  const showAboutSection = hasAboutText || hasCountry || hasSocial

  return (
    <div className="md:col-span-2 xl:col-span-1">
      {showAboutSection ? (
        <div className="noir-border mb-4 p-4">
          <h2 className="mb-2 text-noir-gold">{t("aboutHeading")}</h2>
          {hasAboutText ? (
            <p className="whitespace-pre-wrap text-noir-gold-100">{trader.traderAbout}</p>
          ) : null}
          <TraderProfileAboutExtras trader={trader} />
        </div>
      ) : null}
      <ScentDnaCard
        className="mb-4"
        scentDna={scentDna}
        traderName={traderName}
        shareUrl={`/trader-profile/${trader.id}/scent-dna`}
      />
      <TraderTrustSummary reputation={feedback.reputation} />
      <TraderFeedbackSection
        traderId={trader.id}
        viewerId={viewer?.id}
        initialData={feedback}
      />
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:flex-wrap">
        <FollowButton
          targetType="user"
          targetId={trader.id}
          initialFollowing={initialFollowing}
          viewerId={viewer?.id ?? null}
        />
        <ContactTraderButton
          traderId={trader.id}
          trader={trader}
          viewerId={viewer?.id}
        />
        <ReportTraderButton
          traderId={trader.id}
          trader={trader}
          viewerId={viewer?.id}
        />
      </div>
    </div>
  )
}
