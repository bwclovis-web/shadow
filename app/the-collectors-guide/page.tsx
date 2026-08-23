import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheCollectorsGuideContent from "@/app/the-collectors-guide/TheCollectorsGuideContent"
import { buildPageMetadata } from "@/lib/seo/metadata"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("howItWorks.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: "/the-collectors-guide",
  })
}

const TheCollectorsGuidePage = () => <TheCollectorsGuideContent />

export default TheCollectorsGuidePage
