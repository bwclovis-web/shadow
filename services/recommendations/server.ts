/**
 * Server-only recommendation API for use in RSC (e.g. profile page).
 * Import from "@/services/recommendations" — this file is the implementation.
 */

import { DEFAULT_RECOMMENDATIONS_LIMIT } from "./types"
import { rulesRecommendationService } from "./rules.service"
import type { RecommendationPerfume } from "./types"

export { DEFAULT_RECOMMENDATIONS_LIMIT }

/**
 * Get personalized perfume recommendations for a user.
 * Uses scent profile note weights; falls back to popular perfumes when no profile data.
 */
export async function getPersonalizedRecommendations(
  userId: string,
  limit: number = DEFAULT_RECOMMENDATIONS_LIMIT
): Promise<RecommendationPerfume[]> {
  return rulesRecommendationService.getPersonalizedForUser(userId, limit)
}
