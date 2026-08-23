/**
 * Default number of perfumes to return for profile "Recommended for you" and similar UIs.
 */
export const DEFAULT_RECOMMENDATIONS_LIMIT = 6

/**
 * Why a perfume was recommended (rules-based); optional for forward-compatible callers.
 */
export type RecommendationBoostFlags = {
  seasonAligned?: boolean
  priceAligned?: boolean
  houseTierAligned?: boolean
  concentrationAligned?: boolean
}

export type RecommendationReason =
  | {
      kind: "similar_notes"
      sharedNoteNames: string[]
      sharedCount: number
      boosts?: RecommendationBoostFlags
    }
  | {
      kind: "profile_match"
      matchedNoteNames: string[]
      boosts?: RecommendationBoostFlags
    }
  | { kind: "popular"; boosts?: RecommendationBoostFlags }
  | { kind: "recent"; boosts?: RecommendationBoostFlags }
  /** Shown when note overlap is missing but picks are from the same house. */
  | { kind: "same_house"; boosts?: RecommendationBoostFlags }

/**
 * Minimal perfume shape returned by recommendation services.
 * Keeps the interface stable so ML or other implementations can be swapped in.
 */
export interface RecommendationPerfume {
  id: string
  name: string
  slug: string
  description?: string | null
  image?: string | null
  perfumeHouse?: {
    id: string
    name: string
    slug: string
    type?: string
  } | null
  /** Present when the active rules engine can explain the pick (CF-013). */
  reason?: RecommendationReason
}

/**
 * Recommendation service interface for similar and personalized perfumes.
 * Implementations: rules-based (note overlap), or future ML-based.
 */
export type GetSimilarPerfumesOptions = {
  /** When set, excludes perfumes in this user’s collection or destash. */
  userId?: string
}

export interface RecommendationService {
  getSimilarPerfumes(
    perfumeId: string,
    limit: number,
    options?: GetSimilarPerfumesOptions
  ): Promise<RecommendationPerfume[]>
  getPersonalizedForUser(userId: string, limit: number): Promise<RecommendationPerfume[]>
}
