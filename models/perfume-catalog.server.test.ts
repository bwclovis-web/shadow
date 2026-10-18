import { beforeEach, describe, expect, it, vi } from "vitest"

const { findManyMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    perfume: {
      findMany: findManyMock,
      count: countMock,
    },
  },
}))

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}))

import { emptyArchiveFilters } from "@/utils/catalog-params"

import { getArchiveCatalogPage } from "./perfume-catalog.server"

const row = {
  id: "p-1",
  name: "Baccarat Rouge 540",
  slug: "baccarat-rouge-540",
  image: "https://example.com/br540.jpg",
  isPending: false,
  perfumeHouse: { name: "Maison Francis Kurkdjian" },
}

describe("getArchiveCatalogPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("queries without a where clause when nothing is selected", async () => {
    findManyMock.mockResolvedValue([row])
    countMock.mockResolvedValue(1)

    const result = await getArchiveCatalogPage({
      letter: null,
      filters: emptyArchiveFilters(),
      sort: "created-desc",
      page: 1,
      pageSize: 24,
    })

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 24 })
    )
    expect(countMock).toHaveBeenCalledWith({ where: {} })
    expect(result).toEqual({
      items: [
        {
          id: "p-1",
          name: "Baccarat Rouge 540",
          slug: "baccarat-rouge-540",
          image: "https://example.com/br540.jpg",
          isPending: false,
          houseName: "Maison Francis Kurkdjian",
        },
      ],
      totalCount: 1,
      page: 1,
      totalPages: 1,
    })
  })

  it("combines letter, house, any-note, and any-season filters", async () => {
    findManyMock.mockResolvedValue([])
    countMock.mockResolvedValue(0)

    await getArchiveCatalogPage({
      letter: "B",
      filters: {
        houseIds: ["h-1", "h-2"],
        noteIds: ["n-1"],
        seasons: ["winter", "fall"],
      },
      sort: "name-asc",
      page: 1,
      pageSize: 24,
    })

    expect(countMock).toHaveBeenCalledWith({
      where: {
        AND: [
          { name: { startsWith: "B", mode: "insensitive" } },
          { perfumeHouseId: { in: ["h-1", "h-2"] } },
          { perfumeNoteRelations: { some: { noteId: { in: ["n-1"] } } } },
          {
            OR: [
              { userPerfumeSeasonVote: { some: { winter: true } } },
              { userPerfumeSeasonVote: { some: { fall: true } } },
            ],
          },
        ],
      },
    })
  })

  it("clamps a page past the end to the last page", async () => {
    findManyMock.mockResolvedValueOnce([]).mockResolvedValueOnce([row])
    countMock.mockResolvedValue(30)

    const result = await getArchiveCatalogPage({
      letter: null,
      filters: emptyArchiveFilters(),
      sort: "created-desc",
      page: 9,
      pageSize: 24,
    })

    expect(findManyMock).toHaveBeenCalledTimes(2)
    expect(findManyMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 24, take: 24 })
    )
    expect(result.page).toBe(2)
    expect(result.totalPages).toBe(2)
    expect(result.items).toHaveLength(1)
  })
})
