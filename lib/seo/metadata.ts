import type { Metadata } from "next"

import { absoluteUrl } from "@/lib/seo/site-url"
import { truncateDescription } from "@/lib/seo/truncate"

type OgImageInput = string | { url: string; width?: number; height?: number; alt?: string }

const toOgImages = (image: OgImageInput | undefined) => {
  if (!image) return undefined
  if (typeof image === "string") {
    const url = image.startsWith("http") ? image : absoluteUrl(image)
    return [{ url }]
  }
  const url = image.url.startsWith("http") ? image.url : absoluteUrl(image.url)
  return [
    {
      url,
      width: image.width,
      height: image.height,
      alt: image.alt,
    },
  ]
}

type PageMetadataInput = {
  title: string
  description?: string | null
  canonicalPath: string
  ogImage?: OgImageInput
  ogType?: "website" | "article" | "profile"
}

export const buildPageMetadata = ({
  title,
  description,
  canonicalPath,
  ogImage,
  ogType = "website",
}: PageMetadataInput): Metadata => {
  const desc = truncateDescription(description)
  const canonical = absoluteUrl(canonicalPath)
  const images = toOgImages(ogImage)

  return {
    title,
    description: desc,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      type: ogType,
      siteName: "Shadow and Sillage",
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description: desc,
      ...(images ? { images: images.map((img) => img.url) } : {}),
    },
  }
}
