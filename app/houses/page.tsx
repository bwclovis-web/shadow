import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { buildItemListJsonLd } from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { getHousesByLetterPaginated } from "@/models/house.server"
import { isSanityConfigured } from "@/sanity/env"

import AllHousesClient from "./AllHousesClient"

/** Matches `useResponsivePageSize` initial state (8) until `matchMedia` runs. */
const DEFAULT_PAGE_SIZE = 8

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("allHouses.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: "/houses",
  })
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
    <>
      {normalizedLetter && initialHouses.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildItemListJsonLd({
                name: `Perfume houses starting with ${normalizedLetter}`,
                path: `/houses?letter=${normalizedLetter}`,
                items: initialHouses.map(h => ({
                  name: h.name,
                  path: `/houses/${h.slug}`,
                })),
              }),
            ),
          }}
        />
      ) : null}
      <AllHousesClient
        heading={t("heading")}
        subheading={t("subheading")}
        showBlogLink={isSanityConfigured}
        initialLetter={normalizedLetter}
        initialHouses={initialHouses}
        initialHousesTotal={initialTotal}
      />
    </>
  )
}

export default HousesPage
