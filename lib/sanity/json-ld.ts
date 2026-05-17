import type { ArticleDetail } from "@/lib/sanity/types"

import { getArticleCoverUrl } from "./image"

const getSiteUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

export const buildArticleJsonLd = (article: ArticleDetail) => {
  const siteUrl = getSiteUrl()
  const url = `${siteUrl}/behind-the-bottle/${article.slug}`
  const imageUrl = getArticleCoverUrl(article.coverImage)

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt ?? undefined,
    datePublished: article.publishedAt,
    author: {
      "@type": "Person",
      name: article.author,
    },
    image: imageUrl ? [imageUrl] : undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
  }
}
