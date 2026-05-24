import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"

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
    <main id="main-content">
      <TitleBanner
        imagePos="object-center"
        image="/images/terms.webp"
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PageWrapper isArticle={true}>
      <section className="mx-auto mt-8 p-8">
        <h2 className="mb-4">{t("intro.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("intro.subheading")}</p>
        </div>
      </section>
      <section className="mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">1. {t("shipping.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("shipping.contentOne")}</p>
          <p>{t("shipping.contentTwo")}</p>
          <p>{t("shipping.contentThree")}</p>
        </div>
        <h3 className="mt-4 mb-2">{t("shipping.practicesHeader")}</h3>
        <ul className="list-disc list-inside text-noir-gold-100 text-lg">
          <li>{t("shipping.practicesContent.one")}</li>
          <li>{t("shipping.practicesContent.two")}</li>
          <li>{t("shipping.practicesContent.three")}</li>
          <li>{t("shipping.practicesContent.four")}</li>
        </ul>
      </section>
      <section
        id="disputes"
        className="mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold"
      >
        <h2 className="mb-4">2. {t("disputes.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("disputes.contentOne")}</p>
          <p>{t("disputes.contentTwo")}</p>
          <p>{t("disputes.contentThree")}</p>
        </div>
        <h3 className="mt-4 mb-2">{t("disputes.practicesHeader")}</h3>
        <ul className="list-disc list-inside text-noir-gold-100 text-lg">
          <li>{t("disputes.practicesContent.one")}</li>
          <li>{t("disputes.practicesContent.two")}</li>
          <li>{t("disputes.practicesContent.three")}</li>
          <li>{t("disputes.practicesContent.four")}</li>
        </ul>
      </section>
      <section className="mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">3. {t("community.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("community.contentOne")}</p>
          <p>{t("community.contentTwo")}</p>
          <p>{t("community.contentThree")}</p>
        </div>
        <h3 className="mt-4 mb-2">{t("community.practicesHeader")}</h3>
        <ul className="list-disc list-inside text-noir-gold-100 text-lg">
          <li>{t("community.practicesContent.one")}</li>
          <li>{t("community.practicesContent.two")}</li>
          <li>{t("community.practicesContent.three")}</li>
          <li>{t("community.practicesContent.four")}</li>
          <li>{t("community.practicesContent.five")}</li>
        </ul>
      </section>
      <section className="mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
        <h2 className="mb-4">4. {t("offPlatform.heading")}</h2>
        <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
          <p>{t("offPlatform.contentOne")}</p>
          <p>{t("offPlatform.contentTwo")}</p>
        </div>
        <h3 className="mt-4 mb-2">{t("offPlatform.practicesHeader")}</h3>
        <ul className="list-disc list-inside text-noir-gold-100 text-lg">
          <li>{t("offPlatform.practicesContent.one")}</li>
          <li>{t("offPlatform.practicesContent.two")}</li>
          <li>{t("offPlatform.practicesContent.three")}</li>
          <li>{t("offPlatform.practicesContent.four")}</li>
        </ul>
      </section>
    </PageWrapper>
    </main>
  )
}

export default CommunityPolicyPage
