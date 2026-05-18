import { describe, expect, it } from "vitest"

import {
  getActiveListings,
  getBottleEntries,
  getInventoryListingStatus,
  getListingKind,
  getPausedListings,
  getResumeListingMl,
  isActiveListing,
  isCollectionBottle,
  isPausedListing,
  parseMl,
} from "@/lib/user-inventory"

describe("parseMl", () => {
  it("parses numeric strings and strips units", () => {
    expect(parseMl("50ml")).toBe(50)
    expect(parseMl("")).toBe(0)
    expect(parseMl(null)).toBe(0)
  })
})

describe("isCollectionBottle", () => {
  it("treats amount greater than zero as collection bottle", () => {
    expect(isCollectionBottle({ id: "1", perfumeId: "p", amount: "100" })).toBe(true)
    expect(isCollectionBottle({ id: "1", perfumeId: "p", amount: "0" })).toBe(false)
  })
})

describe("isActiveListing", () => {
  it("treats available greater than zero as active listing", () => {
    expect(isActiveListing({ id: "1", perfumeId: "p", available: "5" })).toBe(true)
    expect(isActiveListing({ id: "1", perfumeId: "p", available: "0" })).toBe(false)
  })
})

describe("getListingKind", () => {
  it("classifies decant when decantFormat is set", () => {
    expect(
      getListingKind({
        id: "1",
        perfumeId: "p",
        available: "5",
        amount: "0",
        decantFormat: "vial",
      })
    ).toBe("decant")
  })

  it("classifies full bottle listing", () => {
    expect(
      getListingKind({
        id: "1",
        perfumeId: "p",
        available: "100",
        amount: "100",
      })
    ).toBe("full")
  })

  it("classifies partial listing", () => {
    expect(
      getListingKind({
        id: "1",
        perfumeId: "p",
        available: "30",
        amount: "100",
      })
    ).toBe("partial")
  })

  it("returns null when not listed", () => {
    expect(getListingKind({ id: "1", perfumeId: "p", available: "0", amount: "100" })).toBe(
      null
    )
  })
})

describe("getBottleEntries / getActiveListings", () => {
  const rows = [
    { id: "a", perfumeId: "p1", amount: "100", available: "0" },
    { id: "b", perfumeId: "p1", amount: "0", available: "10" },
    { id: "c", perfumeId: "p2", amount: "50", available: "20" },
  ]

  it("filters bottle entries", () => {
    expect(getBottleEntries(rows).map((r) => r.id)).toEqual(["a", "c"])
  })

  it("filters active listings", () => {
    expect(getActiveListings(rows).map((r) => r.id)).toEqual(["b", "c"])
  })
})

describe("isPausedListing / getPausedListings", () => {
  it("detects paused rows with stored ml", () => {
    const row = { id: "1", perfumeId: "p", available: "0", pausedAvailable: "15" }
    expect(isPausedListing(row)).toBe(true)
    expect(getResumeListingMl(row)).toBe(15)
    expect(getPausedListings([row])).toHaveLength(1)
  })

  it("ignores bottles that were never listed", () => {
    const row = { id: "1", perfumeId: "p", available: "0", amount: "100" }
    expect(isPausedListing(row)).toBe(false)
  })
})

describe("getInventoryListingStatus", () => {
  const rows = [
    { id: "a", perfumeId: "p1", amount: "100", available: "0" },
    { id: "b", perfumeId: "p1", amount: "0", available: "10" },
  ]

  it("returns notTrading when nothing listed for perfume", () => {
    expect(
      getInventoryListingStatus(
        { id: "a", perfumeId: "p1", amount: "100", available: "0" },
        [{ id: "a", perfumeId: "p1", amount: "100", available: "0" }]
      )
    ).toBe("notTrading")
  })

  it("returns listed when sibling destash is active", () => {
    expect(getInventoryListingStatus(rows[0], rows)).toBe("listed")
  })

  it("returns partiallyListed when bottle lists less than owned", () => {
    expect(
      getInventoryListingStatus(
        { id: "c", perfumeId: "p2", amount: "100", available: "30" },
        [{ id: "c", perfumeId: "p2", amount: "100", available: "30" }]
      )
    ).toBe("partiallyListed")
  })
})
