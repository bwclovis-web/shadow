import { getLocale } from "next-intl/server"

import { isSanityConfigured } from "@/sanity/env"

import { sanityFetch } from "./client"
import {
  DEFAULT_JOURNAL_LOCALE,
  normalizeJournalLocale,
  type JournalLocale,
} from "./locales"
import {
  articleBySlugQuery,
  articlesByHouseSlugQuery,
  articlesByPerfumeSlugQuery,
  articlesIndexAllLanguagesQuery,
  articlesIndexQuery,
  articlesIndexWithRefsQuery,
} from "./queries"
import type { ArticleDetail, ArticleListItem } from "./types"

const resolveLanguage = async (language?: JournalLocale): Promise<JournalLocale> => {
  if (language) return language
  return normalizeJournalLocale(await getLocale())
}

const fetchIndexForLanguage = async (
  language: JournalLocale,
  withRefs: boolean
): Promise<ArticleListItem[]> =>
  sanityFetch<ArticleListItem[]>({
    query: withRefs ? articlesIndexWithRefsQuery : articlesIndexQuery,
    params: { language },
    tags: ["articles", `articles:${language}`],
  })

const withEnglishFallback = async (
  language: JournalLocale,
  withRefs: boolean
): Promise<ArticleListItem[]> => {
  const primary = await fetchIndexForLanguage(language, withRefs)
  if (primary.length > 0 || language === DEFAULT_JOURNAL_LOCALE) {
    return primary
  }
  return fetchIndexForLanguage(DEFAULT_JOURNAL_LOCALE, withRefs)
}

export const getPublishedArticles = async (
  language?: JournalLocale
): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  const locale = await resolveLanguage(language)
  return withEnglishFallback(locale, false)
}

export const getPublishedArticlesWithRefs = async (
  language?: JournalLocale
): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  const locale = await resolveLanguage(language)
  return withEnglishFallback(locale, true)
}

/** Every published article across languages (sitemap / static generation). */
export const getAllPublishedArticles = async (): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  return sanityFetch<ArticleListItem[]>({
    query: articlesIndexAllLanguagesQuery,
    tags: ["articles"],
  })
}

export const getArticleBySlug = async (
  slug: string,
  language?: JournalLocale
): Promise<ArticleDetail | null> => {
  if (!isSanityConfigured) return null
  const locale = await resolveLanguage(language)
  const article = await sanityFetch<ArticleDetail | null>({
    query: articleBySlugQuery,
    params: { slug, language: locale },
    tags: ["articles", `article:${slug}`, `articles:${locale}`],
  })
  if (article || locale === DEFAULT_JOURNAL_LOCALE) {
    return article
  }
  return sanityFetch<ArticleDetail | null>({
    query: articleBySlugQuery,
    params: { slug, language: DEFAULT_JOURNAL_LOCALE },
    tags: ["articles", `article:${slug}`, `articles:${DEFAULT_JOURNAL_LOCALE}`],
  })
}

export const getArticlesForPerfumeSlug = async (
  slug: string,
  language?: JournalLocale
): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  const locale = await resolveLanguage(language)
  const primary = await sanityFetch<ArticleListItem[]>({
    query: articlesByPerfumeSlugQuery,
    params: { slug, language: locale },
    tags: ["articles", `perfume-articles:${slug}`, `articles:${locale}`],
  })
  if (primary.length > 0 || locale === DEFAULT_JOURNAL_LOCALE) {
    return primary
  }
  return sanityFetch<ArticleListItem[]>({
    query: articlesByPerfumeSlugQuery,
    params: { slug, language: DEFAULT_JOURNAL_LOCALE },
    tags: ["articles", `perfume-articles:${slug}`, `articles:${DEFAULT_JOURNAL_LOCALE}`],
  })
}

export const getArticlesForHouseSlug = async (
  slug: string,
  language?: JournalLocale
): Promise<ArticleListItem[]> => {
  if (!isSanityConfigured) return []
  const locale = await resolveLanguage(language)
  const primary = await sanityFetch<ArticleListItem[]>({
    query: articlesByHouseSlugQuery,
    params: { slug, language: locale },
    tags: ["articles", `house-articles:${slug}`, `articles:${locale}`],
  })
  if (primary.length > 0 || locale === DEFAULT_JOURNAL_LOCALE) {
    return primary
  }
  return sanityFetch<ArticleListItem[]>({
    query: articlesByHouseSlugQuery,
    params: { slug, language: DEFAULT_JOURNAL_LOCALE },
    tags: ["articles", `house-articles:${slug}`, `articles:${DEFAULT_JOURNAL_LOCALE}`],
  })
}
