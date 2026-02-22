"use client"

import { useTranslations } from "next-intl"

import TitleBanner from "@/components/Organisms/TitleBanner"

const BANNER_IMAGE = "/images/about.webp"

const AboutUsClient = () => {
  const t = useTranslations("aboutUs")

  return (
    <section>
      <TitleBanner
        image={BANNER_IMAGE}
        heading={t("heading")}
        subheading={t("subheading")}
      />

      <article className="inner-container py-12">
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
      </article>
    </section>
  )
}

export default AboutUsClient
