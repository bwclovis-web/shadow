"use client"

import { useTranslations } from "next-intl"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { ArticleCard } from "@/components/Containers/Blog/ArticleCard"
import type { ArticleListItem } from "@/lib/sanity/types"

type BehindTheBottleIndexClientProps = {
  articles: ArticleListItem[]
  sanityConfigured: boolean
}

const BehindTheBottleIndexClient = ({
  articles,
  sanityConfigured,
}: BehindTheBottleIndexClientProps) => {
  const t = useTranslations("behindTheBottle")

  return (
    <section className="inner-container py-12">
      <header className="max-w-3xl mx-auto text-center mb-12">
        <p className="text-noir-gold-100 uppercase tracking-widest text-sm mb-3">{t("eyebrow")}</p>
        <h1 className="font-headline text-4xl md:text-5xl text-noir-gold mb-4">{t("heading")}</h1>
        <p className="text-noir-light text-lg leading-relaxed mb-6">{t("subheading")}</p>
        <PrefetchLink
          href="/houses"
          className="inline-flex text-blue-200 underline hover:text-noir-gold font-medium"
        >
          {t("browseHouses")}
        </PrefetchLink>
      </header>

      {!sanityConfigured ? (
        <p className="text-center text-noir-gray max-w-xl mx-auto">{t("notConfigured")}</p>
      ) : articles.length === 0 ? (
        <p className="text-center text-noir-gray max-w-xl mx-auto">{t("empty")}</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article._id} article={article} />
          ))}
        </div>
      )}
    </section>
  )
}

export default BehindTheBottleIndexClient
