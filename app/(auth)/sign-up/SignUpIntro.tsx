import { getTranslations } from "next-intl/server"
import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import type { SignupAvailability } from "@/utils/membership/signup-availability"

const SIGN_IN_PATH = "/sign-in"

type SignUpIntroProps = {
  availability: SignupAvailability
}

const SignUpIntro = async ({ availability }: SignUpIntroProps) => {
  const t = await getTranslations("auth.signUp")
  const tJoin = await getTranslations("join")
  const { freeOpen, spotsLeft, limit } = availability

  return (
    <div className="relative w-full noir-border bg-noir-black/20 px-4 mt-40 lg:mt-0 py-6 text-center text-noir-gold shadow-md backdrop-blur-xs md:px-2">
      <h1
        id="sign-up-heading"
        className="text-shadow-lg text-shadow-black h1 mb-4"
      >
        {t("heading")}
      </h1>
      <p className="text-lg text-noir-gold-100 mb-4">
        {freeOpen ? t("subheadingFree") : t("subheading")}
      </p>
      {freeOpen ? (
        <p className="text-base font-semibold text-noir-gold-500 mb-4">
          {tJoin("spotsLeft", { remaining: spotsLeft, limit })}
        </p>
      ) : null}
      <p className="text-base text-noir-gold-100 mb-4">{t("adFreePerk")}</p>
      <p className="text-lg font-semibold text-noir-gold-500 mb-4">{t("alreadyHere")}</p>
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

export default SignUpIntro
