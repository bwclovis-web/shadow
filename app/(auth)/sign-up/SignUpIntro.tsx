import { getTranslations } from "next-intl/server"
import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"

const SIGN_IN_PATH = "/sign-in"

const SignUpIntro = async () => {
  const t = await getTranslations("auth.signUp")

  return (
    <div className="relative w-full noir-border bg-noir-black/20 px-4 mt-40 lg:mt-0 py-6 text-center text-noir-gold shadow-md backdrop-blur-xs md:px-2">
      <h1
        id="sign-up-heading"
        className="text-shadow-lg text-shadow-black h1 mb-4"
      >
        {t("heading")}
      </h1>
      <p className="text-lg text-noir-gold-100 mb-4">{t("subheading")}</p>
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
