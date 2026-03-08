import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import HowWeWorkClient from "./HowWeWorkClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("howItWorks.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const HowWeWorkPage = () => <HowWeWorkClient />

export default HowWeWorkPage
