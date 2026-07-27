import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import CorrespondenceClient from "@/app/correspondence/CorrespondenceClient"
import { buildFaqPageJsonLd } from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("contactUs.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: "/correspondence",
  })
}

const CorrespondencePage = async () => {
  const t = await getTranslations("contactUs.faq")
  const faqJsonLd = buildFaqPageJsonLd([
    { question: t("question1"), answer: t("answer1") },
    { question: t("question2"), answer: t("answer2") },
    { question: t("question3"), answer: t("answer3") },
    { question: t("question4"), answer: t("answer4") },
    { question: t("question5"), answer: t("answer5") },
    { question: t("question6"), answer: t("answer6") },
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <CorrespondenceClient />
    </>
  )
}

export default CorrespondencePage
