import { beforeEach, describe, expect, it, vi } from "vitest"

const { groupByMock, findManyMock } = vi.hoisted(() => ({
  groupByMock: vi.fn(),
  findManyMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfumeSeasonVote: { groupBy: groupByMock },
    perfume: { findMany: findManyMock },
  },
}))

import { getSeasonalTrendingPerfumes } from "./seasonal-trending.server"

describe("seasonal-trending.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns top perfumes for the requested season", async () => {
    groupByMock.mockResolvedValue([
      { perfumeId: "p1", _count: { perfumeId: 12 } },
      { perfumeId: "p2", _count: { perfumeId: 8 } },
    ])
    findManyMock.mockResolvedValue([
      {
        id: "p1",
        name: "Alpha",
        slug: "alpha",
        image: null,
        perfumeHouse: { id: "h1", name: "House", slug: "house" },
      },
      {
        id: "p2",
        name: "Beta",
        slug: "beta",
        image: "/img.png",
        perfumeHouse: null,
      },
    ])

    const result = await getSeasonalTrendingPerfumes(10, "summer")

    expect(result.season).toBe("summer")
    expect(result.perfumes).toHaveLength(2)
    expect(result.perfumes[0]).toMatchObject({
      perfumeId: "p1",
      voteCount: 12,
      name: "Alpha",
    })
    expect(groupByMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { summer: true },
        take: 10,
      })
    )
  })

  it("returns empty list when no votes exist", async () => {
    groupByMock.mockResolvedValue([])

    const result = await getSeasonalTrendingPerfumes(10, "winter")

    expect(result.perfumes).toEqual([])
    expect(findManyMock).not.toHaveBeenCalled()
  })
})
