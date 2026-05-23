import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import BehindTheBottleIndexClient from "@/app/behind-the-bottle/BehindTheBottleIndexClient"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { getPublishedArticles } from "@/lib/sanity/articles.server"
import { isSanityConfigured } from "@/sanity/env"

export const revalidate = 3600

const BANNER_IMAGE = "/images/new/blog.webp"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("behindTheBottle.meta")
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("description"),
    },
  }
}

const BehindTheBottlePage = async () => {
  if (!isSanityConfigured) {
    redirect("/houses")
  }

  const t = await getTranslations("behindTheBottle")
  const articles = await getPublishedArticles()

  return (
    <section>
      <TitleBanner image={BANNER_IMAGE} heading={t("heading")} subheading={t("subheading")} />
      <BehindTheBottleIndexClient articles={articles} sanityConfigured={isSanityConfigured} />
    </section>
  )
}

export default BehindTheBottlePage
