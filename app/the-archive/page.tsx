import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheArchiveClient from "@/app/the-archive/TheArchiveClient"
import { THE_ARCHIVE_PATH } from "@/constants/routes"
import { buildItemListJsonLd } from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { searchPerfumeByNameForViewer } from "@/models/perfume-search.server"

const ARCHIVE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
const ARCHIVE_SEARCH_LIMIT = 40

type Props = {
  searchParams: Promise<{ q?: string }>
}

export const generateMetadata = async ({
  searchParams,
}: Props): Promise<Metadata> => {
  const t = await getTranslations("allPerfumes.meta")
  const resolved = await searchParams
  const q = typeof resolved.q === "string" ? resolved.q.trim() : ""
  if (q) {
    return buildPageMetadata({
      title: t("searchTitle", { query: q }),
      description: t("searchDescription", { query: q }),
      canonicalPath: `${THE_ARCHIVE_PATH}?q=${encodeURIComponent(q)}`,
    })
  }
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: THE_ARCHIVE_PATH,
  })
}

const TheArchivePage = async ({ searchParams }: Props) => {
  const t = await getTranslations("allPerfumes")
  const resolved = await searchParams
  const q = typeof resolved.q === "string" ? resolved.q.trim() : ""

  let searchResults: Awaited<ReturnType<typeof searchPerfumeByNameForViewer>> =
    []
  if (q) {
    try {
      searchResults = await searchPerfumeByNameForViewer(q, {
        limit: ARCHIVE_SEARCH_LIMIT,
      })
    } catch (error) {
      console.error("[the-archive] search failed:", error)
      searchResults = []
    }
  }

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
      {q && searchResults.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              buildItemListJsonLd({
                name: t("searchHeading", { query: q }),
                path: `${THE_ARCHIVE_PATH}?q=${encodeURIComponent(q)}`,
                items: searchResults.map(p => ({
                  name: p.name,
                  path: `/perfume/${p.slug}`,
                })),
              })
            ),
          }}
        />
      ) : null}
      <TheArchiveClient
        initialLetter={null}
        initialPerfumes={[]}
        initialPerfumeTotal={0}
        initialSearchQuery={q || null}
        initialSearchResults={searchResults.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          image: p.image ?? undefined,
          perfumeHouse: p.perfumeHouse
            ? { name: p.perfumeHouse.name }
            : null,
        }))}
      />
    </>
  )
}

export default TheArchivePage
