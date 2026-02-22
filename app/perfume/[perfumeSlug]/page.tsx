import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { getPerfumeDetailPayload } from "@/models/perfumeDetail.server"
import { getPerfumeBySlug } from "@/models/perfume.server"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import PerfumeDetailClient from "./PerfumeDetailClient"

export const ROUTE_PATH = "/perfume"
const REVIEWS_PAGE_SIZE = 5

type Props = {
  params: Promise<{ perfumeSlug: string }>
  searchParams: Promise<{ letter?: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { perfumeSlug } = await params
  const perfume = await getPerfumeBySlug(perfumeSlug)
  if (!perfume) {
    return { title: "Perfume not found" }
  }
  const t = await getTranslations("singlePerfume.meta")
  return {
    title: t("title"),
    description: t("description"),
  }
}

export default async function PerfumeDetailPage({
  params,
  searchParams,
}: Props) {
  const { perfumeSlug } = await params
  const resolvedSearchParams = await searchParams

  const cookieStore = await cookies()
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ")

  const [perfume, session] = await Promise.all([
    getPerfumeBySlug(perfumeSlug),
    getSessionFromCookieHeader(cookieHeader, { includeUser: true }),
  ])

  if (!perfume) {
    notFound()
  }

  const payload = await getPerfumeDetailPayload(
    perfume.id,
    session?.userId ?? null,
    REVIEWS_PAGE_SIZE
  )

  return (
    <PerfumeDetailClient
      initialPerfume={perfume}
      user={session?.user ?? null}
      isInUserWishlist={payload.isInUserWishlist}
      userRatings={payload.userRatings}
      averageRatings={payload.averageRatings}
      userReview={payload.userReview}
      reviewsData={payload.reviewsData}
      reviewsPageSize={REVIEWS_PAGE_SIZE}
      similarPerfumes={[]}
      selectedLetter={resolvedSearchParams.letter ?? null}
    />
  )
}
