import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { DataQualityClient } from "./DataQualityClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("dataQuality")
  return {
    title: t("heading"),
    description: t("subheading"),
  }
}

const DataQualityPage = () => (
  <DataQualityClient isAdmin />
)

export default DataQualityPage
