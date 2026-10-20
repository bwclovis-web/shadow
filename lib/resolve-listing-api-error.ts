import { LISTING_ALLOCATION_ERROR_CODES } from "@/lib/listing-allocation-errors"
import { LISTING_PUBLISH_ERROR_CODES } from "@/lib/listing-publish-errors"

type ListingApiErrorPayload = {
  error?: string
  errorCode?: string
}

const LEGACY_PHOTO_REQUIRED_SNIPPET = "listing photo is required"

const ALLOCATION_I18N_KEYS = new Set<string>(
  Object.values(LISTING_ALLOCATION_ERROR_CODES)
)

export const resolveListingApiError = (
  payload: ListingApiErrorPayload,
  tListingErrors: (key: string) => string
): string | null => {
  if (
    payload.errorCode === LISTING_PUBLISH_ERROR_CODES.photoRequired ||
    payload.error?.toLowerCase().includes(LEGACY_PHOTO_REQUIRED_SNIPPET)
  ) {
    return tListingErrors("photoRequired")
  }

  if (payload.errorCode && ALLOCATION_I18N_KEYS.has(payload.errorCode)) {
    try {
      return tListingErrors(payload.errorCode)
    } catch {
      return payload.error ?? null
    }
  }

  return payload.error ?? null
}
