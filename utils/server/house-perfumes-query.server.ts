import type { Prisma } from "@prisma/client"

import type { SortOption } from "@/utils/sortUtils"
import { buildPerfumeCursorOrderBy } from "@/utils/server/perfume-cursor-order.server"
import {
  normalizeHousePerfumeNameSearch,
  parseHousePerfumeSortByParam,
} from "@/utils/house-perfumes-url-params"

export { normalizeHousePerfumeNameSearch }

export const parseHousePerfumeSortBy = (
  value: string | null | undefined
): SortOption | undefined => parseHousePerfumeSortByParam(value)

export const buildPerfumesWhereForHouse = (
  houseId: string,
  nameSearch?: string
): Prisma.PerfumeWhereInput => ({
  perfumeHouseId: houseId,
  ...(nameSearch
    ? { name: { contains: nameSearch, mode: "insensitive" as const } }
    : {}),
})

export const buildHousePerfumesOrderBy = (
  sortBy?: SortOption | null
): Prisma.PerfumeOrderByWithRelationInput[] =>
  buildPerfumeCursorOrderBy(sortBy ?? undefined)
