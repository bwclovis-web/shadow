import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import AllHousesClient from "./AllHousesClient"

export const ROUTE_PATH = "/houses"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("allHouses.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

const HousesPage = async () => {
  const t = await getTranslations("allHouses")
  return (
    <AllHousesClient
      heading={t("heading")}
      subheading={t("subheading")}
    />
  )
}

export default HousesPage
