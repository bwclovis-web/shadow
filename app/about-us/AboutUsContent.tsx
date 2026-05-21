import { getTranslations } from "next-intl/server"

import TitleBanner from "@/components/Organisms/TitleBanner"
import PageWrapper from "@/components/Containers/Pagewrapper/PageWrapper"

const BANNER_IMAGE = "/images/about.webp"

const AboutUsContent = async () => {
  const t = await getTranslations("aboutUs")

  return (
    <main id="main-content">
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <PageWrapper>
        <div className="max-w-4xl mx-auto">
          <div className="prose prose-lg prose-invert max-w-none">
            <h2 className="text-noir-gold text-2xl font-bold mb-6">
              {t("content.subheading")}
            </h2>
            <div className="flex flex-col gap-6 text-noir-light leading-relaxed text-lg">
              <p>{t("content.one")}</p>
              <p>{t("content.two")}</p>
              <p>{t("content.three")}</p>
              <p>{t("content.four")}</p>
              <p>{t("content.five")}</p>
            </div>
          </div>
        </div>
      </PageWrapper>
    </main>
  )
}

export default AboutUsContent
