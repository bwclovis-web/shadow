import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getTradersWantingUserListings,
  getViewerOverlapWithTraderWishlist,
  getWishlistExchangeMatches,
} from "./wishlist-matching.server"

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfumeWishlist: {
      findMany: vi.fn(),
    },
    userPerfume: {
      findMany: vi.fn(),
    },
    perfume: {
      findMany: vi.fn(),
    },
    scentProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock("@/models/scent-profile.server", () => ({
  getOrCreateScentProfile: vi.fn().mockResolvedValue({
    preferredPriceRange: null,
    preferredConcentration: null,
    preferredHouseTier: null,
  }),
}))

import { prisma } from "@/lib/db"

const mockWishlistFindMany = vi.mocked(prisma.userPerfumeWishlist.findMany)
const mockUserPerfumeFindMany = vi.mocked(prisma.userPerfume.findMany)
const mockPerfumeFindMany = vi.mocked(prisma.perfume.findMany)

describe("getWishlistExchangeMatches", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns empty when wishlist is empty", async () => {
    mockWishlistFindMany.mockResolvedValue([])
    await expect(getWishlistExchangeMatches("viewer-1")).resolves.toEqual([])
    expect(mockPerfumeFindMany).not.toHaveBeenCalled()
  })

  it("queries perfumes on wishlist with other traders' listings", async () => {
    mockWishlistFindMany.mockResolvedValue([
      { perfumeId: "perfume-a" },
      { perfumeId: "perfume-b" },
    ] as never)
    mockPerfumeFindMany.mockResolvedValue([
      {
        id: "perfume-a",
        name: "Rose",
        slug: "rose",
        image: null,
        perfumeHouse: null,
        userPerfume: [{ id: "up-1", userId: "trader-2" }],
      },
    ] as never)

    const result = await getWishlistExchangeMatches("viewer-1")
    expect(result).toHaveLength(1)
    expect(mockPerfumeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["perfume-a", "perfume-b"] },
        }),
        take: 36,
      })
    )
  })
})

describe("getTradersWantingUserListings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns empty when user has no listings", async () => {
    mockUserPerfumeFindMany.mockResolvedValue([])
    await expect(getTradersWantingUserListings("user-1")).resolves.toEqual([])
    expect(mockWishlistFindMany).not.toHaveBeenCalled()
  })

  it("groups traders who wishlisted listed perfumes", async () => {
    mockUserPerfumeFindMany.mockResolvedValue([
      {
        perfumeId: "perfume-a",
        perfume: { id: "perfume-a", name: "Rose", slug: "rose", image: null },
      },
    ] as never)
    mockWishlistFindMany.mockResolvedValue([
      {
        userId: "trader-2",
        perfume: { id: "perfume-a", name: "Rose", slug: "rose", image: null },
        user: {
          id: "trader-2",
          firstName: "A",
          lastName: "B",
          username: "ab",
          email: "a@b.com",
          avatarImage: null,
        },
      },
    ] as never)

    const result = await getTradersWantingUserListings("user-1")
    expect(result).toHaveLength(1)
    expect(result[0]?.trader.id).toBe("trader-2")
    expect(result[0]?.perfumes).toHaveLength(1)
    expect(mockWishlistFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublic: true,
          userId: { not: "user-1" },
        }),
      })
    )
  })
})

describe("getViewerOverlapWithTraderWishlist", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null without a viewer", async () => {
    await expect(
      getViewerOverlapWithTraderWishlist(null, "trader-1")
    ).resolves.toBeNull()
    expect(mockWishlistFindMany).not.toHaveBeenCalled()
  })

  it("returns null when viewing own profile", async () => {
    await expect(
      getViewerOverlapWithTraderWishlist("user-1", "user-1")
    ).resolves.toBeNull()
  })

  it("returns matching perfumes when viewer lists overlap", async () => {
    mockWishlistFindMany.mockResolvedValue([
      { perfumeId: "perfume-a" },
    ] as never)
    mockUserPerfumeFindMany.mockResolvedValue([
      {
        perfume: { id: "perfume-a", name: "Rose", slug: "rose" },
      },
    ] as never)

    const result = await getViewerOverlapWithTraderWishlist("viewer-1", "trader-1")
    expect(result?.matchingPerfumes).toEqual([
      { id: "perfume-a", name: "Rose", slug: "rose" },
    ])
  })
})
