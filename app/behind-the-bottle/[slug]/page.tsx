import type { Metadata } from "next"
import Image from "next/image"
import { format } from "date-fns"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { PortableTextContent } from "@/components/Containers/Blog/PortableTextContent"
import { getArticleBySlug, getPublishedArticles } from "@/lib/sanity/articles.server"
import { getArticleCoverUrl } from "@/lib/sanity/image"
import { buildArticleJsonLd } from "@/lib/sanity/json-ld"
import { isSanityConfigured } from "@/sanity/env"

export const revalidate = 3600

type Props = {
  params: Promise<{ slug: string }>
}

export const generateStaticParams = async () => {
  if (!isSanityConfigured) return []
  const articles = await getPublishedArticles()
  return articles.map((article) => ({ slug: article.slug }))
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) {
    return { title: "Article not found" }
  }

  const ogImage = getArticleCoverUrl(article.coverImage)
  return {
    title: `${article.title} — Behind the Bottle`,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      type: "article",
      publishedTime: article.publishedAt,
      authors: [article.author],
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: article.title }] } : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title: article.title,
      description: article.excerpt ?? undefined,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

const ArticleDetailPage = async ({ params }: Props) => {
  if (!isSanityConfigured) {
    redirect("/houses")
  }

  const { slug } = await params
  const article = await getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  const t = await getTranslations("behindTheBottle.article")
  const coverUrl = getArticleCoverUrl(article.coverImage, 1600, 900)
  const publishedLabel = format(new Date(article.publishedAt), "MMMM d, yyyy")
  const jsonLd = buildArticleJsonLd(article)

  return (
    <article className="inner-container py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PrefetchLink
        href="/behind-the-bottle"
        className="inline-flex text-blue-200 underline hover:text-noir-gold mb-8"
      >
        {t("backToIndex")}
      </PrefetchLink>

      <header className="max-w-3xl mx-auto mb-10">
        <p className="text-noir-gray text-sm mb-3">
          {publishedLabel} · {article.author}
        </p>
        <h1 className="font-headline text-4xl md:text-5xl text-noir-gold mb-4">{article.title}</h1>
        {article.excerpt ? (
          <p className="text-noir-light text-xl leading-relaxed">{article.excerpt}</p>
        ) : null}
        {article.tags && article.tags.length > 0 ? (
          <ul className="mt-6 flex flex-wrap gap-2">
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
      </header>

      {coverUrl ? (
        <div className="relative max-w-4xl mx-auto aspect-[16/9] mb-12 noir-border overflow-hidden">
          <Image
            src={coverUrl}
            alt={article.coverImage?.alt ?? article.title}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 1024px) 896px, 100vw"
          />
        </div>
      ) : null}

      <PortableTextContent value={article.body} />
    </article>
  )
}

export default ArticleDetailPage
