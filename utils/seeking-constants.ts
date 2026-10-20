/** Wishlist entries per Seeking group / public page. */
export const SEEKING_GROUP_PAGE_SIZE = 6

/** Bound free-text search to keep predicates index-friendly. */
export const SEEKING_SEARCH_MAX_LENGTH = 100

export const SEEKING_VISIBILITY_FILTERS = ["all", "public", "private"] as const
export type SeekingVisibilityFilter = (typeof SEEKING_VISIBILITY_FILTERS)[number]

export const DEFAULT_SEEKING_VISIBILITY: SeekingVisibilityFilter = "all"

export const SEEKING_VIEWS = ["grid", "list"] as const
export type SeekingView = (typeof SEEKING_VIEWS)[number]
export const DEFAULT_SEEKING_VIEW: SeekingView = "grid"

export const clampSeekingPageSize = (requested?: number): number =>
  Math.min(Math.max(requested ?? SEEKING_GROUP_PAGE_SIZE, 1), SEEKING_GROUP_PAGE_SIZE)

export const clampSeekingPage = (
  requestedPage: number,
  totalCount: number,
  pageSize: number
): { currentPage: number; totalPages: number; skip: number } => {
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0
  const currentPage =
    totalPages === 0 ? 1 : Math.min(Math.max(requestedPage, 1), totalPages)
  const skip = totalPages === 0 ? 0 : (currentPage - 1) * pageSize
  return { currentPage, totalPages, skip }
}

export const normalizeSeekingSearch = (
  raw: string | null | undefined
): string => {
  if (!raw) return ""
  return raw.trim().slice(0, SEEKING_SEARCH_MAX_LENGTH)
}
