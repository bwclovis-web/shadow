import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheCollectorsGuideContent from "@/app/the-collectors-guide/TheCollectorsGuideContent"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("howItWorks.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const TheCollectorsGuidePage = () => <TheCollectorsGuideContent />

export default TheCollectorsGuidePage
