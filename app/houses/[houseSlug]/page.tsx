import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { getArticlesForHouseSlug } from "@/lib/sanity/articles.server"
import { buildHouseOrganizationJsonLd } from "@/lib/seo/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { truncateDescription } from "@/lib/seo/truncate"
import { getPerfumeHouseBySlug } from "@/models/house.server"
import { getTranslations } from "next-intl/server"
import { houseDetailSortForApi } from "@/utils/house-perfumes-url-params"
import { getSessionFromCookieHeader } from "@/utils/session-from-request.server"
import { getCookieHeader } from "@/utils/server/get-cookie-header.server"

import HouseDetailClient from "./HouseDetailClient"

const DEFAULT_PAGE_SIZE = 8

type Props = {
  params: Promise<{ houseSlug: string }>
  searchParams: Promise<{ pg?: string; letter?: string; q?: string; sort?: string }>
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { houseSlug } = await params
  const perfumeHouse = await getPerfumeHouseBySlug(houseSlug, {
    skip: 0,
    take: DEFAULT_PAGE_SIZE,
  })
  if (!perfumeHouse) {
    return { title: "House not found" }
  }
  const t = await getTranslations("houseDetail.meta")
  const title = t("title", { name: perfumeHouse.name })
  const description =
    truncateDescription(perfumeHouse.description) ??
    t("descriptionFallback", { name: perfumeHouse.name })

  return buildPageMetadata({
    title,
    description,
    canonicalPath: `/houses/${houseSlug}`,
    ogImage: perfumeHouse.image ?? undefined,
  })
}

export default async function HouseDetailPage({ params, searchParams }: Props) {
  const { houseSlug } = await params
  const resolvedSearchParams = await searchParams

  const [perfumeHouse, cookieHeader, relatedArticles] = await Promise.all([
    getPerfumeHouseBySlug(houseSlug, {
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
      sortBy: houseDetailSortForApi(resolvedSearchParams.sort),
      nameSearch: resolvedSearchParams.q ?? null,
    }),
    getCookieHeader(),
    getArticlesForHouseSlug(houseSlug),
  ])
  const session = await getSessionFromCookieHeader(cookieHeader, {
    includeUser: true,
  })

  if (!perfumeHouse) {
    notFound()
  }

  const user = session?.user ?? null

  const jsonLd = buildHouseOrganizationJsonLd({
    name: perfumeHouse.name,
    slug: perfumeHouse.slug,
    description: perfumeHouse.description,
    image: perfumeHouse.image,
    country: perfumeHouse.country,
    founded: perfumeHouse.founded,
    website: perfumeHouse.website,
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HouseDetailClient
        initialPerfumeHouse={perfumeHouse}
        relatedArticles={relatedArticles}
        user={user}
        initialSearchParams={{
          pg: resolvedSearchParams.pg ?? "1",
          letter: resolvedSearchParams.letter ?? undefined,
          q: resolvedSearchParams.q ?? undefined,
          sort: resolvedSearchParams.sort ?? undefined,
        }}
      />
    </>
  )
}
