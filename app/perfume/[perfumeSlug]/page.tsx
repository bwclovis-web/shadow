import type { Metadata } from "next"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { getPerfumeDetailPayload } from "@/models/perfumeDetail.server"
import { getPerfumeBySlug } from "@/models/perfume.server"
import { rulesRecommendationService } from "@/services/recommendations"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import PerfumeDetailClient from "./PerfumeDetailClient"

const REVIEWS_PAGE_SIZE = 5
const SIMILAR_PERFUMES_LIMIT = 4

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

  const cookieHeader = await getCookieHeader()

  const [perfume, session] = await Promise.all([
    getPerfumeBySlug(perfumeSlug),
    getSessionFromCookieHeader(cookieHeader, { includeUser: true }),
  ])

  if (!perfume) {
    notFound()
  }

  const [payload, similarPerfumes] = await Promise.all([
    getPerfumeDetailPayload(
      perfume.id,
      session?.userId ?? null,
      REVIEWS_PAGE_SIZE
    ),
    rulesRecommendationService
      .getSimilarPerfumes(perfume.id, SIMILAR_PERFUMES_LIMIT)
      .catch((err) => {
        console.warn(
          "[perfume] getSimilarPerfumes failed, showing none:",
          err?.message ?? err
        )
        return []
      }),
  ])

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-noir-gold border-t-transparent" />
        </div>
      }
    >
      <PerfumeDetailClient
        initialPerfume={perfume}
        user={session?.user ?? null}
        isInUserWishlist={payload.isInUserWishlist}
        userRatings={payload.userRatings}
        averageRatings={payload.averageRatings}
        userReview={payload.userReview}
        reviewsData={payload.reviewsData}
        reviewsPageSize={REVIEWS_PAGE_SIZE}
        similarPerfumes={similarPerfumes}
        selectedLetter={resolvedSearchParams.letter ?? null}
      />
    </Suspense>
  )
}
