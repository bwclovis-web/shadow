import type { Metadata } from "next"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { getArticlesForPerfumeSlug } from "@/lib/sanity/articles.server"
import {
  buildBreadcrumbListJsonLd,
  buildPerfumeProductJsonLd,
} from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { truncateDescription } from "@/lib/seo/truncate"
import { getFollowStateForViewer } from "@/models/user-follow.server"
import { getPerfumeDetailPayload } from "@/models/perfumeDetail.server"
import { selectionFromVoteRow } from "@/models/perfumeSeasonVote.server"
import { getPerfumeBySlug } from "@/models/perfume.server"
import { rulesRecommendationService } from "@/services/recommendations"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"

import PerfumeDetailClient from "./PerfumeDetailClient"

const REVIEWS_PAGE_SIZE = 5
const SIMILAR_PERFUMES_LIMIT = 6

type Props = {
  params: Promise<{ perfumeSlug: string }>
  searchParams: Promise<{ letter?: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { perfumeSlug } = await params
  const perfume = await getPerfumeBySlug(perfumeSlug)
  if (!perfume) {
    return {
      title: "Perfume not found",
      robots: { index: false, follow: false },
    }
  }
  const t = await getTranslations("singlePerfume.meta")
  const houseName = perfume.perfumeHouse?.name
  const title = houseName
    ? t("titleWithHouse", { name: perfume.name, house: houseName })
    : t("titleStandalone", { name: perfume.name })
  const description =
    truncateDescription(perfume.description) ??
    (houseName
      ? t("descriptionWithHouse", { name: perfume.name, house: houseName })
      : t("descriptionStandalone", { name: perfume.name }))

  return buildPageMetadata({
    title,
    description,
    canonicalPath: `/perfume/${perfumeSlug}`,
    ogImage: perfume.image ?? undefined,
  })
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

  const viewerId = session?.userId ?? null
  const [payload, similarPerfumes, relatedArticles, followState] = await Promise.all([
    getPerfumeDetailPayload(
      perfume.id,
      session?.userId ?? null,
      REVIEWS_PAGE_SIZE
    ),
    rulesRecommendationService
      .getSimilarPerfumes(perfume.id, SIMILAR_PERFUMES_LIMIT, {
        userId: session?.userId,
      })
      .catch((err) => {
        console.warn(
          "[perfume] getSimilarPerfumes failed, showing none:",
          err?.message ?? err
        )
        return []
      }),
    getArticlesForPerfumeSlug(perfumeSlug),
    getFollowStateForViewer(viewerId, "perfume", perfume.id),
  ])

  const overall = payload.averageRatings.overall
  const ratingCount = payload.averageRatings.totalRatings
  const productJsonLd = buildPerfumeProductJsonLd({
    name: perfume.name,
    slug: perfume.slug,
    description: perfume.description,
    image: perfume.image,
    perfumeHouse: perfume.perfumeHouse
      ? { name: perfume.perfumeHouse.name, slug: perfume.perfumeHouse.slug }
      : null,
    openNotes: perfume.perfumeNotesOpen,
    heartNotes: perfume.perfumeNotesHeart,
    baseNotes: perfume.perfumeNotesClose,
    aggregateRating:
      overall != null && ratingCount >= 1
        ? { ratingValue: overall, ratingCount }
        : null,
  })

  const house = perfume.perfumeHouse
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd(
    house
      ? [
          { name: "Home", path: "/" },
          { name: "Houses", path: "/houses" },
          { name: house.name, path: `/houses/${house.slug}` },
          { name: perfume.name, path: `/perfume/${perfume.slug}` },
        ]
      : [
          { name: "Home", path: "/" },
          { name: "The Archive", path: "/the-archive" },
          ...(resolvedSearchParams.letter
            ? [
                {
                  name: resolvedSearchParams.letter.toUpperCase(),
                  path: `/the-archive/${resolvedSearchParams.letter.toUpperCase()}`,
                },
              ]
            : []),
          { name: perfume.name, path: `/perfume/${perfume.slug}` },
        ],
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PerfumeDetailClient
      initialPerfume={perfume}
      user={session?.user ?? null}
      isInUserWishlist={payload.isInUserWishlist}
      userRatings={payload.userRatings}
      averageRatings={payload.averageRatings}
      seasonAggregates={payload.seasonAggregates}
      userSeasonVote={
        payload.userSeasonVote
          ? selectionFromVoteRow(payload.userSeasonVote)
          : null
      }
      userReview={payload.userReview}
      reviewsData={payload.reviewsData}
      reviewsPageSize={REVIEWS_PAGE_SIZE}
      similarPerfumes={similarPerfumes}
      relatedArticles={relatedArticles}
      initialFollowing={followState.following}
      selectedLetter={resolvedSearchParams.letter ?? null}
    />
    </>
  )
}
