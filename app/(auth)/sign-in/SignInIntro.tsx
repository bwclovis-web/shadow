import { getTranslations } from "next-intl/server"
import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"

const SIGN_UP_PATH = "/sign-up"

const SignInIntro = async () => {
  const t = await getTranslations("auth")

  return (
    <div className="relative w-full noir-border bg-noir-black/20 px-4 py-6 text-center text-noir-gold shadow-md backdrop-blur-xs md:px-6">
      <h1
        id="sign-in-heading"
        className="text-shadow-lg text-shadow-black leading-tight"
      >
        {t("heading")}
      </h1>
      <p className="text-lg text-noir-gold-100 mb-4">{t("subheading")}</p>
      <p className="text-lg font-semibold text-noir-gold-500 mb-4">{t("newHere")}</p>
      <VooDooLink
        url={SIGN_UP_PATH}
        variant="primary"
        background="gold"
        size="sm"
        prefetch
        transitionVariant="detail-to-list"
      >
        {t("createAccount")}
      </VooDooLink>
    </div>
  )
}

export default SignInIntro
