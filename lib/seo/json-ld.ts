import { absoluteUrl } from "@/lib/seo/site-url"

type PerfumeForJsonLd = {
  name: string
  slug: string
  description?: string | null
  image?: string | null
  perfumeHouse?: { name: string; slug: string } | null
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

export const buildPerfumeProductJsonLd = (perfume: PerfumeForJsonLd) => {
  const url = absoluteUrl(`/perfume/${perfume.slug}`)
  const brandName = perfume.perfumeHouse?.name

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
        }
      : undefined,
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
