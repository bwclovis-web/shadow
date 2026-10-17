import { beforeEach, describe, expect, it, vi } from "vitest"

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  prisma: {
    userPerfume: {
      findMany: findManyMock,
    },
  },
}))

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => fn,
}))

import {
  getCachedHomeLatestListings,
  getHomeLatestListings,
} from "./home-listings.server"

const createdAt = new Date("2026-05-20T12:00:00.000Z")

const row = {
  id: "up-1",
  createdAt,
  images: ["https://example.com/photo.jpg"],
  available: "10",
  type: "eauDeParfum",
  condition: "lightlyUsed",
  decantFormat: "atomizer",
  tradePreference: "both",
  tradeOnly: false,
  perfume: {
    id: "p-1",
    name: "Lost Cherry",
    slug: "lost-cherry",
    image: "https://example.com/catalog.jpg",
    perfumeHouse: { name: "Tom Ford" },
  },
  user: {
    id: "u-1",
    username: "noirnose",
    firstName: "Ada",
    lastName: "Lovelace",
    avatarImage: null,
  },
}

describe("home-listings.server", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads up to four visible listings newest first", async () => {
    findManyMock.mockResolvedValue([])

    await getHomeLatestListings()

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          available: { not: "0" },
          user: { isBanned: false },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      })
    )
  })

  it("never selects private trader fields", async () => {
    findManyMock.mockResolvedValue([])

    await getHomeLatestListings()

    const userSelect = findManyMock.mock.calls[0]?.[0].select.user.select
    expect(userSelect).not.toHaveProperty("email")
    expect(userSelect).not.toHaveProperty("password")
  })

  it("maps rows to the public homepage DTO", async () => {
    findManyMock.mockResolvedValue([row])

    const [listing] = await getHomeLatestListings()

    expect(listing).toEqual({
      id: "up-1",
      createdAt,
      images: ["https://example.com/photo.jpg"],
      availableMl: "10",
      type: "eauDeParfum",
      condition: "lightlyUsed",
      decantFormat: "atomizer",
      tradePreference: "both",
      tradeOnly: false,
      perfume: {
        id: "p-1",
        name: "Lost Cherry",
        slug: "lost-cherry",
        image: "https://example.com/catalog.jpg",
        houseName: "Tom Ford",
      },
      trader: {
        id: "u-1",
        displayName: "noirnose",
        avatarImage: null,
      },
    })
    expect(JSON.stringify(listing)).not.toContain("Lovelace")
  })

  it("keeps a missing house as null", async () => {
    findManyMock.mockResolvedValue([
      { ...row, perfume: { ...row.perfume, perfumeHouse: null } },
    ])

    const [listing] = await getHomeLatestListings()

    expect(listing?.perfume.houseName).toBeNull()
  })

  it("rehydrates createdAt after caching", async () => {
    findManyMock.mockResolvedValue([
      { ...row, createdAt: createdAt.toISOString() },
    ])

    const [listing] = await getCachedHomeLatestListings()

    expect(listing?.createdAt).toBeInstanceOf(Date)
    expect(listing?.createdAt.getTime()).toBe(createdAt.getTime())
  })
})
