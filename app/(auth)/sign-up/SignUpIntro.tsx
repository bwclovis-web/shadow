import { Link } from "next-view-transitions"
import { getTranslations } from "next-intl/server"

const SIGN_IN_PATH = "/sign-in"

const SignUpIntro = async () => {
  const t = await getTranslations("auth.signUp")

  return (
    <div className="relative w-full noir-border bg-noir-dark/70 px-4 py-6 text-center text-noir-gold shadow-md backdrop-blur-sm md:px-6">
      <h1
        id="sign-up-heading"
        className="text-shadow-lg text-shadow-black"
      >
        {t("heading")}
      </h1>
      <p className="subtitle mb-4">{t("subheading")}</p>
      <p className="subtitle mb-4">{t("alreadyHere")}</p>
      <Link
        href={SIGN_IN_PATH}
        className="bg-transparent text-blue-200 font-semibold hover:underline focus:bg-noir-gold/20 disabled:bg-transparent text-nowrap px-0 block"
      >
        {t("signIn")}
      </Link>
    </div>
  )
}

export default SignUpIntro
