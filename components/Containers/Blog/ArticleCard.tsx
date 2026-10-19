import Image from "next/image"
import { format } from "date-fns"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { getArticleCoverUrl } from "@/lib/sanity/image"
import type { ArticleListItem } from "@/lib/sanity/types"

import { JOURNAL_PATH } from "@/constants/routes"

const BLOG_BASE_PATH = JOURNAL_PATH

type ArticleCardProps = {
  article: ArticleListItem
  /** `home` renders an h3 card for homepage sections that already own an h2. */
  variant?: "default" | "featured" | "home"
}

export const ArticleCard = ({ article, variant = "default" }: ArticleCardProps) => {
  const isFeatured = variant === "featured"
  const coverUrl = getArticleCoverUrl(
    article.coverImage,
    isFeatured ? 1400 : 800,
    isFeatured ? 700 : 500
  )
  const publishedLabel = format(new Date(article.publishedAt), "MMMM d, yyyy")

  if (variant === "home") {
    return (
      <article className="group relative flex h-full w-full flex-col overflow-hidden border border-noir-gold/70 bg-noir-dark hover:border-noir-gold">
        <PrefetchLink
          href={`${BLOG_BASE_PATH}/${article.slug}`}
          className="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-noir-gold"
          prefetch={false}
        >
          <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-noir-gold/40 bg-noir-black">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={article.coverImage?.alt ?? article.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(min-width: 80rem) 390px, (min-width: 48rem) 33vw, 100vw"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-noir-dark to-noir-black" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-5">
            <h3 className="!text-2xl !leading-tight text-noir-gold transition-colors group-hover:text-noir-gold-100">
              {article.title}
            </h3>
            {article.excerpt ? (
              <p className="line-clamp-3 text-[0.9375rem] leading-relaxed text-noir-light/80 lg:text-base">
                {article.excerpt}
              </p>
            ) : null}
            <p className="mt-auto pt-3 text-[0.8125rem] text-noir-light/60">
              <time dateTime={article.publishedAt}>{publishedLabel}</time>
              {article.author ? ` · ${article.author}` : null}
            </p>
          </div>
        </PrefetchLink>
      </article>
    )
  }

  if (isFeatured) {
    return (
      <article className="group overflow-hidden border border-noir-gold/70 bg-noir-dark/50 hover:border-noir-gold">
        <PrefetchLink
          href={`${BLOG_BASE_PATH}/${article.slug}`}
          className="grid gap-0 md:grid-cols-2"
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
    <article className="group flex h-full flex-col overflow-hidden border border-noir-gold/70 bg-noir-dark/50 hover:border-noir-gold">
      <PrefetchLink
        href={`${BLOG_BASE_PATH}/${article.slug}`}
        className="flex h-full flex-col"
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
