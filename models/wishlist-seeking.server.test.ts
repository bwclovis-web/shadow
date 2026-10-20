import { beforeEach, describe, expect, it, vi } from "vitest"

const resolveExchangeEligibilityMock = vi.fn()

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfumeWishlist: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    userPerfume: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

vi.mock("@/models/perfume-exchange-groups.server", () => ({
  resolveExchangeEligibility: (...args: unknown[]) =>
    resolveExchangeEligibilityMock(...args),
}))

import { prisma } from "@/lib/db"
import {
  buildOwnerSeekingWishlistWhere,
  buildSeekingPerfumeSearchWhere,
  getOwnedSeekingPage,
  getPublicSeekingPage,
  getSeekingAvailableGroupPage,
  getSeekingStillSeekingGroupPage,
  loadSeekingOfferCollectorCounts,
  resolveSeekingEligibleListingWhere,
  SeekingAvailabilityError,
} from "@/models/wishlist-seeking.server"
import { SEEKING_GROUP_PAGE_SIZE } from "@/utils/seeking-constants"

const wishlistCount = vi.mocked(prisma.userPerfumeWishlist.count)
const wishlistFindMany = vi.mocked(prisma.userPerfumeWishlist.findMany)
const offerGroupBy = vi.mocked(prisma.userPerfume.groupBy)
const offerFindMany = vi.mocked(prisma.userPerfume.findMany)

const ownerId = "owner-1"
const baseListingWhere = {
  available: { not: "0" },
  userId: { not: ownerId },
}

describe("buildSeekingPerfumeSearchWhere", () => {
  it("matches perfume and house names", () => {
    expect(buildSeekingPerfumeSearchWhere("  oud ")).toEqual({
      OR: [
        { name: { contains: "oud", mode: "insensitive" } },
        { perfumeHouse: { name: { contains: "oud", mode: "insensitive" } } },
      ],
    })
  })

  it("returns undefined for empty search", () => {
    expect(buildSeekingPerfumeSearchWhere("   ")).toBeUndefined()
  })
})

describe("buildOwnerSeekingWishlistWhere", () => {
  it("scopes to owner and visibility without loading ids", () => {
    expect(
      buildOwnerSeekingWishlistWhere({
        ownerUserId: ownerId,
        visibility: "public",
      })
    ).toEqual({ userId: ownerId, isPublic: true })

    expect(
      buildOwnerSeekingWishlistWhere({
        ownerUserId: ownerId,
        visibility: "private",
      })
    ).toEqual({ userId: ownerId, isPublic: false })
  })

  it("ANDs search with eligibility perfumeExtra", () => {
    const where = buildOwnerSeekingWishlistWhere({
      ownerUserId: ownerId,
      visibility: "all",
      search: "rose",
      perfumeExtra: { userPerfume: { some: baseListingWhere } },
    })
    expect(where).toMatchObject({
      userId: ownerId,
      perfume: {
        AND: [
          {
            OR: [
              { name: { contains: "rose", mode: "insensitive" } },
              {
                perfumeHouse: {
                  name: { contains: "rose", mode: "insensitive" },
                },
              },
            ],
          },
          { userPerfume: { some: baseListingWhere } },
        ],
      },
    })
  })

  it("does not include bottlePreference in predicates", () => {
    const where = buildOwnerSeekingWishlistWhere({
      ownerUserId: ownerId,
      search: "x",
      perfumeExtra: { userPerfume: { none: baseListingWhere } },
    })
    expect(JSON.stringify(where)).not.toContain("bottlePreference")
  })
})

describe("resolveSeekingEligibleListingWhere", () => {
  beforeEach(() => {
    resolveExchangeEligibilityMock.mockReset()
  })

  it("reuses Exchange eligibility with viewer exclusion and bans", async () => {
    resolveExchangeEligibilityMock.mockResolvedValue({
      listingWhere: baseListingWhere,
      perfumeWhere: {},
    })

    const where = await resolveSeekingEligibleListingWhere(ownerId)

    expect(resolveExchangeEligibilityMock).toHaveBeenCalledWith({
      viewerId: ownerId,
    })
    expect(where).toEqual({
      AND: [baseListingWhere, { user: { isBanned: false } }],
    })
  })

  it("wraps Exchange failures as SeekingAvailabilityError", async () => {
    resolveExchangeEligibilityMock.mockRejectedValue(new Error("db down"))
    await expect(resolveSeekingEligibleListingWhere(ownerId)).rejects.toBeInstanceOf(
      SeekingAvailabilityError
    )
  })
})

describe("loadSeekingOfferCollectorCounts", () => {
  beforeEach(() => {
    offerGroupBy.mockReset()
    offerFindMany.mockReset()
  })

  it("counts offer rows and deduplicates collectors", async () => {
    offerGroupBy.mockResolvedValue([
      { perfumeId: "p1", _count: { _all: 3 }, _avg: {}, _sum: {}, _min: {}, _max: {} },
    ] as never)
    offerFindMany.mockResolvedValue([
      { perfumeId: "p1", userId: "c1" },
      { perfumeId: "p1", userId: "c2" },
    ] as never)

    const map = await loadSeekingOfferCollectorCounts(["p1", "p2"], baseListingWhere)

    expect(offerGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["perfumeId"],
        where: {
          perfumeId: { in: ["p1", "p2"] },
          AND: [baseListingWhere],
        },
        _count: { _all: true },
      })
    )
    expect(offerFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ["perfumeId", "userId"],
      })
    )
    expect(map.get("p1")).toEqual({ offerCount: 3, collectorCount: 2 })
    expect(map.get("p2")).toEqual({ offerCount: 0, collectorCount: 0 })
  })
})

describe("getSeekingAvailableGroupPage / getSeekingStillSeekingGroupPage", () => {
  beforeEach(() => {
    resolveExchangeEligibilityMock.mockReset()
    wishlistCount.mockReset()
    wishlistFindMany.mockReset()
    offerGroupBy.mockReset()
    offerFindMany.mockReset()

    resolveExchangeEligibilityMock.mockResolvedValue({
      listingWhere: baseListingWhere,
      perfumeWhere: {},
    })
  })

  it("classifies Available with relational some before pagination", async () => {
    wishlistCount.mockResolvedValue(13)
    wishlistFindMany.mockResolvedValue([
      {
        id: "w1",
        perfumeId: "p1",
        isPublic: true,
        bottlePreference: "any",
        createdAt: new Date("2024-01-02"),
        perfume: {
          id: "p1",
          name: "Noir",
          slug: "noir",
          image: null,
          perfumeHouse: { id: "h1", name: "House", slug: "house" },
        },
      },
    ] as never)
    offerGroupBy.mockResolvedValue([
      { perfumeId: "p1", _count: { _all: 2 }, _avg: {}, _sum: {}, _min: {}, _max: {} },
    ] as never)
    offerFindMany.mockResolvedValue([{ perfumeId: "p1", userId: "c1" }] as never)

    const page = await getSeekingAvailableGroupPage({
      ownerUserId: ownerId,
      visibility: "all",
      page: 2,
    })

    expect(wishlistCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: ownerId,
        perfume: {
          userPerfume: {
            some: {
              AND: [baseListingWhere, { user: { isBanned: false } }],
            },
          },
        },
      }),
    })
    expect(wishlistFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: SEEKING_GROUP_PAGE_SIZE,
        take: SEEKING_GROUP_PAGE_SIZE,
      })
    )
    expect(page.meta).toMatchObject({
      totalCount: 13,
      pageSize: SEEKING_GROUP_PAGE_SIZE,
      currentPage: 2,
      totalPages: 3,
      showingFrom: 7,
      showingTo: 7,
    })
    expect(page.items[0]).toMatchObject({
      offerCount: 2,
      collectorCount: 1,
    })
    expect(page.items[0]).not.toHaveProperty("perfume.userPerfume")
  })

  it("classifies Still seeking with relational none (not failed lookup)", async () => {
    wishlistCount.mockResolvedValue(1)
    wishlistFindMany.mockResolvedValue([
      {
        id: "w2",
        perfumeId: "p2",
        isPublic: false,
        bottlePreference: "full",
        createdAt: new Date("2024-01-01"),
        perfume: {
          id: "p2",
          name: "Missing",
          slug: "missing",
          image: null,
          perfumeHouse: null,
        },
      },
    ] as never)

    const page = await getSeekingStillSeekingGroupPage({
      ownerUserId: ownerId,
      visibility: "private",
      search: "miss",
    })

    expect(wishlistCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: ownerId,
        isPublic: false,
        perfume: {
          AND: [
            expect.objectContaining({
              OR: expect.any(Array),
            }),
            {
              userPerfume: {
                none: {
                  AND: [baseListingWhere, { user: { isBanned: false } }],
                },
              },
            },
          ],
        },
      }),
    })
    expect(offerGroupBy).not.toHaveBeenCalled()
    expect(page.items[0]?.offerCount).toBe(0)
    expect(page.items[0]?.collectorCount).toBe(0)
  })

  it("clamps page past the end to the last page", async () => {
    wishlistCount.mockResolvedValue(12)
    wishlistFindMany.mockResolvedValue([] as never)

    await getSeekingAvailableGroupPage({
      ownerUserId: ownerId,
      page: 99,
    })

    expect(wishlistFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: SEEKING_GROUP_PAGE_SIZE,
        take: SEEKING_GROUP_PAGE_SIZE,
      })
    )
  })

  it("bounded take under 1,000+ count (mocked; not DB perf)", async () => {
    wishlistCount.mockResolvedValue(1_250)
    wishlistFindMany.mockResolvedValue(
      Array.from({ length: SEEKING_GROUP_PAGE_SIZE }, (_, i) => ({
        id: `w-${i}`,
        perfumeId: `p-${i}`,
        isPublic: true,
        bottlePreference: "any",
        createdAt: new Date("2024-01-01"),
        perfume: {
          id: `p-${i}`,
          name: `Name ${i}`,
          slug: `slug-${i}`,
          image: null,
          perfumeHouse: null,
        },
      })) as never
    )
    offerGroupBy.mockResolvedValue([] as never)
    offerFindMany.mockResolvedValue([] as never)

    const page = await getSeekingAvailableGroupPage({
      ownerUserId: ownerId,
      visibility: "public",
      search: "Rose",
      page: 10,
    })

    expect(page.items).toHaveLength(SEEKING_GROUP_PAGE_SIZE)
    expect(page.meta.totalCount).toBe(1_250)
    expect(page.meta.pageSize).toBeLessThanOrEqual(12)
    expect(wishlistFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: SEEKING_GROUP_PAGE_SIZE,
        skip: 9 * SEEKING_GROUP_PAGE_SIZE,
        where: expect.objectContaining({
          userId: ownerId,
          isPublic: true,
          perfume: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                userPerfume: expect.objectContaining({
                  some: expect.anything(),
                }),
              }),
            ]),
          }),
        }),
      })
    )
    // Offer counts only for the page rows — not the full 1,250 set.
    expect(offerGroupBy.mock.calls[0]?.[0]?.where?.perfumeId).toEqual({
      in: expect.arrayContaining([`p-0`]),
    })
    const idsIn = offerGroupBy.mock.calls[0]?.[0]?.where?.perfumeId?.in as string[]
    expect(idsIn).toHaveLength(SEEKING_GROUP_PAGE_SIZE)
  })
})

describe("getOwnedSeekingPage", () => {
  beforeEach(() => {
    resolveExchangeEligibilityMock.mockReset()
    wishlistCount.mockReset()
    wishlistFindMany.mockReset()
    offerGroupBy.mockReset()
    offerFindMany.mockReset()
  })

  it("returns hero + visibility counts with identical search predicates", async () => {
    resolveExchangeEligibilityMock.mockResolvedValue({
      listingWhere: baseListingWhere,
      perfumeWhere: {},
    })

    const whereJson = (where: unknown) => JSON.stringify(where ?? {})

    wishlistCount.mockImplementation(async ({ where }) => {
      const raw = whereJson(where)
      if (raw.includes('"some"')) return 3
      if (raw.includes('"none"')) return 7
      const w = where as { isPublic?: boolean; perfume?: unknown }
      if (w.isPublic === true) return 4
      if (w.isPublic === false) return 6
      if (w.perfume) return 10
      return 40
    })
    wishlistFindMany.mockResolvedValue([] as never)

    const result = await getOwnedSeekingPage({
      ownerUserId: ownerId,
      search: "rose",
      visibility: "all",
    })

    expect(result.heroTotalCount).toBe(40)
    expect(result.visibilityCounts).toEqual({ all: 10, public: 4, private: 6 })
    expect(result.availabilityStatus).toBe("ok")
    expect(result.available.meta.totalCount).toBe(3)
    expect(result.stillSeeking.meta.totalCount).toBe(7)

    expect(wishlistCount).toHaveBeenCalledWith({
      where: { userId: ownerId },
    })
    expect(wishlistCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: ownerId,
          isPublic: true,
          perfume: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      })
    )
    expect(wishlistCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: ownerId,
          isPublic: false,
          perfume: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      })
    )
  })

  it("does not classify items as Still seeking when eligibility fails", async () => {
    resolveExchangeEligibilityMock.mockRejectedValue(new Error("boom"))
    wishlistCount.mockImplementation(async ({ where }) => {
      const w = where as { isPublic?: boolean; perfume?: unknown }
      if (w.isPublic === true) return 2
      if (w.isPublic === false) return 3
      if (w.perfume) return 5
      return 5
    })

    const result = await getOwnedSeekingPage({
      ownerUserId: ownerId,
    })

    expect(result.availabilityStatus).toBe("failed")
    expect(result.available.items).toEqual([])
    expect(result.stillSeeking.items).toEqual([])
    expect(result.available.meta.totalCount).toBe(0)
    expect(result.stillSeeking.meta.totalCount).toBe(0)
    expect(result.heroTotalCount).toBe(5)
    expect(wishlistFindMany).not.toHaveBeenCalled()
  })

  it("paginates Available and Still seeking independently", async () => {
    resolveExchangeEligibilityMock.mockResolvedValue({
      listingWhere: baseListingWhere,
      perfumeWhere: {},
    })
    wishlistCount.mockImplementation(async ({ where }) => {
      const raw = JSON.stringify(where ?? {})
      if (raw.includes('"some"')) return 15
      if (raw.includes('"none"')) return 25
      return 20
    })
    wishlistFindMany.mockResolvedValue([] as never)

    const result = await getOwnedSeekingPage({
      ownerUserId: ownerId,
      availablePage: 2,
      stillSeekingPage: 3,
    })

    expect(result.available.meta).toMatchObject({
      totalCount: 15,
      currentPage: 2,
      totalPages: 3,
      showingFrom: 0,
      showingTo: 0,
    })
    expect(result.stillSeeking.meta).toMatchObject({
      totalCount: 25,
      currentPage: 3,
      totalPages: 5,
    })

    const findCalls = wishlistFindMany.mock.calls
    const skips = findCalls.map(call => call[0]?.skip).sort((a, b) => (a ?? 0) - (b ?? 0))
    expect(skips).toEqual([SEEKING_GROUP_PAGE_SIZE, SEEKING_GROUP_PAGE_SIZE * 2])
    expect(
      findCalls.every(call => call[0]?.take === SEEKING_GROUP_PAGE_SIZE)
    ).toBe(true)
  })
})

describe("getPublicSeekingPage", () => {
  beforeEach(() => {
    wishlistCount.mockReset()
    wishlistFindMany.mockReset()
  })

  it("filters isPublic=true before count and pagination", async () => {
    wishlistCount.mockResolvedValue(13)
    wishlistFindMany.mockResolvedValue([
      {
        id: "w1",
        perfumeId: "p1",
        bottlePreference: "any",
        createdAt: new Date("2024-01-01"),
        perfume: {
          id: "p1",
          name: "Rose",
          slug: "rose",
          image: null,
          perfumeHouse: { id: "h1", name: "House", slug: "house" },
        },
      },
    ] as never)

    const result = await getPublicSeekingPage({
      ownerUserId: ownerId,
      page: 1,
    })

    expect(wishlistCount).toHaveBeenCalledWith({
      where: { userId: ownerId, isPublic: true },
    })
    expect(wishlistFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: ownerId, isPublic: true },
        skip: 0,
        take: SEEKING_GROUP_PAGE_SIZE,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      })
    )
    expect(result.meta).toMatchObject({
      totalCount: 13,
      pageSize: SEEKING_GROUP_PAGE_SIZE,
      currentPage: 1,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: false,
      showingFrom: 1,
      showingTo: 1,
    })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).not.toHaveProperty("isPublic")
    expect(result.items[0]).not.toHaveProperty("userId")
    expect(result.items[0]).not.toHaveProperty("offerCount")
  })

  it("clamps out-of-range pages and skips private rows via where", async () => {
    wishlistCount.mockResolvedValue(12)
    wishlistFindMany.mockResolvedValue([] as never)

    const result = await getPublicSeekingPage({
      ownerUserId: ownerId,
      page: 99,
    })

    expect(result.meta.currentPage).toBe(2)
    expect(result.meta.totalPages).toBe(2)
    expect(wishlistFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: ownerId, isPublic: true },
        skip: SEEKING_GROUP_PAGE_SIZE,
        take: SEEKING_GROUP_PAGE_SIZE,
      })
    )
  })

  it("returns empty meta when there are zero public entries", async () => {
    wishlistCount.mockResolvedValue(0)

    const result = await getPublicSeekingPage({
      ownerUserId: ownerId,
      page: 3,
    })

    expect(result.items).toEqual([])
    expect(result.meta).toMatchObject({
      totalCount: 0,
      currentPage: 1,
      totalPages: 0,
      showingFrom: 0,
      showingTo: 0,
      hasNextPage: false,
      hasPrevPage: false,
    })
    expect(wishlistFindMany).not.toHaveBeenCalled()
  })

  it("never selects private-only columns for the public DTO", async () => {
    wishlistCount.mockResolvedValue(1)
    wishlistFindMany.mockResolvedValue([
      {
        id: "w1",
        perfumeId: "p1",
        bottlePreference: "full",
        createdAt: new Date("2024-06-01"),
        perfume: {
          id: "p1",
          name: "Oud",
          slug: "oud",
          image: "/o.webp",
          perfumeHouse: null,
        },
      },
    ] as never)

    await getPublicSeekingPage({ ownerUserId: ownerId, page: 1 })

    const select = wishlistFindMany.mock.calls[0]?.[0]?.select as Record<
      string,
      unknown
    >
    expect(select).toEqual({
      id: true,
      perfumeId: true,
      bottlePreference: true,
      createdAt: true,
      perfume: {
        select: {
          id: true,
          name: true,
          slug: true,
          image: true,
          perfumeHouse: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    })
    expect(select).not.toHaveProperty("userId")
    expect(select).not.toHaveProperty("isPublic")
    expect(select).not.toHaveProperty("user")
  })
})
