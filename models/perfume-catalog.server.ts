import type { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"

import { prisma } from "@/lib/db"
import type { CatalogPage, CatalogPerfumeItem } from "@/types/catalog"
import type { ArchiveFilters, ArchiveSort } from "@/utils/catalog-params"
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

const archiveCatalogSelect = {
  id: true,
  name: true,
  slug: true,
  image: true,
  isPending: true,
  perfumeHouse: { select: { name: true } },
} satisfies Prisma.PerfumeSelect

/** Note and season matching follow the Exchange discovery rules (`perfume-exchange.server.ts`). */
const buildArchiveCatalogWhere = (
  letter: string | null,
  { houseIds, noteIds, seasons }: ArchiveFilters
): Prisma.PerfumeWhereInput => {
  const and: Prisma.PerfumeWhereInput[] = []
  if (letter) {
    and.push({ name: { startsWith: letter, mode: "insensitive" } })
  }
  if (houseIds.length > 0) {
    and.push({ perfumeHouseId: { in: houseIds } })
  }
  if (noteIds.length > 0) {
    and.push({ perfumeNoteRelations: { some: { noteId: { in: noteIds } } } })
  }
  if (seasons.length > 0) {
    and.push({
      OR: seasons.map(season => ({
        userPerfumeSeasonVote: { some: { [season]: true } },
      })),
    })
  }
  return and.length > 0 ? { AND: and } : {}
}

export const getArchiveCatalogPage = async (options: {
  letter: string | null
  filters: ArchiveFilters
  sort: ArchiveSort
  page: number
  pageSize: number
}): Promise<CatalogPage<CatalogPerfumeItem>> => {
  const { letter, filters, sort, page, pageSize } = options
  const where = buildArchiveCatalogWhere(letter, filters)
  const orderBy = buildPerfumeCursorOrderBy(sort)

  const fetchPage = (targetPage: number) =>
    prisma.perfume.findMany({
      where,
      select: archiveCatalogSelect,
      orderBy,
      skip: (targetPage - 1) * pageSize,
      take: pageSize,
    })

  const [rows, totalCount] = await Promise.all([
    fetchPage(page),
    prisma.perfume.count({ where }),
  ])
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const resolvedPage = Math.min(page, totalPages)
  const resolvedRows =
    resolvedPage === page ? rows : await fetchPage(resolvedPage)

  return {
    items: resolvedRows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      image: row.image,
      isPending: row.isPending,
      houseName: row.perfumeHouse?.name ?? null,
    })),
    totalCount,
    page: resolvedPage,
    totalPages,
  }
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
