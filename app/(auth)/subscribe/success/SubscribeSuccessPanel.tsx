import { VooDooLink } from "@/components/Atoms/Button/VooDooLink"
import { getTranslations } from "next-intl/server"

type SubscribeSuccessPanelProps = {
  verified: boolean
  signUpHref: string | null
  subscribeHref: string
}

const SubscribeSuccessPanel = async ({
  verified,
  signUpHref,
  subscribeHref,
}: SubscribeSuccessPanelProps) => {
  const t = await getTranslations("subscribeSuccess")

  return (
    <main
      id="main-content"
      className="relative mx-auto flex w-full max-w-md flex-col gap-4 noir-border bg-noir-dark/30 p-4 backdrop-blur-sm md:p-6 lg:mx-0 lg:max-w-none"
    >
      <p className="text-lg font-semibold text-noir-gold-500">
        {verified ? t("messageTitle") : t("failedTitle")}
      </p>
      <p className="text-sm text-noir-gold-100">
        {verified ? t("messageBody") : t("failedBody")}
      </p>
      {verified && signUpHref ? (
        <VooDooLink
          url={signUpHref}
          variant="primary"
          background="gold"
          size="xl"
          prefetch
          transitionVariant="detail-to-list"
          className="w-full justify-center"
        >
          {t("cta")}
        </VooDooLink>
      ) : (
        <VooDooLink
          url={subscribeHref}
          variant="primary"
          background="gold"
          size="xl"
          prefetch
          transitionVariant="detail-to-list"
          className="w-full justify-center"
        >
          {t("retryCta")}
        </VooDooLink>
      )}
    </main>
  )
}

export default SubscribeSuccessPanel
