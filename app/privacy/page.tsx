import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import TitleBanner from "@/components/Organisms/TitleBanner/TitleBanner"
import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("privacyPage.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: "/privacy",
  })
}

const PrivacyPage = async () => {
  const t = await getTranslations("privacyPage")
  const tTerms = await getTranslations("termsAndConditions")

  return (
    <main id="main-content">
      <TitleBanner
        imagePos="object-center"
        image="/images/terms.webp"
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PageWrapper isArticle={true}>
        <section className="mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold">
          <h2 className="mb-4 uppercase">{tTerms("privacy.heading")}</h2>
          <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
            <p>{tTerms("privacy.contentOne")}</p>
          </div>
          <ul className="list-disc list-inside text-noir-gold-100 text-lg mt-4 space-y-2">
            <li>{tTerms("privacy.contentList.one")}</li>
            <li>{tTerms("privacy.contentList.two")}</li>
            <li>{tTerms("privacy.contentList.three")}</li>
            <li>{tTerms("privacy.contentList.four")}</li>
            <li>{t("contactLine")}</li>
          </ul>
        </section>
        <section className="mx-auto mt-8 bg-noir-dark p-8 rounded-lg border border-noir-gold mb-20">
          <h2 className="mb-4 uppercase">{t("offPlatform.heading")}</h2>
          <div className="flex flex-col gap-4 text-noir-gold-100 text-lg">
            <p>{t("offPlatform.contentOne")}</p>
            <p>{t("offPlatform.contentTwo")}</p>
            <p>
              {t("offPlatform.termsPrefix")}{" "}
              <PrefetchLink
                href="/terms-and-conditions"
                className="text-noir-gold underline underline-offset-4"
              >
                {t("offPlatform.termsLink")}
              </PrefetchLink>
              .
            </p>
          </div>
        </section>
      </PageWrapper>
    </main>
  )
}

export default PrivacyPage
