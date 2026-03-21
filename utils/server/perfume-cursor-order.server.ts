import type { Prisma } from "@prisma/client"

/** Default page size for perfume list cursor pagination */
export const PERFUME_LIST_DEFAULT_TAKE = 50

/** Hard cap per request (query param clamped to this) */
export const PERFUME_LIST_MAX_TAKE = 200

/** When stitching full catalogs server-side, stop after this many rows */
export const PERFUME_LIST_AGGREGATE_MAX_ROWS = 5000

export type PerfumeListSortBy =
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc"
  | "type-asc"

export const PERFUME_LIST_SORT_OPTIONS = [
  "name-asc",
  "name-desc",
  "created-desc",
  "created-asc",
  "type-asc",
] as const satisfies readonly PerfumeListSortBy[]

export function isPerfumeListSortBy(value: string | null | undefined): value is PerfumeListSortBy {
  return (
    value !== undefined &&
    value !== null &&
    (PERFUME_LIST_SORT_OPTIONS as readonly string[]).includes(value)
  )
}

export function clampPerfumeListTake(take?: number): number {
  if (take === undefined) return PERFUME_LIST_DEFAULT_TAKE
  if (!Number.isFinite(take) || take < 1) return PERFUME_LIST_DEFAULT_TAKE
  return Math.min(Math.floor(take), PERFUME_LIST_MAX_TAKE)
}

/**
 * Total order for cursor pagination (Prisma `cursor: { id }` + `skip: 1`).
 * `type-asc` uses related house type — `Perfume` has no `type` field.
 */
export function buildPerfumeCursorOrderBy(
  sortBy?: string | null
): Prisma.PerfumeOrderByWithRelationInput[] {
  const idTie: Prisma.PerfumeOrderByWithRelationInput = { id: "asc" }
  switch (sortBy) {
    case "name-asc":
      return [{ name: "asc" }, idTie]
    case "name-desc":
      return [{ name: "desc" }, idTie]
    case "created-asc":
      return [{ createdAt: "asc" }, idTie]
    case "created-desc":
      return [{ createdAt: "desc" }, idTie]
    case "type-asc":
      return [{ perfumeHouse: { type: "asc" } }, idTie]
    default:
      return [{ createdAt: "desc" }, idTie]
  }
}

/** Fixed order for catalog-style lists (e.g. user-perfumes `allPerfumes` aggregate). */
export function buildPerfumeCatalogNameOrderBy(): Prisma.PerfumeOrderByWithRelationInput[] {
  return [{ name: "asc" }, { id: "asc" }]
}
