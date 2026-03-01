/**
 * Strict pagination bounds for list/read API routes to prevent unbounded queries.
 */

export const PAGINATION = {
  MIN_TAKE: 1,
  MAX_TAKE: 100,
  DEFAULT_TAKE: 16,
  MAX_SKIP: 100_000,
} as const

export const clampPagination = (
  skip: number,
  take: number
): { skip: number; take: number } => {
  const safeSkip = Math.max(0, Math.min(skip, PAGINATION.MAX_SKIP))
  const safeTake = Math.max(
    PAGINATION.MIN_TAKE,
    Math.min(take || PAGINATION.DEFAULT_TAKE, PAGINATION.MAX_TAKE)
  )
  return { skip: safeSkip, take: safeTake }
}
