import type { Metadata } from "next"
import Image from "next/image"
import { format } from "date-fns"
import { notFound, redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"

import { PrefetchLink } from "@/components/Atoms/PrefetchLink"
import { PortableTextContent } from "@/components/Containers/Blog/PortableTextContent"
import { HOUSE_DETAIL_PATH, JOURNAL_PATH, PERFUME_PATH } from "@/constants/routes"
import { getArticleBySlug, getAllPublishedArticles } from "@/lib/sanity/articles.server"
import { getArticleCoverUrl } from "@/lib/sanity/image"
import { buildArticleJsonLd } from "@/lib/sanity/json-ld"
import { buildPageMetadata } from "@/lib/seo/metadata"
import { isSanityConfigured } from "@/sanity/env"

export const revalidate = 60

type Props = {
  params: Promise<{ slug: string }>
}

export const generateStaticParams = async () => {
  if (!isSanityConfigured) return []
  const articles = await getAllPublishedArticles()
  const seen = new Set<string>()
  return articles.flatMap(article => {
    if (!article.slug || seen.has(article.slug)) return []
    seen.add(article.slug)
    return [{ slug: article.slug }]
  })
}

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) {
    return { title: "Article not found", robots: { index: false, follow: false } }
  }

  const ogImage = getArticleCoverUrl(article.coverImage)
  const title = `${article.title} — Journal`
  const base = buildPageMetadata({
    title,
    description: article.excerpt ?? undefined,
    canonicalPath: `/journal/${slug}`,
    ogImage: ogImage
      ? { url: ogImage, width: 1200, height: 630, alt: article.title }
      : undefined,
    ogType: "article",
  })

  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: "article",
      publishedTime: article.publishedAt,
      authors: [article.author],
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
        href={JOURNAL_PATH}
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

      {(article.houseRefs && article.houseRefs.length > 0) ||
      (article.perfumeRefs && article.perfumeRefs.length > 0) ? (
        <aside className="max-w-3xl mx-auto mt-12 pt-10 border-t border-noir-gold/40 space-y-8">
          {article.houseRefs && article.houseRefs.length > 0 ? (
            <section>
              <h2 className="font-headline text-2xl text-noir-gold mb-4">
                {t("exploreHouses")}
              </h2>
              <ul className="flex flex-wrap gap-3">
                {article.houseRefs.map(houseSlug => (
                  <li key={houseSlug}>
                    <PrefetchLink
                      href={`${HOUSE_DETAIL_PATH}/${houseSlug}`}
                      className="text-blue-200 underline hover:text-noir-gold"
                    >
                      {houseSlug.replace(/-/g, " ")}
                    </PrefetchLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {article.perfumeRefs && article.perfumeRefs.length > 0 ? (
            <section>
              <h2 className="font-headline text-2xl text-noir-gold mb-4">
                {t("explorePerfumes")}
              </h2>
              <ul className="flex flex-wrap gap-3">
                {article.perfumeRefs.map(perfumeSlug => (
                  <li key={perfumeSlug}>
                    <PrefetchLink
                      href={`${PERFUME_PATH}/${perfumeSlug}`}
                      className="text-blue-200 underline hover:text-noir-gold"
                    >
                      {perfumeSlug.replace(/-/g, " ")}
                    </PrefetchLink>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      ) : null}
    </article>
  )
}

export default ArticleDetailPage
