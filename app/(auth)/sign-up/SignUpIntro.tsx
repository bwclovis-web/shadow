import { Link } from "next-view-transitions"
import { getTranslations } from "next-intl/server"

const SIGN_IN_PATH = "/sign-in"

const SignUpIntro = async () => {
  const t = await getTranslations("auth.signUp")

  return (
    <div className="mx-auto min-w-1/3 relative noir-border py-5 px-3 bg-noir-dark/10 shadow-md text-noir-gold content text-center">
      <h1 className="text-shadow-lg text-shadow-black">{t("heading")}</h1>
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
