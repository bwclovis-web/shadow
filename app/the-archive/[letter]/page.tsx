import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { loadArchiveCatalog } from "@/app/the-archive/archive-catalog.server"
import TheArchiveClient from "@/app/the-archive/TheArchiveClient"
import { THE_ARCHIVE_PATH } from "@/constants/routes"
import { buildItemListJsonLd } from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { shouldShowAds } from "@/utils/ads/should-show-ads"
import { parseArchiveCatalogState, parseCatalogLetter } from "@/utils/catalog-params"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

type Props = {
  params: Promise<{ letter: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const normalizedLetter = parseCatalogLetter((await params).letter)
  const t = await getTranslations("allPerfumes.meta")

  if (!normalizedLetter) {
    return {
      title: t("title"),
      description: t("description"),
      robots: { index: false, follow: false },
    }
  }

  return buildPageMetadata({
    title: `${t("title")} — ${normalizedLetter}`,
    description: t("description"),
    canonicalPath: `${THE_ARCHIVE_PATH}/${normalizedLetter}`,
  })
}

const TheArchiveLetterPage = async ({ params, searchParams }: Props) => {
  const normalizedLetter = parseCatalogLetter((await params).letter)
  const cookieHeader = await getCookieHeader()
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  const data = await loadArchiveCatalog(
    parseArchiveCatalogState(await searchParams, normalizedLetter)
  )

  return (
    <>
      {normalizedLetter && data.catalog.items.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildItemListJsonLd({
                name: `Perfumes starting with ${normalizedLetter}`,
                path: `${THE_ARCHIVE_PATH}/${normalizedLetter}`,
                items: data.catalog.items.map(p => ({
                  name: p.name,
                  path: `/perfume/${p.slug}`,
                })),
              }),
            ),
          }}
        />
      ) : null}
      <TheArchiveClient
        {...data}
        searchQuery={null}
        showAds={shouldShowAds(session?.user)}
      />
    </>
  )
}

export default TheArchiveLetterPage
