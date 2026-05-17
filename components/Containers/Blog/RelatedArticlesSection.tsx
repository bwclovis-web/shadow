"use client"

import { useTranslations } from "next-intl"

import { ArticleCard } from "@/components/Containers/Blog/ArticleCard"
import type { ArticleListItem } from "@/lib/sanity/types"

type RelatedArticlesSectionProps = {
  articles: ArticleListItem[]
}

export const RelatedArticlesSection = ({ articles }: RelatedArticlesSectionProps) => {
  const t = useTranslations("behindTheBottle.related")

  if (articles.length === 0) return null

  return (
    <section className="w-full mt-12 pt-10 border-t border-noir-gold/40">
      <h2 className="font-headline text-2xl text-noir-gold mb-6">{t("heading")}</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article._id} article={article} />
        ))}
      </div>
    </section>
  )
}
