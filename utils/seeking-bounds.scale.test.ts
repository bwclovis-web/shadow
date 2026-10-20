/**
 * Isolated Seeking scale fixtures — not database benchmarks.
 * Confirms group/public/offer clamps stay bounded under large synthetic sets.
 * Do not seed production or shared DBs when running these.
 */
import { describe, expect, it } from "vitest"

import { EXCHANGE_OFFER_PAGE_SIZE } from "@/utils/exchange-constants"
import {
  clampSeekingPage,
  clampSeekingPageSize,
  SEEKING_GROUP_PAGE_SIZE,
} from "@/utils/seeking-constants"
import {
  seekingDataQueryKeyParts,
  withSeekingFilterChange,
  withSeekingViewChange,
} from "@/utils/seeking-params"

const pageSize = SEEKING_GROUP_PAGE_SIZE

/** Classify then paginate — mirrors server order (filter → group → skip/take). */
const classifyThenPage = (
  entries: Array<{ id: string; available: boolean; isPublic: boolean }>,
  opts: {
    visibility: "all" | "public" | "private"
    searchIds?: Set<string>
    group: "available" | "stillSeeking"
    page: number
  }
) => {
  let filtered = entries
  if (opts.visibility === "public") {
    filtered = filtered.filter(e => e.isPublic)
  } else if (opts.visibility === "private") {
    filtered = filtered.filter(e => !e.isPublic)
  }
  if (opts.searchIds) {
    filtered = filtered.filter(e => opts.searchIds!.has(e.id))
  }
  const groupIds = filtered
    .filter(e =>
      opts.group === "available" ? e.available : !e.available
    )
    .map(e => e.id)
  const totalCount = groupIds.length
  const { currentPage, totalPages, skip } = clampSeekingPage(
    opts.page,
    totalCount,
    pageSize
  )
  const items = groupIds.slice(skip, skip + pageSize)
  return { items, totalCount, currentPage, totalPages, skip }
}

const pageOffers = (offerIds: string[], take: number, cursorIndex: number) => {
  const size = Math.min(Math.max(take, 1), EXCHANGE_OFFER_PAGE_SIZE)
  const slice = offerIds.slice(cursorIndex, cursorIndex + size + 1)
  const page = slice.slice(0, size)
  return {
    page,
    hasMore: slice.length > size,
    pageSize: size,
  }
}

describe("seeking scale fixtures (isolated)", () => {
  it("pages 1,000+ Seeking entries at most SEEKING_GROUP_PAGE_SIZE (<=12) per request", () => {
    const entries = Array.from({ length: 1_250 }, (_, i) => ({
      id: `w-${i}`,
      available: i % 3 !== 0,
      isPublic: i % 2 === 0,
    }))

    const available = classifyThenPage(entries, {
      visibility: "all",
      group: "available",
      page: 1,
    })
    const still = classifyThenPage(entries, {
      visibility: "all",
      group: "stillSeeking",
      page: 4,
    })

    expect(pageSize).toBeLessThanOrEqual(12)
    expect(clampSeekingPageSize(999)).toBe(pageSize)
    expect(available.items).toHaveLength(pageSize)
    expect(available.totalCount).toBe(entries.filter(e => e.available).length)
    expect(still.items).toHaveLength(pageSize)
    expect(still.skip).toBe(3 * pageSize)
    expect(still.currentPage).toBe(4)
  })

  it("applies visibility and search before pagination and keeps independent group pages", () => {
    const entries = Array.from({ length: 1_100 }, (_, i) => ({
      id: `w-${i}`,
      available: i < 700,
      isPublic: i % 4 === 0,
    }))
    const searchIds = new Set(
      entries.filter((_, i) => i % 5 === 0).map(e => e.id)
    )

    const publicAvailable = classifyThenPage(entries, {
      visibility: "public",
      searchIds,
      group: "available",
      page: 2,
    })
    const privateStill = classifyThenPage(entries, {
      visibility: "private",
      searchIds,
      group: "stillSeeking",
      page: 1,
    })

    expect(publicAvailable.items.every(id => searchIds.has(id))).toBe(true)
    expect(
      publicAvailable.items.every(id => {
        const row = entries.find(e => e.id === id)!
        return row.isPublic && row.available
      })
    ).toBe(true)
    expect(publicAvailable.items).toHaveLength(
      Math.min(pageSize, publicAvailable.totalCount)
    )
    expect(privateStill.currentPage).toBe(1)
    expect(publicAvailable.currentPage).toBe(
      publicAvailable.totalCount > pageSize ? 2 : 1
    )
  })

  it("loads at most 5 offers per page when a fragrance has hundreds of offers", () => {
    const offerIds = Array.from({ length: 420 }, (_, i) => `offer-${i}`)
    const first = pageOffers(offerIds, 500, 0)
    expect(first.page).toHaveLength(EXCHANGE_OFFER_PAGE_SIZE)
    expect(first.pageSize).toBe(5)
    expect(first.hasMore).toBe(true)

    const second = pageOffers(offerIds, EXCHANGE_OFFER_PAGE_SIZE, 5)
    expect(second.page[0]).toBe("offer-5")
    expect(second.page).toHaveLength(EXCHANGE_OFFER_PAGE_SIZE)
  })

  it("never materializes a full wishlist id list for a bounded page DTO", () => {
    const total = 2_000
    const { skip } = clampSeekingPage(7, total, pageSize)
    const pageIds = Array.from({ length: pageSize }, (_, i) => `w-${skip + i}`)
    expect(pageIds).toHaveLength(pageSize)
    expect(pageIds.length).toBeLessThan(total)
    // Soft payload budget for one group page (no nested offers).
    const dto = pageIds.map(id => ({
      id,
      perfumeId: `p-${id}`,
      bottlePreference: "any",
      offerCount: 3,
      collectorCount: 2,
      perfume: {
        id: `p-${id}`,
        name: "Long Fragrance Name Example",
        slug: "slug",
        image: null,
        perfumeHouse: { id: "h", name: "House", slug: "house" },
      },
    }))
    const bytes = Buffer.byteLength(JSON.stringify(dto), "utf8")
    expect(bytes).toBeLessThan(50_000)
    expect(dto.every(row => !("userPerfume" in row))).toBe(true)
  })

  it("grid/list view toggle reuses data keys (view excluded from data key)", () => {
    const data = {
      search: "oud",
      visibility: "public" as const,
      availablePage: 3,
      seekingPage: 2,
    }
    const grid = withSeekingViewChange({ ...data, view: "grid" }, "grid")
    const list = withSeekingViewChange(grid, "list")
    expect(seekingDataQueryKeyParts(grid)).toEqual(seekingDataQueryKeyParts(list))
    expect(list.availablePage).toBe(3)
    expect(list.seekingPage).toBe(2)

    const filtered = withSeekingFilterChange(list, { search: "rose" })
    expect(filtered.availablePage).toBe(1)
    expect(filtered.seekingPage).toBe(1)
  })

  it("clamps last-page deletion so an empty trailing page is not requested", () => {
    // 7 items, page size 6 → 2 pages; delete down to 6 → clamp page 2 → 1
    const beforeDelete = clampSeekingPage(2, 7, pageSize)
    expect(beforeDelete.totalPages).toBe(2)
    expect(beforeDelete.currentPage).toBe(2)

    const afterDelete = clampSeekingPage(2, 6, pageSize)
    expect(afterDelete.totalPages).toBe(1)
    expect(afterDelete.currentPage).toBe(1)
    expect(afterDelete.skip).toBe(0)
  })
})
