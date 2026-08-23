"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { ArticleCard } from "@/components/Containers/Blog/ArticleCard"
import PageWrapper from "@/components/Containers/PageWrapper/PageWrapper"
import { HOUSE_DETAIL_PATH, THE_ARCHIVE_PATH } from "@/constants/routes"
import type { ArticleListItem } from "@/lib/sanity/types"

type JournalIndexClientProps = {
  articles: ArticleListItem[]
  sanityConfigured: boolean
  /** Confirmed house slug for the CTA (e.g. sorce). */
  spotlightHouseSlug?: string
}

const pickFeaturedArticle = (articles: ArticleListItem[]): ArticleListItem | null =>
  articles.find(a => a.featured === true) ?? null


const collectTags = (articles: ArticleListItem[]): string[] => {
  const set = new Set<string>()
  for (const article of articles) {
    for (const tag of article.tags ?? []) {
      if (tag) set.add(tag)
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

const JournalIndexClient = ({
  articles,
  sanityConfigured,
  spotlightHouseSlug = "sorce",
}: JournalIndexClientProps) => {
  const t = useTranslations("behindTheBottle")
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const featured = pickFeaturedArticle(articles)
  const tags = collectTags(articles)

  const restArticles = featured
    ? articles.filter(a => a._id !== featured._id)
    : articles

  const filteredLatest = activeTag
    ? restArticles.filter(a => (a.tags ?? []).includes(activeTag))
    : restArticles

  const showFeatured =
    featured && (!activeTag || (featured.tags ?? []).includes(activeTag))

  return (
    <main id="main-content">
      <PageWrapper>
        {!sanityConfigured ? (
          <p className="text-center text-noir-gray max-w-xl mx-auto">{t("notConfigured")}</p>
        ) : articles.length === 0 ? (
          <div className="text-center max-w-xl mx-auto space-y-4">
            <p className="text-noir-gray">{t("emptyEditorial")}</p>
            <PrefetchLink
              href={HOUSE_DETAIL_PATH}
              className="inline-flex text-blue-200 underline hover:text-noir-gold font-medium"
            >
              {t("browseHouses")}
            </PrefetchLink>
          </div>
        ) : (
          <div className="space-y-12">
            {showFeatured && featured ? (
              <section className="space-y-4">
                <h2 className="font-headline text-2xl text-noir-gold">{t("featured")}</h2>
                <ArticleCard article={featured} variant="featured" />
              </section>
            ) : null}

            {tags.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-noir-gold-100/80 uppercase tracking-wide">
                  {t("filterByTag")}
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label={t("filterByTag")}>
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className={`text-xs uppercase tracking-wide px-3 py-1.5 border rounded transition-colors ${
                      activeTag === null
                        ? "border-noir-gold bg-noir-gold/20 text-noir-gold"
                        : "border-noir-gold/40 text-noir-gold-100 hover:border-noir-gold/70"
                    }`}
                  >
                    {t("filterAll")}
                  </button>
                  {tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag(tag)}
                      className={`text-xs uppercase tracking-wide px-3 py-1.5 border rounded transition-colors ${
                        activeTag === tag
                          ? "border-noir-gold bg-noir-gold/20 text-noir-gold"
                          : "border-noir-gold/40 text-noir-gold-100 hover:border-noir-gold/70"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {filteredLatest.length > 0 ? (
              <section className="space-y-4">
                <h2 className="font-headline text-2xl text-noir-gold">{t("latest")}</h2>
                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredLatest.map(article => (
                    <ArticleCard key={article._id} article={article} />
                  ))}
                </div>
              </section>
            ) : null}

            <nav
              className="flex flex-col sm:flex-row gap-4 sm:gap-8 pt-4 border-t border-noir-gold/30"
              aria-label={t("ctaNavLabel")}
            >
              <PrefetchLink
                href={`${HOUSE_DETAIL_PATH}/${spotlightHouseSlug}`}
                className="text-blue-200 underline hover:text-noir-gold font-medium"
              >
                {t("ctaHouse")}
              </PrefetchLink>
              <PrefetchLink
                href={THE_ARCHIVE_PATH}
                className="text-blue-200 underline hover:text-noir-gold font-medium"
              >
                {t("ctaArchive")}
              </PrefetchLink>
            </nav>
          </div>
        )}
      </PageWrapper>
    </main>
  )
}

export default JournalIndexClient
