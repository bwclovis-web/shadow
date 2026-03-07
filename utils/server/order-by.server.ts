/**
 * Shared factory for building Prisma orderBy from sort option strings.
 * Used by perfume and house models to avoid duplicating the same switch logic.
 */
export type NameOrderBySortOption =
  | "name-asc"
  | "name-desc"
  | "created-asc"
  | "created-desc"
  | "type-asc"

export function buildNameOrderBy(
  sortBy?: string,
  sortByType?: boolean
): Record<string, "asc" | "desc"> {
  if (sortBy) {
    switch (sortBy) {
      case "name-asc":
        return { name: "asc" }
      case "name-desc":
        return { name: "desc" }
      case "created-asc":
        return { createdAt: "asc" }
      case "created-desc":
        return { createdAt: "desc" }
      case "type-asc":
        return { type: "asc" }
      default:
        return { createdAt: "desc" }
    }
  }
  return sortByType ? { type: "asc" } : { createdAt: "desc" }
}
