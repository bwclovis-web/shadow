import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("communityPolicy.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const CommunityPolicyPage = async () => {
  const t = await getTranslations("communityPolicy")

  return (
    <article>
      <TitleBanner
        imagePos="object-center"
        image="/images/terms.webp"
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">1. {t("shipping.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("shipping.contentOne")}</p>
          <p>{t("shipping.contentTwo")}</p>
          <p>{t("shipping.contentThree")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">2. {t("disputes.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("disputes.contentOne")}</p>
          <p>{t("disputes.contentTwo")}</p>
          <p>{t("disputes.contentThree")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">3. {t("community.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("community.contentOne")}</p>
          <p>{t("community.contentTwo")}</p>
          <p>{t("community.contentThree")}</p>
        </div>
      </section>
      <section className="inner-container mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">4. {t("offPlatform.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("offPlatform.contentOne")}</p>
          <p>{t("offPlatform.contentTwo")}</p>
        </div>
      </section>
    </article>
  )
}

export default CommunityPolicyPage
