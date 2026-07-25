import { getTranslations } from "next-intl/server"

type SubscribeSuccessIntroProps = {
  verified: boolean
}

const SubscribeSuccessIntro = async ({
  verified,
}: SubscribeSuccessIntroProps) => {
  const t = await getTranslations("subscribeSuccess")

  return (
    <div className="relative w-full noir-border bg-noir-black/20 px-4 mt-40 lg:mt-0 py-6 text-center text-noir-gold shadow-md backdrop-blur-xs md:px-2">
      <h1
        id="subscribe-success-heading"
        className="text-shadow-lg text-shadow-black h1 mb-4"
      >
        {verified ? t("heading") : t("failedHeading")}
      </h1>
      <p className="text-lg text-noir-gold-100 mb-4">
        {verified ? t("subheading") : t("failedSubheading")}
      </p>
    </div>
  )
}

export default SubscribeSuccessIntro
