import { describe, expect, it } from "vitest"

import {
  regionsShareExchangeBucket,
  resolveExchangeRegionBucket,
} from "./region-bucket"

describe("resolveExchangeRegionBucket", () => {
  it("returns null for empty input", () => {
    expect(resolveExchangeRegionBucket(null)).toBeNull()
    expect(resolveExchangeRegionBucket("")).toBeNull()
    expect(resolveExchangeRegionBucket("   ")).toBeNull()
  })

  it("maps US aliases", () => {
    expect(resolveExchangeRegionBucket("United States")).toBe("US")
    expect(resolveExchangeRegionBucket("us")).toBe("US")
    expect(resolveExchangeRegionBucket("USA")).toBe("US")
  })

  it("maps UK and EU aliases", () => {
    expect(resolveExchangeRegionBucket("United Kingdom")).toBe("UK")
    expect(resolveExchangeRegionBucket("gb")).toBe("UK")
    expect(resolveExchangeRegionBucket("Europe")).toBe("EU")
    expect(resolveExchangeRegionBucket("eu")).toBe("EU")
  })

  it("accepts canonical bucket tokens", () => {
    expect(resolveExchangeRegionBucket("AU")).toBe("AU")
    expect(resolveExchangeRegionBucket("other")).toBe("other")
  })
})

describe("regionsShareExchangeBucket", () => {
  it("matches equivalent region strings", () => {
    expect(regionsShareExchangeBucket("United States", "US")).toBe(true)
    expect(regionsShareExchangeBucket("UK", "United Kingdom")).toBe(true)
  })

  it("returns false when either region is unknown", () => {
    expect(regionsShareExchangeBucket("Canada", "US")).toBe(false)
    expect(regionsShareExchangeBucket(null, "US")).toBe(false)
  })
})
