import Image from "next/image"
import { format } from "date-fns"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { getArticleCoverUrl } from "@/lib/sanity/image"
import type { ArticleListItem } from "@/lib/sanity/types"

import { JOURNAL_PATH } from "@/constants/routes"

const BLOG_BASE_PATH = JOURNAL_PATH

type ArticleCardProps = {
  article: ArticleListItem
  variant?: "default" | "featured"
}

export const ArticleCard = ({ article, variant = "default" }: ArticleCardProps) => {
  const isFeatured = variant === "featured"
  const coverUrl = getArticleCoverUrl(
    article.coverImage,
    isFeatured ? 1400 : 800,
    isFeatured ? 700 : 500
  )
  const publishedLabel = format(new Date(article.publishedAt), "MMMM d, yyyy")

  if (isFeatured) {
    return (
      <article className="group noir-border bg-noir-dark/50 overflow-hidden">
        <PrefetchLink
          href={`${BLOG_BASE_PATH}/${article.slug}`}
          className="grid md:grid-cols-2 gap-0"
          prefetch={false}
        >
          <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[280px] w-full bg-noir-black overflow-hidden">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={article.coverImage?.alt ?? article.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(min-width: 768px) 50vw, 100vw"
                priority
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-noir-dark to-noir-black" />
            )}
          </div>
          <div className="p-6 md:p-8 flex flex-col gap-3 justify-center">
            <p className="text-sm text-noir-gray">
              {publishedLabel} · {article.author}
            </p>
            <h2 className="font-headline text-2xl md:text-3xl text-noir-gold group-hover:text-noir-gold-500 transition-colors">
              {article.title}
            </h2>
            {article.excerpt ? (
              <p className="text-noir-light text-base md:text-lg leading-relaxed line-clamp-5">
                {article.excerpt}
              </p>
            ) : null}
            {article.tags && article.tags.length > 0 ? (
              <ul className="pt-2 flex flex-wrap gap-2">
                {article.tags.map(tag => (
                  <li
                    key={tag}
                    className="text-xs uppercase tracking-wide px-2 py-0.5 border border-noir-gold/40 text-noir-gold-100"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </PrefetchLink>
      </article>
    )
  }

  return (
    <article className="group noir-border bg-noir-dark/50 overflow-hidden flex flex-col h-full">
      <PrefetchLink
        href={`${BLOG_BASE_PATH}/${article.slug}`}
        className="flex flex-col h-full"
        prefetch={false}
      >
        <div className="relative aspect-[16/10] w-full bg-noir-black overflow-hidden">
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={article.coverImage?.alt ?? article.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(min-width: 1024px) 33vw, 100vw"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-noir-dark to-noir-black" />
          )}
        </div>
        <div className="p-5 flex flex-col gap-2 flex-1">
          <p className="text-sm text-noir-gray">
            {publishedLabel} · {article.author}
          </p>
          <h2 className="font-headline text-xl text-noir-gold group-hover:text-noir-gold-500 transition-colors">
            {article.title}
          </h2>
          {article.excerpt ? (
            <p className="text-noir-light text-base leading-relaxed line-clamp-3">{article.excerpt}</p>
          ) : null}
          {article.tags && article.tags.length > 0 ? (
            <ul className="mt-auto pt-3 flex flex-wrap gap-2">
              {article.tags.map(tag => (
                <li
                  key={tag}
                  className="text-xs uppercase tracking-wide px-2 py-0.5 border border-noir-gold/40 text-noir-gold-100"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </PrefetchLink>
    </article>
  )
}
