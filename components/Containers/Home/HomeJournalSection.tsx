"use client"

import { useTranslations } from "next-intl"
import { FaArrowRight } from "react-icons/fa6"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { ArticleCard } from "@/components/Containers/Blog/ArticleCard"
import { JOURNAL_PATH } from "@/constants/routes"
import type { ArticleListItem } from "@/lib/sanity/types"

type HomeJournalSectionProps = {
  articles: ArticleListItem[]
}

const HomeJournalSection = ({ articles }: HomeJournalSectionProps) => {
  const t = useTranslations("home.galleryWalk.journal")

  if (articles.length === 0) return null

  return (
    <section
      className="bg-noir-black py-5 lg:py-6"
      aria-labelledby="home-journal-heading"
    >
      <div className="mx-auto w-full max-w-[1280px] px-5 sm:px-8 lg:px-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2
              id="home-journal-heading"
              className="!text-[clamp(1.625rem,2.1vw,1.875rem)] !font-semibold"
            >
              {t("title")}
            </h2>
            <p className="mt-1 text-sm text-noir-light/75">
              {t("description")}
            </p>
          </div>
          <PrefetchLink
            href={JOURNAL_PATH}
            className="inline-flex items-center gap-2 text-sm font-medium text-noir-gold hover:text-noir-gold-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"
          >
            {t("viewAll")}
            <FaArrowRight aria-hidden className="h-3 w-3" />
          </PrefetchLink>
        </div>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-3 min-[75rem]:gap-5">
          {articles.map(article => (
            <li key={article._id} className="flex">
              <ArticleCard article={article} variant="home" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default HomeJournalSection
