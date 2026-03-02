"use client"

import { useTranslations } from "next-intl"
import { Link } from "next-view-transitions"

import TitleBanner from "@/components/Organisms/TitleBanner"

const NotFound = () => {
  const t = useTranslations("404")

  return (
    <section>
      <TitleBanner
        image="/images/404.png"
        heading={t("heading")}
        subheading={t("subheading")}
      />
      <div className="inner-container py-12 flex flex-col items-center justify-center px-4 text-center">
        <p className="text-noir-gold-100/70 text-lg mb-8 max-w-md">
          {t("subheading")}
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-noir-gold text-noir-black font-semibold rounded hover:bg-noir-gold/80 transition-colors"
        >
          {t("homeLink")}
        </Link>
      </div>
    </section>
  )
}

export default NotFound
