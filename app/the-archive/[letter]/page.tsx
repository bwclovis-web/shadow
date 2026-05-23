import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import TheArchiveClient from "@/app/the-archive/TheArchiveClient"
import { getPerfumesByLetterPaginated } from "@/models/perfume.server"

/** Matches `useResponsivePageSize` initial state (8) until `matchMedia` runs. */
const DEFAULT_PAGE_SIZE = 8

export const generateMetadata = async (): Promise<Metadata> => {
  const t = await getTranslations("allPerfumes.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

type Props = {
  params: Promise<{ letter: string }>
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
