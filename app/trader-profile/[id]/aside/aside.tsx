import ContactTraderButton from "@/components/Containers/TraderProfile/ContactTraderButton"
import ReportTraderButton from "@/components/Containers/TraderProfile/ReportTraderButton"
import TraderFeedbackSection from "@/components/Containers/TraderProfile/TraderFeedbackSection"
import TraderProfileAboutExtras from "@/components/Containers/TraderProfile/TraderProfileAboutExtras"
import TraderTrustSummary from "@/components/Containers/TraderProfile/TraderTrustSummary"
import { TraderFeedbackResponse } from "@/lib/queries/traderFeedback"
import { TraderResponse } from "@/lib/queries/user"
import { resolveTraderCountry } from "@/utils/country-list"
import { SafeUser } from "@/types"
import { useTranslations } from "next-intl"

interface TraderProfileAsideProps {
  trader: TraderResponse
  viewer: SafeUser | null
  feedback: TraderFeedbackResponse
}

export const TraderProfileAside = ({
  trader,
  viewer,
  feedback,
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
      <TraderTrustSummary reputation={feedback.reputation} />
      <TraderFeedbackSection
        traderId={trader.id}
        viewerId={viewer?.id}
        initialData={feedback}
      />
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
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
