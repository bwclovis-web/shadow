import { LISTING_PUBLISH_ERROR_CODES } from "@/lib/listing-publish-errors"

type ListingApiErrorPayload = {
  error?: string
  errorCode?: string
}

const LEGACY_PHOTO_REQUIRED_SNIPPET = "listing photo is required"

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
  return payload.error ?? null
}
