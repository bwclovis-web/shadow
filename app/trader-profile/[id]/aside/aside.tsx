import ContactTraderButton from "@/components/Containers/TraderProfile/ContactTraderButton";
import TraderFeedbackSection from "@/components/Containers/TraderProfile/TraderFeedbackSection";
import TraderTrustSummary from "@/components/Containers/TraderProfile/TraderTrustSummary";
import { TraderFeedbackResponse } from "@/lib/queries/traderFeedback";
import { TraderResponse } from "@/lib/queries/user";
import { SafeUser } from "@/types";
import { useTranslations } from "next-intl";

interface TraderProfileAsideProps {
    trader: TraderResponse
    viewer: SafeUser | null
    feedback: TraderFeedbackResponse
}

export const TraderProfileAside = ({ trader, viewer, feedback }: TraderProfileAsideProps) => {
    const t = useTranslations("traderProfile")
    return (
    <div className="md:col-span-2 xl:col-span-1">
          {trader.traderAbout?.trim() ? (
            <div className="noir-border mb-4 p-4">
              <h2 className="mb-2 text-noir-gold">{t("aboutHeading")}</h2>
              <p className="whitespace-pre-wrap text-noir-gold-100">
                {trader.traderAbout}
              </p>
            </div>
          ) : null}
          <TraderTrustSummary reputation={feedback.reputation} />
          <TraderFeedbackSection
            traderId={trader.id}
            viewerId={viewer?.id}
            initialData={feedback}
          />
          <div className="mt-4">
            <ContactTraderButton
              traderId={trader.id}
              trader={trader}
              viewerId={viewer?.id}
            />
          </div>
        </div>
    )
}