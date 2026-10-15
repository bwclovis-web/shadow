import { describe, expect, it } from "vitest"

import { buildAdsTxtLine, shouldShowAds } from "./should-show-ads"

describe("buildAdsTxtLine", () => {
  it("converts a ca-pub client ID to an ads.txt record", () => {
    expect(buildAdsTxtLine("ca-pub-1234567890123456")).toBe(
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0"
    )
  })

  it("accepts a bare pub ID", () => {
    expect(buildAdsTxtLine(" pub-1234567890123456 ")).toBe(
      "google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0"
    )
  })

  it("returns undefined for missing or malformed IDs", () => {
    expect(buildAdsTxtLine(undefined)).toBeUndefined()
    expect(buildAdsTxtLine("")).toBeUndefined()
    expect(buildAdsTxtLine("ca-pub-XXXXXXXXXXXXXXXX")).toBeUndefined()
  })
})

describe("shouldShowAds", () => {
  it("shows ads for anonymous viewers", () => {
    expect(shouldShowAds(null)).toBe(true)
    expect(shouldShowAds(undefined)).toBe(true)
  })

  it("hides ads for paid members", () => {
    expect(
      shouldShowAds({ subscriptionStatus: "paid", isEarlyAdopter: false })
    ).toBe(false)
  })

  it("hides ads for early adopters", () => {
    expect(
      shouldShowAds({ subscriptionStatus: "free", isEarlyAdopter: true })
    ).toBe(false)
  })

  it("shows ads for unpaid non-early-adopters", () => {
    expect(
      shouldShowAds({ subscriptionStatus: "free", isEarlyAdopter: false })
    ).toBe(true)
    expect(
      shouldShowAds({ subscriptionStatus: "cancelled", isEarlyAdopter: false })
    ).toBe(true)
  })
})
