import { Link } from "next-view-transitions"
import { getTranslations } from "next-intl/server"
import Image from "next/image"

const SIGN_UP_PATH = "/sign-up"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = await getTranslations("auth")

  return (
    <div
      className="flex flex-col gap-8 items-center justify-center min-h-screen px-4 bg-noir-gold-500/30"
    >
      <Image
        src="/images/password.png"
        alt=""
        width={1200}
        height={800}
        fetchPriority="high"
        loading="eager"
        className="hero-image absolute object-cover w-full h-full filter grayscale-[100%] sepia-[0.2]"
        sizes="100vw"
      />
      <div className="absolute inset-0 md:mask-radial-from-45% mask-radial-to-64%" />
      <div className="relative w-full flex flex-col items-center justify-around gap-4 md:gap-8 mx-auto">
        <div className="mx-auto min-w-1/3 relative noir-border py-5 px-3 bg-noir-dark/10 shadow-md text-noir-gold content text-center">
          <h1 className="text-shadow-lg text-shadow-black">
            {t("heading")}
          </h1>
          <p className="subtitle mb-4">{t("subheading")}</p>
          <Link
            href={SIGN_UP_PATH}
            className="bg-transparent text-blue-200 font-semibold hover:underline focus:bg-noir-gold/20 disabled:bg-transparent text-nowrap px-0 block"
          >
            {t("createAccount")}
          </Link>
        </div>
        <div className="w-full lg:w-1/2 form">{children}</div>
      </div>
    </div>
  )
}
