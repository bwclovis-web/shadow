import Image from "next/image"
import { format } from "date-fns"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { getArticleCoverUrl } from "@/lib/sanity/image"
import type { ArticleListItem } from "@/lib/sanity/types"

const BLOG_BASE_PATH = "/behind-the-bottle"

type ArticleCardProps = {
  article: ArticleListItem
}

export const ArticleCard = ({ article }: ArticleCardProps) => {
  const coverUrl = getArticleCoverUrl(article.coverImage, 800, 500)
  const publishedLabel = format(new Date(article.publishedAt), "MMMM d, yyyy")

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
              {article.tags.map((tag) => (
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
