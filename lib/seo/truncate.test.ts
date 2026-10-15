import { describe, expect, it } from "vitest"

import { isUsableSeoDescription, truncateDescription } from "./truncate"

describe("isUsableSeoDescription", () => {
  it("rejects empty and whitespace", () => {
    expect(isUsableSeoDescription(null)).toBe(false)
    expect(isUsableSeoDescription(undefined)).toBe(false)
    expect(isUsableSeoDescription("")).toBe(false)
    expect(isUsableSeoDescription("   ")).toBe(false)
  })

  it("rejects year-only scrape junk", () => {
    expect(isUsableSeoDescription("2012")).toBe(false)
    expect(isUsableSeoDescription("2012.0")).toBe(false)
    expect(isUsableSeoDescription("2016.00")).toBe(false)
    expect(isUsableSeoDescription("  2008.0  ")).toBe(false)
  })

  it("rejects short pure numbers", () => {
    expect(isUsableSeoDescription("42")).toBe(false)
    expect(isUsableSeoDescription("3.14")).toBe(false)
  })

  it("accepts real descriptions", () => {
    expect(isUsableSeoDescription("A dark floral with rose and oud.")).toBe(
      true
    )
    expect(
      isUsableSeoDescription("Released in 2012 as a limited edition.")
    ).toBe(true)
  })
})

describe("truncateDescription", () => {
  it("returns undefined for year-only junk so callers can fall back", () => {
    expect(truncateDescription("2012.0")).toBeUndefined()
    expect(truncateDescription("2000.0")).toBeUndefined()
  })

  it("truncates long usable copy", () => {
    const long = "a".repeat(200)
    const result = truncateDescription(long)
    expect(result).toBeDefined()
    expect(result!.length).toBe(160)
    expect(result!.endsWith("…")).toBe(true)
  })

  it("preserves short usable copy", () => {
    expect(truncateDescription("A citrus cologne.")).toBe("A citrus cologne.")
  })
})
