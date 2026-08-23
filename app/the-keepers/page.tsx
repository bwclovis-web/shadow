import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheKeepersContent from "@/app/the-keepers/TheKeepersContent"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("aboutUs.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: "/the-keepers",
  })
}

const TheKeepersPage = () => <TheKeepersContent />

export default TheKeepersPage
