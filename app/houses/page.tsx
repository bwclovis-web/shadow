import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { HOUSES_PATH } from "@/constants/routes"
import { buildItemListJsonLd } from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { getHouseCatalogPage } from "@/models/house.server"
import { shouldShowAds } from "@/utils/ads/should-show-ads"
import { CATALOG_PAGE_SIZE, parseHouseCatalogState } from "@/utils/catalog-params"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import AllHousesClient from "./AllHousesClient"

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("allHouses.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: HOUSES_PATH,
  })
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const HousesPage = async ({ searchParams }: Props) => {
  const t = await getTranslations("allHouses")
  const requested = parseHouseCatalogState(await searchParams)
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  const catalog = await getHouseCatalogPage({
    letter: requested.letter,
    houseTypes: requested.houseTypes,
    sort: requested.sort,
    page: requested.page,
    pageSize: CATALOG_PAGE_SIZE,
  })
  const state = { ...requested, page: catalog.page }

  return (
    <>
      {state.letter && catalog.items.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildItemListJsonLd({
                name: `Perfume houses starting with ${state.letter}`,
                path: `${HOUSES_PATH}?letter=${state.letter}`,
                items: catalog.items.map(h => ({
                  name: h.name,
                  path: `${HOUSES_PATH}/${h.slug}`,
                })),
              }),
            ),
          }}
        />
      ) : null}
      <AllHousesClient
        heading={t("heading")}
        subheading={t("subheading")}
        state={state}
        catalog={catalog}
        showAds={shouldShowAds(session?.user)}
      />
    </>
  )
}

export default HousesPage
