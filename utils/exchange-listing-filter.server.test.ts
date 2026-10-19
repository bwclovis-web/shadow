import { describe, expect, it } from "vitest"

import { emptyDiscoveryFilters } from "@/utils/discovery-filters"
import {
  buildExchangeListingUserPerfumeWhere,
  buildUserRegionWhereForExchangeBucket,
  hasExchangeListingFilters,
  hasOfferLevelDiscoveryFilters,
  mergeUserPerfumeListingWhere,
} from "@/utils/exchange-listing-filter.server"

describe("hasExchangeListingFilters", () => {
  it("is false for empty discovery", () => {
    expect(hasExchangeListingFilters(emptyDiscoveryFilters())).toBe(false)
    expect(hasExchangeListingFilters(undefined)).toBe(false)
  })

  it("is true when listing dimensions set", () => {
    expect(
      hasExchangeListingFilters({
        ...emptyDiscoveryFilters(),
        tradePreferences: ["cash"],
      })
    ).toBe(true)
    expect(
      hasExchangeListingFilters({
        ...emptyDiscoveryFilters(),
        bottleTypes: ["decant"],
      })
    ).toBe(true)
    expect(
      hasExchangeListingFilters({
        ...emptyDiscoveryFilters(),
        minPrice: 10,
      })
    ).toBe(true)
  })
})

describe("hasOfferLevelDiscoveryFilters", () => {
  it("includes minRep as offer-level", () => {
    expect(
      hasOfferLevelDiscoveryFilters({
        ...emptyDiscoveryFilters(),
        minRep: 70,
      })
    ).toBe(true)
  })
})

describe("mergeUserPerfumeListingWhere same-offer AND", () => {
  it("ANDs trade + price id list on one listing row", () => {
    const tradeWhere = buildExchangeListingUserPerfumeWhere({
      ...emptyDiscoveryFilters(),
      tradePreferences: ["cash"],
    })
    const merged = mergeUserPerfumeListingWhere(
      { available: { not: "0" } },
      tradeWhere,
      ["listing-in-price-range"]
    )
    expect(merged).toEqual({
      AND: [
        { available: { not: "0" } },
        {
          OR: [{ tradeOnly: false, tradePreference: "cash" }],
        },
        { id: { in: ["listing-in-price-range"] } },
      ],
    })
  })

  it("does not let trade-only on listing A satisfy price on listing B", () => {
    // Documented contract: price ids and trade prefs share one UserPerfume where (AND).
    const tradeWhere = buildExchangeListingUserPerfumeWhere({
      ...emptyDiscoveryFilters(),
      tradePreferences: ["trade"],
    })
    const merged = mergeUserPerfumeListingWhere(
      { available: { not: "0" } },
      tradeWhere,
      ["price-match-id"]
    )
    expect(JSON.stringify(merged)).toContain("price-match-id")
    expect(JSON.stringify(merged)).toContain("trade")
    expect(merged).toHaveProperty("AND")
  })
})

describe("buildExchangeListingUserPerfumeWhere", () => {
  it("builds trade preference OR clause", () => {
    const where = buildExchangeListingUserPerfumeWhere({
      ...emptyDiscoveryFilters(),
      tradePreferences: ["cash", "trade"],
    })
    expect(where).toMatchObject({
      OR: [
        { tradeOnly: false, tradePreference: "cash" },
        { OR: [{ tradeOnly: true }, { tradePreference: "trade" }] },
      ],
    })
  })

  it("includes hasPhotos and condition constraints", () => {
    const where = buildExchangeListingUserPerfumeWhere({
      ...emptyDiscoveryFilters(),
      conditions: ["mint"],
      hasPhotos: true,
    })
    expect(where).toMatchObject({
      AND: [
        { condition: { in: ["mint"] } },
        { NOT: { images: { equals: [] } } },
      ],
    })
  })
})

describe("buildUserRegionWhereForExchangeBucket", () => {
  it("matches US legacy and country name values", () => {
    expect(buildUserRegionWhereForExchangeBucket("US")).toMatchObject({
      OR: expect.arrayContaining([{ region: "United States" }, { region: "US" }]),
    })
  })
})
