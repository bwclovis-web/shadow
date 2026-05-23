import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheKeepersContent from "@/app/the-keepers/TheKeepersContent"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("aboutUs.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const TheKeepersPage = () => <TheKeepersContent />

export default TheKeepersPage
