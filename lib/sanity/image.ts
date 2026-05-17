import createImageUrlBuilder, { type SanityImageSource } from "@sanity/image-url"

import { dataset, isSanityConfigured, projectId } from "@/sanity/env"

const getBuilder = () => {
  if (!isSanityConfigured) return null
  return createImageUrlBuilder({ projectId, dataset })
}

export const urlForImage = (source: SanityImageSource) => {
  const builder = getBuilder()
  if (!builder) {
    throw new Error("Sanity image URLs require NEXT_PUBLIC_SANITY_PROJECT_ID")
  }
  return builder.image(source)
}

export const getArticleCoverUrl = (
  source: SanityImageSource | null | undefined,
  width = 1200,
  height = 630
) => {
  if (!source || !isSanityConfigured) return null
  const builder = getBuilder()
  if (!builder) return null
  return builder.image(source).width(width).height(height).fit("crop").auto("format").url()
}
