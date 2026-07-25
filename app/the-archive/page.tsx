import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheArchiveClient from "@/app/the-archive/TheArchiveClient"
import { THE_ARCHIVE_PATH } from "@/constants/routes"
import { buildPageMetadata } from "@/lib/seo/metadata"

const ARCHIVE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("allPerfumes.meta")
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    canonicalPath: THE_ARCHIVE_PATH,
  })
}

const TheArchivePage = async () => {
  const t = await getTranslations("allPerfumes")

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
      <TheArchiveClient
        initialLetter={null}
        initialPerfumes={[]}
        initialPerfumeTotal={0}
      />
    </>
  )
}

export default TheArchivePage
