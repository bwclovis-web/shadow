import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getPerfumesByLetterPaginated } from "@/models/perfume.server"

import TheVaultClient from "../TheVaultClient"

export const ROUTE_PATH = "/the-vault"

const DEFAULT_PAGE_SIZE = 16

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

const TheVaultLetterPage = async ({ params }: Props) => {
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
    <TheVaultClient
      initialLetter={isValidLetter ? normalizedLetter : null}
      initialPerfumes={perfumesForClient}
      initialPerfumeTotal={initialTotal}
    />
  )
}

export default TheVaultLetterPage
