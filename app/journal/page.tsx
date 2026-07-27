import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

import JournalIndexClient from "@/app/journal/JournalIndexClient"
import TitleBanner from "@/components/Organisms/TitleBanner"
import { brandPageTitle } from "@/lib/seo/metadata"
import { getPublishedArticles } from "@/lib/sanity/articles.server"
import { isSanityConfigured } from "@/sanity/env"

export const revalidate = 3600

const BANNER_IMAGE = "/images/new/blog.webp"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("behindTheBottle.meta")
  const title = t("title")
  const description = t("description")
  return {
    title,
    description,
    openGraph: {
      title: brandPageTitle(title),
      description,
    },
  }
}

const JournalPage = async () => {
  if (!isSanityConfigured) {
    redirect("/houses")
  }

  const t = await getTranslations("behindTheBottle")
  const articles = await getPublishedArticles()

  return (
    <section>
      <TitleBanner image={BANNER_IMAGE} heading={t("heading")} subheading={t("subheading")} />
      <JournalIndexClient articles={articles} sanityConfigured={isSanityConfigured} />
    </section>
  )
}

export default JournalPage
