import { beforeEach, describe, expect, it, vi } from "vitest"

const { countMocks } = vi.hoisted(() => ({
  countMocks: {
    userPerfume: vi.fn(),
    trade: vi.fn(),
    user: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfume: { count: countMocks.userPerfume },
    trade: { count: countMocks.trade },
    user: { count: countMocks.user },
  },
}))

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}))

import { getCommunityStats } from "./community-stats.server"

describe("community-stats.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    countMocks.userPerfume.mockResolvedValue(42)
    countMocks.trade.mockResolvedValue(7)
    countMocks.user.mockResolvedValue(120)
  })

  it("returns aggregate bottles listed, monthly completed trades, and members", async () => {
    const result = await getCommunityStats()

    expect(result).toEqual({
      bottlesListed: 42,
      tradesCompletedThisMonth: 7,
      members: 120,
    })
  })

  it("counts active listings from non-banned users", async () => {
    await getCommunityStats()

    expect(countMocks.userPerfume).toHaveBeenCalledWith({
      where: {
        available: { not: "0" },
        user: { isBanned: false },
      },
    })
  })

  it("counts completed trades since the start of the current UTC month", async () => {
    await getCommunityStats()

    const call = countMocks.trade.mock.calls[0]?.[0]
    const monthStart = call.where.updatedAt.gte as Date
    const now = new Date()
    const expectedStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

    expect(call.where.status).toBe("completed")
    expect(monthStart.getTime()).toBe(expectedStart.getTime())
  })

  it("counts members excluding banned users", async () => {
    await getCommunityStats()

    expect(countMocks.user).toHaveBeenCalledWith({
      where: { isBanned: false },
    })
  })
})
