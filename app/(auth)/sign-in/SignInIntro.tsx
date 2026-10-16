import { getTranslations } from "next-intl/server"
import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import {
  CLOSED_SIGNUP_AVAILABILITY,
  getJoinCta,
} from "@/utils/membership/signup-availability"
import { getSignupAvailability } from "@/utils/server/user-limit.server"

const SignInIntro = async () => {
  const t = await getTranslations("auth")
  const tJoin = await getTranslations("join")
  const { freeOpen, spotsLeft, limit } = await getSignupAvailability().catch(
    () => CLOSED_SIGNUP_AVAILABILITY
  )
  const { href } = getJoinCta(freeOpen)

  return (
    <div className="relative w-full noir-border mt-40 lg:mt-0 bg-noir-black/20 px-4 py-6 text-center text-noir-gold shadow-md backdrop-blur-xs md:px-6">
      <h1
        id="sign-in-heading"
        className="text-shadow-lg text-shadow-black h1 mb-4"
      >
        {t("heading")}
      </h1>
      <p className="text-lg text-noir-gold-100 mb-4">{t("subheading")}</p>
      <p className="text-lg font-semibold text-noir-gold-500 mb-4">{t("newHere")}</p>
      <VooDooLink
        url={href}
        variant="primary"
        background="gold"
        size="sm"
        prefetch
        transitionVariant="detail-to-list"
      >
        {freeOpen ? t("createAccount") : tJoin("ctaClosed")}
      </VooDooLink>
      {freeOpen ? (
        <p className="mt-3 text-sm text-noir-gold-100/80">
          {tJoin("spotsLeft", { remaining: spotsLeft, limit })}
        </p>
      ) : null}
    </div>
  )
}

export default SignInIntro
