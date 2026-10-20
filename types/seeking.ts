import type { WishlistBottlePreference } from "@prisma/client"

import type { SeekingVisibilityFilter } from "@/utils/seeking-constants"

/** Narrow Seeking card DTO — no nested offer rows. */
export type SeekingWishlistItemDto = {
  id: string
  perfumeId: string
  isPublic: boolean
  bottlePreference: WishlistBottlePreference
  createdAt: Date
  perfume: {
    id: string
    name: string
    slug: string
    image: string | null
    perfumeHouse: { id: string; name: string; slug: string } | null
  }
  /** Eligible Exchange offer rows (`UserPerfume`); 0 for Still seeking. */
  offerCount: number
  /** Distinct collectors among eligible offers; 0 for Still seeking. */
  collectorCount: number
}

export type SeekingGroupPageMeta = {
  totalCount: number
  pageSize: number
  currentPage: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  /** Inclusive 1-based index of first item on this page, or 0 when empty. */
  showingFrom: number
  /** Inclusive 1-based index of last item on this page, or 0 when empty. */
  showingTo: number
}

export type SeekingGroupPage = {
  items: SeekingWishlistItemDto[]
  meta: SeekingGroupPageMeta
}

export type SeekingVisibilityCounts = {
  all: number
  public: number
  private: number
}

/**
 * `ok` — groups classified with Exchange eligibility.
 * `failed` — eligibility lookup failed; groups are empty and must not be
 * treated as Still seeking.
 */
export type SeekingAvailabilityStatus = "ok" | "failed"

export type OwnedSeekingPageResult = {
  ownerUserId: string
  /** Unfiltered owned wishlist size (hero). */
  heroTotalCount: number
  /** Pill counts for the active search (visibility unrestricted per pill). */
  visibilityCounts: SeekingVisibilityCounts
  visibility: SeekingVisibilityFilter
  search: string
  available: SeekingGroupPage
  stillSeeking: SeekingGroupPage
  availabilityStatus: SeekingAvailabilityStatus
}

export type SeekingGroupQueryOptions = {
  ownerUserId: string
  search?: string | null
  visibility?: SeekingVisibilityFilter
  page?: number
  pageSize?: number
}

/**
 * Public shared Seeking row — perfume + preference only.
 * Never includes private wishlist rows or owner-only fields.
 */
export type PublicSeekingItemDto = {
  id: string
  perfumeId: string
  bottlePreference: WishlistBottlePreference
  createdAt: Date
  perfume: {
    id: string
    name: string
    slug: string
    image: string | null
    perfumeHouse: { id: string; name: string; slug: string } | null
  }
}

export type PublicSeekingPageResult = {
  ownerUserId: string
  items: PublicSeekingItemDto[]
  meta: SeekingGroupPageMeta
}

export type PublicSeekingPageQueryOptions = {
  ownerUserId: string
  page?: number
  pageSize?: number
}
