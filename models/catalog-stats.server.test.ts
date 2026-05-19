import { beforeEach, describe, expect, it, vi } from "vitest"

const { countMocks } = vi.hoisted(() => ({
  countMocks: {
    user: vi.fn(),
    perfumeHouse: vi.fn(),
    perfume: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { count: countMocks.user },
    perfumeHouse: { count: countMocks.perfumeHouse },
    perfume: { count: countMocks.perfume },
  },
}))

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}))

import { getCatalogStats } from "./catalog-stats.server"

describe("catalog-stats.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    countMocks.user.mockResolvedValue(100)
    countMocks.perfumeHouse.mockResolvedValue(250)
    countMocks.perfume.mockResolvedValue(5000)
  })

  it("returns user, house, and perfume totals", async () => {
    const result = await getCatalogStats()

    expect(result).toEqual({
      users: 100,
      houses: 250,
      perfumes: 5000,
    })
  })

  it("counts all users, houses, and perfumes", async () => {
    await getCatalogStats()

    expect(countMocks.user).toHaveBeenCalledWith()
    expect(countMocks.perfumeHouse).toHaveBeenCalledWith()
    expect(countMocks.perfume).toHaveBeenCalledWith()
  })
})
