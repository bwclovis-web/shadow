import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getHousesByLetterPaginated } from "@/models/house.server"

import AllHousesClient from "./AllHousesClient"

const DEFAULT_PAGE_SIZE = 16

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("allHouses.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

type Props = {
  searchParams: Promise<{ letter?: string }>
}

const HousesPage = async ({ searchParams }: Props) => {
  const t = await getTranslations("allHouses")
  const params = await searchParams
  const letterParam = params.letter
  const normalizedLetter =
    letterParam && /^[A-Za-z]$/.test(letterParam)
      ? letterParam.toUpperCase()
      : null

  let initialHouses: Awaited<ReturnType<typeof getHousesByLetterPaginated>>["houses"] = []
  let initialTotal = 0

  if (normalizedLetter) {
    const result = await getHousesByLetterPaginated(normalizedLetter, {
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      houseType: "all",
    })
    initialHouses = result.houses
    initialTotal = result.count
  }

  return (
    <AllHousesClient
      heading={t("heading")}
      subheading={t("subheading")}
      initialLetter={normalizedLetter}
      initialHouses={initialHouses}
      initialHousesTotal={initialTotal}
    />
  )
}

export default HousesPage
