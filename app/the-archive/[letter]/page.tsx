import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheArchiveClient from "@/app/the-archive/TheArchiveClient"
import { THE_ARCHIVE_PATH } from "@/constants/routes"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { getPerfumesByLetterPaginated } from "@/models/perfume.server"

/** Matches `useResponsivePageSize` initial state (8) until `matchMedia` runs. */
const DEFAULT_PAGE_SIZE = 8

type Props = {
  params: Promise<{ letter: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { letter } = await params
  const normalizedLetter = letter?.toUpperCase()
  const isValidLetter = /^[A-Za-z]$/.test(normalizedLetter)
  const t = await getTranslations("allPerfumes.meta")

  if (!isValidLetter) {
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

const TheArchiveLetterPage = async ({ params }: Props) => {
  const { letter } = await params
  const normalizedLetter = letter?.toUpperCase()
  const isValidLetter = /^[A-Za-z]$/.test(normalizedLetter)

  let initialPerfumes: Awaited<ReturnType<typeof getPerfumesByLetterPaginated>>["perfumes"] = []
  let initialTotal = 0

  if (isValidLetter) {
    const result = await getPerfumesByLetterPaginated(normalizedLetter, {
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    })
    initialPerfumes = result.perfumes
    initialTotal = result.count
  }

  const perfumesForClient = initialPerfumes.map((p) => ({
    ...p,
    image: p.image ?? undefined,
  }))

  return (
    <TheArchiveClient
      initialLetter={isValidLetter ? normalizedLetter : null}
      initialPerfumes={perfumesForClient}
      initialPerfumeTotal={initialTotal}
    />
  )
}

export default TheArchiveLetterPage
