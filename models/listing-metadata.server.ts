import type { DecantFormat, ListingCondition } from "@prisma/client"

import { deleteFromR2, getR2KeyFromPublicUrl } from "@/lib/r2"
import { DECANT_FORMATS, LISTING_CONDITIONS } from "@/utils/listing-display"
import { isListingPhotoRequired } from "@/utils/listing-config.server"

export type ListingMetadataInput = {
  images: string[]
  condition: ListingCondition | null
  decantFormat: DecantFormat | null
}

const MAX_LISTING_IMAGES = 8

export const parseListingImagesJson = (
  raw: FormDataEntryValue | null
): string[] => {
  if (!raw || typeof raw !== "string" || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
      .slice(0, MAX_LISTING_IMAGES)
  } catch {
    return []
  }
}

const parseCondition = (raw: FormDataEntryValue | null): ListingCondition | null => {
  if (!raw || typeof raw !== "string") return null
  return LISTING_CONDITIONS.includes(raw as ListingCondition)
    ? (raw as ListingCondition)
    : null
}

const parseDecantFormat = (raw: FormDataEntryValue | null): DecantFormat | null => {
  if (!raw || typeof raw !== "string") return null
  return DECANT_FORMATS.includes(raw as DecantFormat) ? (raw as DecantFormat) : null
}

export const parseListingMetadataFromFormData = (
  formData: FormData
): ListingMetadataInput => ({
  images: parseListingImagesJson(formData.get("images")),
  condition: parseCondition(formData.get("condition")),
  decantFormat: parseDecantFormat(formData.get("decantFormat")),
})

export const listingMetadataToPrismaData = (metadata: ListingMetadataInput) => ({
  images: metadata.images,
  condition: metadata.condition,
  decantFormat: metadata.decantFormat,
  mlRemaining: null,
})

export const emptyListingMetadata = (): ListingMetadataInput => ({
  images: [],
  condition: null,
  decantFormat: null,
})

/** Best-effort delete of listing photos uploaded to R2 (`listings/` prefix). */
export const deleteListingImagesFromR2 = async (images: string[]) => {
  for (const url of images) {
    const key = getR2KeyFromPublicUrl(url)
    if (key?.startsWith("listings/")) {
      try {
        await deleteFromR2(key)
      } catch {
        // Do not block unpublish/delete if R2 cleanup fails
      }
    }
  }
}

export const validateListingPublish = (
  availableAmount: string,
  metadata: ListingMetadataInput
): { ok: true } | { ok: false; error: string } => {
  const available = parseFloat(availableAmount?.replace(/[^0-9.]/g, "") || "0")
  if (available <= 0) return { ok: true }

  if (isListingPhotoRequired() && metadata.images.length === 0) {
    return {
      ok: false,
      error: "At least one listing photo is required to publish on the exchange.",
    }
  }

  return { ok: true }
}
