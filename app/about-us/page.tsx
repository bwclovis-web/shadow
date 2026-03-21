import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import AboutUsContent from "./AboutUsContent"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("aboutUs.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const AboutUsPage = () => <AboutUsContent />

export default AboutUsPage
