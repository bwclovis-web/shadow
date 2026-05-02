/**
 * Items returned for rendering a pagination control: page numbers or a gap marker.
 * @see PaginationBar
 */
export type PaginationVisibleItem = number | "ellipsis"

/**
 * Builds a compact list of page numbers and ellipsis markers for UI pagination.
 * Always includes 1 and `totalPages` when there is more than one page; includes
 * `currentPage` ± `siblingCount` (clamped); merges gaps wider than one page as `"ellipsis"`.
 */
export const getPaginationVisiblePages = (
  currentPage: number,
  totalPages: number,
  siblingCount: number = 1
): PaginationVisibleItem[] => {
  if (totalPages < 1) {
    return []
  }

  if (totalPages === 1) {
    return [1]
  }

  const safeCurrent = Math.min(Math.max(1, currentPage), totalPages)
  const delta = Math.max(0, siblingCount)
  const pages = new Set<number>()

  const add = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      pages.add(p)
    }
  }

  add(1)
  add(totalPages)

  for (let i = safeCurrent - delta; i <= safeCurrent + delta; i += 1) {
    add(i)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const out: PaginationVisibleItem[] = []
  let prev = 0

  for (const p of sorted) {
    if (prev > 0 && p - prev > 1) {
      out.push("ellipsis")
    }
    out.push(p)
    prev = p
  }

  return out
}
