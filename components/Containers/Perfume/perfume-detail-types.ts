import type { RatingData } from "@/hooks/useRatingSystem"

/**
 * Shared prop types for perfume detail payload → PerfumeDetailClient → PerfumeRatingSystem.
 * Use these instead of `unknown` or `as never` so the chain is type-safe.
 */

/** User's own ratings for a perfume (from getUserPerfumeRating or null). Compatible with Prisma UserPerfumeRating. */
export type PerfumeDetailUserRatingsProp = RatingData | null

/** Aggregate ratings for a perfume (from getPerfumeRatings). */
export type PerfumeDetailAverageRatingsProp = (RatingData & { totalRatings: number }) | null
