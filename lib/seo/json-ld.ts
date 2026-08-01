import { getSiteContactEmail } from "@/lib/seo/site-contact"
import { absoluteUrl } from "@/lib/seo/site-url"

const SITE_NAME = "perfumer's hollow"
const SITE_LOGO_PATH = "/images/new/logo-one.webp"

type NoteLike = { name?: string | null } | string

export type PerfumeReviewForJsonLd = {
  author: string
  reviewBody: string
  datePublished?: string | null
  ratingValue?: number | null
}

type PerfumeForJsonLd = {
  name: string
  slug: string
  description?: string | null
  image?: string | null
  perfumeHouse?: { name: string; slug: string } | null
  openNotes?: NoteLike[] | null
  heartNotes?: NoteLike[] | null
  baseNotes?: NoteLike[] | null
  aggregateRating?: {
    ratingValue: number
    ratingCount: number
  } | null
  reviews?: PerfumeReviewForJsonLd[] | null
}

type HouseForJsonLd = {
  name: string
  slug: string
  description?: string | null
  image?: string | null
  country?: string | null
  founded?: string | null
  website?: string | null
}

type BreadcrumbItem = {
  name: string
  path: string
}

type FaqItem = {
  question: string
  answer: string
}

type ItemListEntry = {
  name: string
  path: string
}

const noteNames = (notes: NoteLike[] | null | undefined): string[] => {
  if (!notes?.length) return []
  return notes
    .map(n => (typeof n === "string" ? n : n?.name)?.trim())
    .filter((n): n is string => Boolean(n))
}

const buildNoteProperties = (perfume: PerfumeForJsonLd) => {
  const layers: { name: string; notes: string[] }[] = [
    { name: "Top notes", notes: noteNames(perfume.openNotes) },
    { name: "Heart notes", notes: noteNames(perfume.heartNotes) },
    { name: "Base notes", notes: noteNames(perfume.baseNotes) },
  ]
  const props = layers
    .filter(layer => layer.notes.length > 0)
    .map(layer => ({
      "@type": "PropertyValue" as const,
      name: layer.name,
      value: layer.notes.join(", "),
    }))
  return props.length > 0 ? props : undefined
}

const buildReviewNodes = (reviews: PerfumeReviewForJsonLd[] | null | undefined) => {
  if (!reviews?.length) return undefined
  const nodes = reviews
    .map(review => {
      const author = review.author.trim()
      const body = review.reviewBody.trim()
      if (!author || !body) return null
      const rating =
        review.ratingValue != null && Number.isFinite(review.ratingValue)
          ? {
              reviewRating: {
                "@type": "Rating" as const,
                ratingValue: review.ratingValue,
                bestRating: 5,
                worstRating: 1,
              },
            }
          : {}
      return {
        "@type": "Review" as const,
        author: { "@type": "Person" as const, name: author },
        reviewBody: body,
        ...(review.datePublished
          ? { datePublished: review.datePublished }
          : {}),
        ...rating,
      }
    })
    .filter((node): node is NonNullable<typeof node> => node != null)
  return nodes.length > 0 ? nodes : undefined
}

export const buildPerfumeProductJsonLd = (perfume: PerfumeForJsonLd) => {
  const url = absoluteUrl(`/perfume/${perfume.slug}`)
  const brandName = perfume.perfumeHouse?.name
  const houseSlug = perfume.perfumeHouse?.slug
  const additionalProperty = buildNoteProperties(perfume)
  const rating = perfume.aggregateRating
  const hasRating =
    rating != null &&
    Number.isFinite(rating.ratingValue) &&
    rating.ratingCount >= 1
  const review = buildReviewNodes(perfume.reviews)

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: perfume.name,
    description: perfume.description?.trim() || undefined,
    image: perfume.image ? [perfume.image] : undefined,
    url,
    brand: brandName
      ? {
          "@type": "Brand",
          name: brandName,
          ...(houseSlug
            ? { url: absoluteUrl(`/houses/${houseSlug}`) }
            : {}),
        }
      : undefined,
    ...(additionalProperty ? { additionalProperty } : {}),
    ...(hasRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.ratingValue,
            ratingCount: rating.ratingCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(review ? { review } : {}),
  }
}

export const buildHouseOrganizationJsonLd = (house: HouseForJsonLd) => {
  const url = absoluteUrl(`/houses/${house.slug}`)

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: house.name,
    description: house.description?.trim() || undefined,
    url: house.website?.trim() || url,
    logo: house.image ?? undefined,
    ...(house.country ? { address: { "@type": "PostalAddress", addressCountry: house.country } } : {}),
    ...(house.founded?.trim() ? { foundingDate: house.founded.trim() } : {}),
  }
}

export const buildBreadcrumbListJsonLd = (items: BreadcrumbItem[]) => {
  const list = items.filter(item => item.name.trim() && item.path)
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: list.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

export const buildSiteOrganizationJsonLd = () => {
  const url = absoluteUrl("/")
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url,
    logo: absoluteUrl(SITE_LOGO_PATH),
    email: getSiteContactEmail(),
  }
}

export const buildWebSiteJsonLd = () => {
  const url = absoluteUrl("/")
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/the-archive")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

export const buildFaqPageJsonLd = (items: FaqItem[]) => {
  const entities = items
    .map(item => {
      const question = item.question.trim()
      const answer = item.answer.trim()
      if (!question || !answer) return null
      return {
        "@type": "Question" as const,
        name: question,
        acceptedAnswer: {
          "@type": "Answer" as const,
          text: answer,
        },
      }
    })
    .filter((node): node is NonNullable<typeof node> => node != null)

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entities,
  }
}

export const buildItemListJsonLd = ({
  name,
  path,
  items,
}: {
  name: string
  path: string
  items: ItemListEntry[]
}) => {
  const list = items.filter(item => item.name.trim() && item.path)
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: name.trim() || undefined,
    url: absoluteUrl(path),
    numberOfItems: list.length,
    itemListElement: list.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}
