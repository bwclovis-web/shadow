import { getTranslations } from "next-intl/server"

import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { SIGN_UP } from "@/constants/routes"
import { CLOSED_SIGNUP_AVAILABILITY } from "@/utils/membership/signup-availability"
import {
  ANNUAL_PRICES_USD,
  parseCheckoutTier,
} from "@/utils/membership/stripe-prices"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSignupAvailability } from "@/utils/server/user-limit.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

const SIGN_IN_PATH = "/sign-in"

type SubscribeIntroProps = {
  tierParam?: string | null
}

const SubscribeIntro = async ({ tierParam }: SubscribeIntroProps) => {
  const t = await getTranslations("subscribe")
  const tJoin = await getTranslations("join")
  const tier = parseCheckoutTier(tierParam)
  const price = ANNUAL_PRICES_USD[tier]
  const [session, availability] = await Promise.all([
    getCookieHeader().then(cookieHeader =>
      getSessionFromCookieHeader(cookieHeader, { includeUser: false })
    ),
    getSignupAvailability().catch(() => CLOSED_SIGNUP_AVAILABILITY),
  ])
  const showFoundingNotice = availability.freeOpen && !session?.userId

  return (
    <div className="relative w-full noir-border bg-noir-black/20 px-4 mt-40 lg:mt-0 py-6 text-center text-noir-gold shadow-md backdrop-blur-xs md:px-2">
      <h1
        id="subscribe-heading"
        className="text-shadow-lg text-shadow-black h1 mb-4"
      >
        {t("heading")}
      </h1>
      <p className="text-lg text-noir-gold-100 mb-4">{t("subheading")}</p>
      {showFoundingNotice ? (
        <p className="noir-border bg-noir-gold/10 px-3 py-2 text-base text-noir-gold-100 mb-4">
          {t("foundingOpenNotice", {
            remaining: availability.spotsLeft,
            limit: availability.limit,
          })}{" "}
          <PrefetchLink
            href={SIGN_UP}
            className="font-semibold text-noir-gold-500 underline underline-offset-4 hover:text-noir-light"
          >
            {tJoin("ctaOpen")}
          </PrefetchLink>
        </p>
      ) : null}
      <p className="text-lg font-semibold text-noir-gold-500 mb-2">
        {t(`tiers.${tier}`)} — {t("tierPrice", { price })}
      </p>
      <p className="text-base text-noir-gold-100 mb-4">{t("participateCopy")}</p>
      <p className="text-base text-noir-gold-500 mb-4">{t("adFreePerk")}</p>
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
