import { Link } from "next-view-transitions"
import { getTranslations } from "next-intl/server"

const SIGN_UP_PATH = "/sign-up"

const SignInIntro = async () => {
  const t = await getTranslations("auth")

  return (
    <div className="mx-auto min-w-1/3 relative noir-border py-5 px-3 bg-noir-dark/10 shadow-md text-noir-gold content text-center">
      <h1 className="text-shadow-lg text-shadow-black">{t("heading")}</h1>
      <p className="subtitle mb-4">{t("subheading")}</p>
      <p className="subtitle mb-4">{t("newHere")}</p>
      <Link
        href={SIGN_UP_PATH}
        className="bg-transparent text-blue-200 font-semibold hover:underline focus:bg-noir-gold/20 disabled:bg-transparent text-nowrap px-0 block"
      >
        {t("createAccount")}
      </Link>
    </div>
  )
}

export default SignInIntro
