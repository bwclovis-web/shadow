import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import CorrespondenceClient from "@/app/correspondence/CorrespondenceClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("contactUs.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const CorrespondencePage = () => <CorrespondenceClient />

export default CorrespondencePage
