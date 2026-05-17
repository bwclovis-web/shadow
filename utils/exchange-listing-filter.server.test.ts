import { describe, expect, it } from "vitest"

import { emptyDiscoveryFilters } from "@/utils/discovery-filters"
import {
  buildExchangeListingUserPerfumeWhere,
  buildUserRegionWhereForExchangeBucket,
  hasExchangeListingFilters,
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
