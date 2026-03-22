import { describe, expect, it } from "vitest"

import { compareIdsExceedMax, normalizeCompareIds } from "@/utils/compare-ids"

describe("normalizeCompareIds", () => {
  it("trims, drops empties, dedupes preserving order", () => {
    expect(normalizeCompareIds(["  a ", "", "b", "a", "c"])).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("returns empty for all-empty input", () => {
    expect(normalizeCompareIds(["", "  "])).toEqual([])
  })
})

describe("compareIdsExceedMax", () => {
  it("is false at exactly max", () => {
    expect(compareIdsExceedMax(["a", "b", "c"])).toBe(false)
  })

  it("is true above max", () => {
    expect(compareIdsExceedMax(["a", "b", "c", "d"])).toBe(true)
  })
})
