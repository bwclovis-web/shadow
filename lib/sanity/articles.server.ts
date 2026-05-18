import { isSanityConfigured } from "@/sanity/env"

import { sanityFetch } from "./client"
import {
  articleBySlugQuery,
  articlesByHouseSlugQuery,
  articlesByPerfumeSlugQuery,
  articlesIndexQuery,
  articlesIndexWithRefsQuery,
} from "./queries"
import type { ArticleDetail, ArticleListItem } from "./types"

export const getPublishedArticles = async (): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  return sanityFetch<ArticleListItem[]>({
    query: articlesIndexQuery,
    tags: ["articles"],
  })
}

export const getPublishedArticlesWithRefs = async (): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  return sanityFetch<ArticleListItem[]>({
    query: articlesIndexWithRefsQuery,
    tags: ["articles"],
  })
}

export const getArticleBySlug = async (slug: string): Promise<ArticleDetail | null> => {
  if (!isSanityConfigured) return null
  return sanityFetch<ArticleDetail | null>({
    query: articleBySlugQuery,
    params: { slug },
    tags: ["articles", `article:${slug}`],
  })
}

export const getArticlesForPerfumeSlug = async (slug: string): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  return sanityFetch<ArticleListItem[]>({
    query: articlesByPerfumeSlugQuery,
    params: { slug },
    tags: ["articles", `perfume-articles:${slug}`],
  })
}

export const getArticlesForHouseSlug = async (slug: string): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  return sanityFetch<ArticleListItem[]>({
    query: articlesByHouseSlugQuery,
    params: { slug },
    tags: ["articles", `house-articles:${slug}`],
  })
}
