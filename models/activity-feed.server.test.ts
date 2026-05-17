import { beforeEach, describe, expect, it, vi } from "vitest"

const { findManyMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfume: {
      findMany: findManyMock,
      count: countMock,
    },
  },
}))

import {
  getNewListingsSinceCount,
  getNewListingsThisWeekCount,
  getRecentlyListedActivity,
} from "./activity-feed.server"

describe("activity-feed.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads recent available listings newest first", async () => {
    const rows = [{ id: "up-1" }]
    findManyMock.mockResolvedValue(rows)

    const result = await getRecentlyListedActivity(8)

    expect(result).toEqual(rows)
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          available: { not: "0" },
          user: { isBanned: false },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    )
  })

  it("counts listings created since a given date", async () => {
    countMock.mockResolvedValue(3)
    const since = new Date("2025-01-01T00:00:00.000Z")

    const result = await getNewListingsSinceCount(since)

    expect(result).toBe(3)
    expect(countMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: since },
        }),
      })
    )
  })

  it("counts listings created in the last seven days", async () => {
    countMock.mockResolvedValue(5)
    const before = Date.now()

    const result = await getNewListingsThisWeekCount()

    expect(result).toBe(5)
    const call = countMock.mock.calls[0]?.[0]
    const createdAtGte = call.where.createdAt.gte as Date
    const weekMs = 7 * 24 * 60 * 60 * 1000
    expect(createdAtGte.getTime()).toBeGreaterThanOrEqual(before - weekMs - 1000)
    expect(createdAtGte.getTime()).toBeLessThanOrEqual(before - weekMs + 1000)
  })
})
