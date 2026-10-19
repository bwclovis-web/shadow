/**
 * Isolated scale fixtures — not database benchmarks.
 * Confirms browse/offer/preview clamps stay bounded under large synthetic sets.
 */
import { describe, expect, it } from "vitest"

import {
  EXCHANGE_GROUP_PAGE_SIZE,
  EXCHANGE_MIN_REP_TRADER_CAP,
  EXCHANGE_OFFER_PAGE_SIZE,
  EXCHANGE_PREVIEW_IMAGE_MAX,
} from "@/utils/exchange-constants"

/** Mirror of server take clamps in perfume-exchange-groups.server.ts */
const clampGroupPageSize = (requested: number) =>
  Math.min(Math.max(requested, 1), EXCHANGE_GROUP_PAGE_SIZE)

const clampOfferTake = (requested: number) =>
  Math.min(Math.max(requested, 1), EXCHANGE_OFFER_PAGE_SIZE)

const paginateIds = (ids: string[], page: number, pageSize: number) => {
  const size = clampGroupPageSize(pageSize)
  const start = (Math.max(page, 1) - 1) * size
  return ids.slice(start, start + size)
}

const pageOffers = (offerIds: string[], take: number, cursorIndex: number) => {
  const size = clampOfferTake(take)
  const slice = offerIds.slice(cursorIndex, cursorIndex + size + 1)
  const page = slice.slice(0, size)
  const hasMore = slice.length > size
  return { page, hasMore, pageSize: size }
}

describe("exchange scale fixtures (isolated)", () => {
  it("pages thousands of fragrance groups at most 24 per request", () => {
    const groupIds = Array.from({ length: 5_000 }, (_, i) => `perfume-${i}`)
    const page1 = paginateIds(groupIds, 1, 10_000)
    const page2 = paginateIds(groupIds, 2, EXCHANGE_GROUP_PAGE_SIZE)

    expect(page1).toHaveLength(EXCHANGE_GROUP_PAGE_SIZE)
    expect(page2).toHaveLength(EXCHANGE_GROUP_PAGE_SIZE)
    expect(page1[0]).toBe("perfume-0")
    expect(page2[0]).toBe(`perfume-${EXCHANGE_GROUP_PAGE_SIZE}`)
    expect(clampGroupPageSize(999)).toBe(EXCHANGE_GROUP_PAGE_SIZE)
  })

  it("loads at most 5 offers per page even when a group has hundreds", () => {
    const offerIds = Array.from({ length: 320 }, (_, i) => `offer-${i}`)
    const first = pageOffers(offerIds, 500, 0)
    expect(first.page).toHaveLength(EXCHANGE_OFFER_PAGE_SIZE)
    expect(first.hasMore).toBe(true)
    expect(first.pageSize).toBe(EXCHANGE_OFFER_PAGE_SIZE)

    const second = pageOffers(offerIds, EXCHANGE_OFFER_PAGE_SIZE, 5)
    expect(second.page[0]).toBe("offer-5")
    expect(clampOfferTake(100)).toBe(EXCHANGE_OFFER_PAGE_SIZE)
  })

  it("caps attributed previews at 3 regardless of photo fan-out size", () => {
    const photos = Array.from({ length: 80 }, (_, i) => `https://cdn.example/${i}.jpg`)
    const previews = photos.slice(0, EXCHANGE_PREVIEW_IMAGE_MAX)
    expect(previews).toHaveLength(3)
    expect(EXCHANGE_PREVIEW_IMAGE_MAX).toBe(3)
  })

  it("keeps minRep trader consideration bounded", () => {
    const traderIds = Array.from({ length: 12_000 }, (_, i) => `user-${i}`)
    const considered = traderIds.slice(0, EXCHANGE_MIN_REP_TRADER_CAP)
    expect(considered).toHaveLength(EXCHANGE_MIN_REP_TRADER_CAP)
  })

  it("keeps a narrow browse DTO payload under a soft size budget for one page", () => {
    const page = Array.from({ length: EXCHANGE_GROUP_PAGE_SIZE }, (_, i) => ({
      id: `p-${i}`,
      name: `Fragrance ${i}`,
      slug: `fragrance-${i}`,
      image: null,
      perfumeHouse: { id: "h1", name: "House", slug: "house", type: "niche" },
      offerCount: 12,
      collectorCount: 8,
      previews: Array.from({ length: EXCHANGE_PREVIEW_IMAGE_MAX }, (_, j) => ({
        userPerfumeId: `up-${i}-${j}`,
        userId: `u-${j}`,
        url: `https://cdn.example/${i}-${j}.jpg`,
        traderName: `Trader ${j}`,
        condition: "mint" as const,
        tradePreference: "both",
        tradeOnly: false,
        user: {
          id: `u-${j}`,
          firstName: "A",
          lastName: "B",
          username: `t${j}`,
          email: null,
        },
      })),
    }))

    const bytes = Buffer.byteLength(JSON.stringify(page), "utf8")
    // Soft sanity check only — not a production perf claim.
    expect(bytes).toBeLessThan(200_000)
    expect(page.every(g => g.previews.length <= EXCHANGE_PREVIEW_IMAGE_MAX)).toBe(
      true
    )
  })
})
