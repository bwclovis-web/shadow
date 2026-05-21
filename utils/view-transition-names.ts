/**
 * Shared `view-transition-name` for cross-page bottle morphs (LinkCard, compare, detail hero).
 * At most one element per document may use a given name — do not reuse on activity feed rows
 * when the same perfume can also appear in a LinkCard grid on that page.
 */
export const perfumeImageTransitionName = (perfumeId: string) =>
  `perfume-image-${perfumeId}`

/** My Scents collection grid → bottle detail (uses userPerfume id, not catalog perfume id). */
export const userBottleImageTransitionName = (userPerfumeId: string) =>
  `my-scent-bottle-${userPerfumeId}`

export const tradeCardTransitionName = (tradeId: string) => `trade-card-${tradeId}`
