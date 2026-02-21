import type { Metadata } from "next"
import { cookies } from "next/headers"

import { getServerI18n } from "@/lib/i18n/server"

import AllHousesClient from "./AllHousesClient"

export const ROUTE_PATH = "/houses"

export const generateMetadata = async (): Promise<Metadata> => {
  const cookieStore = await cookies()
  const locale =
    cookieStore.get("i18next")?.value ??
    cookieStore.get("i18nextLng")?.value ??
    "en"
  const i18n = await getServerI18n(locale)
  return {
    title: i18n.t("allHouses.meta.title"),
    description: i18n.t("allHouses.meta.description"),
  }
}

const HousesPage = async () => {
  const cookieStore = await cookies()
  const locale =
    cookieStore.get("i18next")?.value ??
    cookieStore.get("i18nextLng")?.value ??
    "en"
  const i18n = await getServerI18n(locale)
  return (
    <AllHousesClient
      heading={i18n.t("allHouses.heading")}
      subheading={i18n.t("allHouses.subheading")}
    />
  )
}

export default HousesPage
