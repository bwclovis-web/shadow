import type {
  AllocationAcceptResult,
  StrictMlParseFailureReason,
} from "@/lib/decant-split-ml"

/** Structured allocation / destash volume error codes (API `errorCode`). */
export const LISTING_ALLOCATION_ERROR_CODES = {
  invalidVolume: "invalidVolume",
  ownershipUnknown: "ownershipUnknown",
  noOwnedVolume: "noOwnedVolume",
  exceedsAvailable: "exceedsAvailable",
  wouldInvalidateAllocations: "wouldInvalidateAllocations",
  sourceBottleInUse: "sourceBottleInUse",
  conflictRetryExhausted: "conflictRetryExhausted",
} as const

export type ListingAllocationErrorCode =
  (typeof LISTING_ALLOCATION_ERROR_CODES)[keyof typeof LISTING_ALLOCATION_ERROR_CODES]

export const ALLOCATION_ERROR_MESSAGES: Record<ListingAllocationErrorCode, string> = {
  invalidVolume:
    "Enter a valid volume in millilitres (non-negative number, no units).",
  ownershipUnknown:
    "Owned volume for this fragrance is unknown or not numeric. Edit the bottle amount to a number of millilitres before allocating.",
  noOwnedVolume:
    "No known owned millilitres for this fragrance. Add inventory with a numeric amount before allocating.",
  exceedsAvailable:
    "Not enough pourable millilitres left after active destashes, split reservations, and completed pours.",
  wouldInvalidateAllocations:
    "This change would leave active destashes or splits exceeding known owned millilitres.",
  sourceBottleInUse:
    "This bottle is the source for an active group split and cannot be removed until the split completes or is cancelled.",
  conflictRetryExhausted:
    "Another allocation was in progress. Please try again.",
}

export class AllocationValidationError extends Error {
  readonly errorCode: ListingAllocationErrorCode

  constructor(errorCode: ListingAllocationErrorCode, message?: string) {
    super(message ?? ALLOCATION_ERROR_MESSAGES[errorCode])
    this.name = "AllocationValidationError"
    this.errorCode = errorCode
  }
}

export const allocationErrorFromAccept = (
  result: Extract<AllocationAcceptResult, { ok: false }>
): { success: false; errorCode: ListingAllocationErrorCode; error: string } => {
  const errorCode =
    result.reason === "invalid_volume"
      ? LISTING_ALLOCATION_ERROR_CODES.invalidVolume
      : result.reason === "ownership_unknown"
        ? LISTING_ALLOCATION_ERROR_CODES.ownershipUnknown
        : result.reason === "no_owned_volume"
          ? LISTING_ALLOCATION_ERROR_CODES.noOwnedVolume
          : LISTING_ALLOCATION_ERROR_CODES.exceedsAvailable

  const detail =
    result.reason === "invalid_volume" && result.parseReason
      ? invalidVolumeDetail(result.parseReason)
      : ALLOCATION_ERROR_MESSAGES[errorCode]

  return { success: false, errorCode, error: detail }
}

const invalidVolumeDetail = (reason: StrictMlParseFailureReason): string => {
  switch (reason) {
    case "empty":
      return "Volume is required."
    case "negative":
      return "Volume cannot be negative."
    case "non_finite":
      return "Volume must be a finite number."
    default:
      return ALLOCATION_ERROR_MESSAGES.invalidVolume
  }
}
