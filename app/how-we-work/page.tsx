import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import HowWeWorkContent from "./HowWeWorkContent"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("howItWorks.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const HowWeWorkPage = () => <HowWeWorkContent />

export default HowWeWorkPage
