import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheArchiveClient from "@/app/the-archive/TheArchiveClient"
import { THE_ARCHIVE_PATH } from "@/constants/routes"
import { buildItemListJsonLd } from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { shouldShowAds } from "@/utils/ads/should-show-ads"
import { emptyArchiveFilters, parseArchiveCatalogState } from "@/utils/catalog-params"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import { type ArchiveCatalogData, loadArchiveCatalog, loadArchiveSearch } from "./archive-catalog.server"

const ARCHIVE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

type SearchParams = Record<string, string | string[] | undefined>

type Props = {
  searchParams: Promise<SearchParams>
}

const readSearchQuery = (params: SearchParams): string => {
  const raw = params.q
  return (Array.isArray(raw) ? raw[0] : raw ?? "").trim()
}

export const generateMetadata = async ({
  searchParams,
}: Props): Promise<Metadata> => {
  const t = await getTranslations("allPerfumes.meta")
  const q = readSearchQuery(await searchParams)
  if (q) {
    // Search result URLs are useful for users/SearchAction but should not be
    // indexed as distinct thin pages — canonical + noindex to the hub.
    return {
      ...buildPageMetadata({
        title: t("searchTitle", { query: q }),
        description: t("searchDescription", { query: q }),
        canonicalPath: THE_ARCHIVE_PATH,
      }),
      robots: { index: false, follow: true },
    }
  }
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: THE_ARCHIVE_PATH,
  })
}

const TheArchivePage = async ({ searchParams }: Props) => {
  const t = await getTranslations("allPerfumes")
  const params = await searchParams
  const q = readSearchQuery(params)
  const requested = parseArchiveCatalogState(params, null)
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  const data: ArchiveCatalogData = q
    ? {
        state: { ...requested, filters: emptyArchiveFilters(), page: 1 },
        catalog: await loadArchiveSearch(q),
        selectedHouses: [],
        selectedNotes: [],
      }
    : await loadArchiveCatalog(requested)

  return (
    <>
      {/* Crawlable A–Z hubs for search engines; interactive nav lives in TheArchiveClient. */}
      <nav aria-label={t("heading")} className="sr-only">
        <ul>
          {ARCHIVE_LETTERS.map(letter => (
            <li key={letter}>
              <a href={`${THE_ARCHIVE_PATH}/${letter}`}>{letter}</a>
            </li>
          ))}
        </ul>
      </nav>
      {q && data.catalog.items.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildItemListJsonLd({
                name: t("searchHeading", { query: q }),
                path: THE_ARCHIVE_PATH,
                items: data.catalog.items.map(p => ({
                  name: p.name,
                  path: `/perfume/${p.slug}`,
                })),
              })
            ),
          }}
        />
      ) : null}
      <TheArchiveClient
        {...data}
        searchQuery={q || null}
        showAds={shouldShowAds(session?.user)}
      />
    </>
  )
}

export default TheArchivePage
