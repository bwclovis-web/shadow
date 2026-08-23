import { getTranslations } from "next-intl/server"

import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import {
  ANNUAL_PRICES_USD,
  parseCheckoutTier,
} from "@/utils/membership/stripe-prices"

const SIGN_IN_PATH = "/sign-in"

type SubscribeIntroProps = {
  tierParam?: string | null
}

const SubscribeIntro = async ({ tierParam }: SubscribeIntroProps) => {
  const t = await getTranslations("subscribe")
  const tier = parseCheckoutTier(tierParam)
  const price = ANNUAL_PRICES_USD[tier]

  return (
    <div className="relative w-full noir-border bg-noir-black/20 px-4 mt-40 lg:mt-0 py-6 text-center text-noir-gold shadow-md backdrop-blur-xs md:px-2">
      <h1
        id="subscribe-heading"
        className="text-shadow-lg text-shadow-black h1 mb-4"
      >
        {t("heading")}
      </h1>
      <p className="text-lg text-noir-gold-100 mb-4">{t("subheading")}</p>
      <p className="text-lg font-semibold text-noir-gold-500 mb-2">
        {t(`tiers.${tier}`)} — {t("tierPrice", { price })}
      </p>
      <p className="text-base text-noir-gold-100 mb-4">{t("participateCopy")}</p>
      <VooDooLink
        url={SIGN_IN_PATH}
        variant="primary"
        background="gold"
        size="sm"
        prefetch
        transitionVariant="detail-to-list"
      >
        {t("signIn")}
      </VooDooLink>
    </div>
  )
}

export default SubscribeIntro
