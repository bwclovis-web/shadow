import { describe, expect, it } from "vitest"

import {
  clearDiscoveryHouse,
  clearDiscoveryPrice,
  DISCOVERY_QUERY,
  discoveryFiltersActive,
  discoveryFiltersToSearchParams,
  emptyDiscoveryFilters,
  parseDiscoveryFiltersFromSearchParams,
  parseListingPriceToNumber,
  removeDiscoveryNoteId,
  removeDiscoverySeason,
  seasonsArrayToSelection,
  selectionToSeasonsArray,
} from "@/utils/discovery-filters"

describe("parseListingPriceToNumber", () => {
  it("parses plain numbers", () => {
    expect(parseListingPriceToNumber("49.99")).toBe(49.99)
    expect(parseListingPriceToNumber("120")).toBe(120)
  })

  it("strips currency and symbols", () => {
    expect(parseListingPriceToNumber("$89.00")).toBe(89)
    expect(parseListingPriceToNumber("€45.50")).toBe(45.5)
  })

  it("returns null for empty or invalid", () => {
    expect(parseListingPriceToNumber("")).toBeNull()
    expect(parseListingPriceToNumber("  ")).toBeNull()
    expect(parseListingPriceToNumber("abc")).toBeNull()
    expect(parseListingPriceToNumber(undefined)).toBeNull()
  })
})

describe("parseDiscoveryFiltersFromSearchParams", () => {
  it("round-trips via URLSearchParams", () => {
    const initial = {
      ...emptyDiscoveryFilters(),
      noteIds: ["clxxxxxxxxxxxxxxxxxxxxxx01", "clxxxxxxxxxxxxxxxxxxxxxx02"],
      seasons: ["spring", "winter"] as const,
      houseId: "clxxxxxxxxxxxxxxxxxxxxxx03",
      minPrice: 10,
      maxPrice: 100,
    }
    const sp = discoveryFiltersToSearchParams(initial)
    const parsed = parseDiscoveryFiltersFromSearchParams(sp)
    expect(parsed.noteIds).toEqual(initial.noteIds)
    expect(parsed.seasons.sort()).toEqual(["spring", "winter"].sort())
    expect(parsed.houseId).toBe(initial.houseId)
    expect(parsed.minPrice).toBe(10)
    expect(parsed.maxPrice).toBe(100)
  })

  it("drops invalid note and house ids", () => {
    const sp = new URLSearchParams()
    sp.set(DISCOVERY_QUERY.notes, "short,bad,clxxxxxxxxxxxxxxxxxxxxxx01")
    sp.set(DISCOVERY_QUERY.house, "nope")
    const parsed = parseDiscoveryFiltersFromSearchParams(sp)
    expect(parsed.noteIds).toEqual(["clxxxxxxxxxxxxxxxxxxxxxx01"])
    expect(parsed.houseId).toBeNull()
  })

  it("swaps min and max when min greater than max", () => {
    const sp = new URLSearchParams()
    sp.set(DISCOVERY_QUERY.minPrice, "200")
    sp.set(DISCOVERY_QUERY.maxPrice, "50")
    const parsed = parseDiscoveryFiltersFromSearchParams(sp)
    expect(parsed.minPrice).toBe(50)
    expect(parsed.maxPrice).toBe(200)
  })

  it("reads from Record-shaped searchParams", () => {
    const parsed = parseDiscoveryFiltersFromSearchParams({
      [DISCOVERY_QUERY.season]: "summer,invalid,fall",
    })
    expect(parsed.seasons.sort()).toEqual(["fall", "summer"].sort())
  })
})

describe("discoveryFiltersActive", () => {
  it("is false for empty filters", () => {
    expect(discoveryFiltersActive(emptyDiscoveryFilters())).toBe(false)
  })

  it("is true when any dimension set", () => {
    expect(
      discoveryFiltersActive({
        ...emptyDiscoveryFilters(),
        noteIds: ["clxxxxxxxxxxxxxxxxxxxxxx01"],
        seasons: [],
        houseId: null,
        minPrice: null,
        maxPrice: null,
      })
    ).toBe(true)
  })
})

describe("seasonsArrayToSelection / selectionToSeasonsArray", () => {
  it("round-trips", () => {
    const arr = ["winter", "summer"] as const
    expect(selectionToSeasonsArray(seasonsArrayToSelection([...arr]))).toEqual([
      "winter",
      "summer",
    ])
  })
})

describe("removeDiscoveryNoteId", () => {
  it("removes one note id", () => {
    const base = {
      ...emptyDiscoveryFilters(),
      noteIds: ["clxxxxxxxxxxxxxxxxxxxxxx01", "clxxxxxxxxxxxxxxxxxxxxxx02"],
    }
    const next = removeDiscoveryNoteId(base, "clxxxxxxxxxxxxxxxxxxxxxx01")
    expect(next.noteIds).toEqual(["clxxxxxxxxxxxxxxxxxxxxxx02"])
  })
})

describe("removeDiscoverySeason", () => {
  it("removes one season", () => {
    const base = {
      ...emptyDiscoveryFilters(),
      seasons: ["spring", "summer"] as const,
    }
    const next = removeDiscoverySeason(base, "spring")
    expect(next.seasons).toEqual(["summer"])
  })
})

describe("clearDiscoveryHouse", () => {
  it("clears houseId", () => {
    const base = {
      ...emptyDiscoveryFilters(),
      houseId: "clxxxxxxxxxxxxxxxxxxxxxx03",
    }
    expect(clearDiscoveryHouse(base).houseId).toBeNull()
  })
})

describe("clearDiscoveryPrice", () => {
  it("clears min and max", () => {
    const base = {
      ...emptyDiscoveryFilters(),
      minPrice: 10,
      maxPrice: 99,
    }
    const next = clearDiscoveryPrice(base)
    expect(next.minPrice).toBeNull()
    expect(next.maxPrice).toBeNull()
  })
})
