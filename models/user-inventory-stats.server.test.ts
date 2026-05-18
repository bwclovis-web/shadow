import { beforeEach, describe, expect, it, vi } from "vitest"

import { getUserInventoryStats } from "./user-inventory-stats.server"

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfume: { findMany: vi.fn() },
    perfumeNoteRelation: { findMany: vi.fn() },
    tradeLineItem: { findMany: vi.fn() },
  },
}))

import { prisma } from "@/lib/db"

const mockUserPerfumeFindMany = vi.mocked(prisma.userPerfume.findMany)
const mockNoteRelationFindMany = vi.mocked(prisma.perfumeNoteRelation.findMany)
const mockTradeLineItemFindMany = vi.mocked(prisma.tradeLineItem.findMany)

describe("getUserInventoryStats", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNoteRelationFindMany.mockResolvedValue([])
    mockTradeLineItemFindMany.mockResolvedValue([])
  })

  it("returns zero stats for empty collection", async () => {
    mockUserPerfumeFindMany.mockResolvedValue([])
    await expect(getUserInventoryStats("user-1")).resolves.toEqual({
      bottleCount: 0,
      houseCount: 0,
      topFamilies: [],
      tradedValue: 0,
    })
  })

  it("counts distinct perfumes and houses from collection bottles", async () => {
    mockUserPerfumeFindMany.mockResolvedValue([
      {
        id: "up1",
        perfumeId: "p1",
        amount: "100",
        available: "0",
        tradePrice: null,
        price: null,
        perfume: { perfumeHouse: { id: "h1" } },
      },
      {
        id: "up2",
        perfumeId: "p2",
        amount: "50",
        available: "0",
        tradePrice: null,
        price: null,
        perfume: { perfumeHouse: { id: "h1" } },
      },
    ] as never)

    const stats = await getUserInventoryStats("user-1")
    expect(stats.bottleCount).toBe(2)
    expect(stats.houseCount).toBe(1)
  })

  it("sums traded value once per userPerfume in completed trades", async () => {
    mockUserPerfumeFindMany.mockResolvedValue([])
    mockTradeLineItemFindMany.mockResolvedValue([
      {
        userPerfumeId: "up1",
        userPerfume: { tradePrice: "25", price: "10" },
      },
      {
        userPerfumeId: "up1",
        userPerfume: { tradePrice: "25", price: "10" },
      },
      {
        userPerfumeId: "up2",
        userPerfume: { tradePrice: null, price: "15" },
      },
    ] as never)

    const stats = await getUserInventoryStats("user-1")
    expect(stats.tradedValue).toBe(40)
  })

  it("excludes destash-only rows from bottle count", async () => {
    mockUserPerfumeFindMany.mockResolvedValue([
      {
        id: "up1",
        perfumeId: "p1",
        amount: "0",
        available: "10",
        tradePrice: null,
        price: null,
        perfume: { perfumeHouse: { id: "h1" } },
      },
    ] as never)

    const stats = await getUserInventoryStats("user-1")
    expect(stats.bottleCount).toBe(0)
    expect(stats.houseCount).toBe(0)
  })
})
