import { absoluteUrl } from "@/lib/seo/site-url"

type NoteLike = { name?: string | null } | string

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
