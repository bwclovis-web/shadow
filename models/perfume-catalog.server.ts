import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/db"
import {
  buildPerfumeCatalogNameOrderBy,
  buildPerfumeCursorOrderBy,
  clampPerfumeListTake,
  PERFUME_LIST_AGGREGATE_MAX_ROWS,
  PERFUME_LIST_MAX_TAKE,
  type PerfumeListSortBy,
} from "@/utils/server/perfume-cursor-order.server"
import {
  PERFUME_BY_SLUG_REVALIDATE,
  perfumeListSelect,
  type PerfumeListPage,
  type PerfumeListRow,
} from "./perfume-list-fields.server"

export type { PerfumeListRow, PerfumeListPage } from "./perfume-list-fields.server"

/**
 * Cursor-paginated perfumes, fixed sort: name asc, id asc (stable).
 */
export const getAllPerfumes = async (options?: {
  take?: number
  cursor?: string | null
}): Promise<PerfumeListPage> => {
  const take = clampPerfumeListTake(options?.take)
  const cursor = options?.cursor ?? ""
  return unstable_cache(
    async () => {
      const orderBy = buildPerfumeCatalogNameOrderBy()
      const rows = await prisma.perfume.findMany({
        select: perfumeListSelect,
        orderBy,
        take,
        ...(cursor
          ? { cursor: { id: cursor }, skip: 1 }
          : {}),
      })
      const nextCursor = rows.length === take ? rows[rows.length - 1]!.id : null
      return { items: rows, nextCursor }
    },
    ["get-all-perfumes", String(take), cursor],
    { revalidate: PERFUME_BY_SLUG_REVALIDATE, tags: ["perfume"] }
  )()
}

/**
 * Stitch catalog pages until exhausted or `PERFUME_LIST_AGGREGATE_MAX_ROWS` (for legacy full-list responses).
 */
export const fetchAllPerfumesForCatalog = async (): Promise<PerfumeListRow[]> => {
  const all: PerfumeListRow[] = []
  let cursor: string | null = null
  const pageSize = PERFUME_LIST_MAX_TAKE

  while (all.length < PERFUME_LIST_AGGREGATE_MAX_ROWS) {
    const { items, nextCursor } = await getAllPerfumes({ take: pageSize, cursor })
    all.push(...items)
    if (!nextCursor || items.length === 0) break
    cursor = nextCursor
  }
  return all
}

export const getAllPerfumesWithOptions = async (options?: {
  sortBy?: PerfumeListSortBy
  take?: number
  cursor?: string | null
}): Promise<PerfumeListPage> => {
  const sortBy = options?.sortBy
  const take = clampPerfumeListTake(options?.take)
  const cursor = options?.cursor ?? ""
  const sortKey = sortBy ?? "created-desc"

  return unstable_cache(
    async () => {
      const orderBy = buildPerfumeCursorOrderBy(sortBy)
      const rows = await prisma.perfume.findMany({
        select: perfumeListSelect,
        orderBy,
        take,
        ...(cursor
          ? { cursor: { id: cursor }, skip: 1 }
          : {}),
      })
      const nextCursor = rows.length === take ? rows[rows.length - 1]!.id : null
      return { items: rows, nextCursor }
    },
    ["get-all-perfumes-with-options", sortKey, String(take), cursor],
    { revalidate: PERFUME_BY_SLUG_REVALIDATE, tags: ["perfume"] }
  )()
}

export const getPerfumesByLetterPaginated = async (
  letter: string,
  options: { skip: number; take: number }
) => {
  const { skip, take } = options

  const [perfumes, totalCount] = await Promise.all([
    prisma.perfume.findMany({
      where: {
        name: {
          startsWith: letter,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        slug: true,
        perfumeHouseId: true,
        createdAt: true,
        updatedAt: true,
        perfumeHouse: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
          },
        },
      },
      orderBy: { name: "asc" },
      skip,
      take,
    }),
    prisma.perfume.count({
      where: {
        name: {
          startsWith: letter,
          mode: "insensitive",
        },
      },
    }),
  ])

  return {
    perfumes,
    count: totalCount,
  }
}
