/**
 * Recommendation types and service for personalized perfume recommendations.
 * getPersonalizedForUser can be extended when ScentProfile/recommendation logic is implemented.
 */

export type RecommendationPerfume = {
  id: string
  slug: string
  name: string
  image?: string | null
  perfumeHouse?: { name: string } | null
}

export const rulesRecommendationService = {
  getPersonalizedForUser: async (
    _userId: string,
    _limit: number
  ): Promise<RecommendationPerfume[]> => {
    // TODO: Implement when ScentProfile/recommendation rules are available
    return []
  },
}
