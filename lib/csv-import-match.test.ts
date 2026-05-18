import { describe, expect, it } from "vitest"

import {
  CONFIDENT_THRESHOLD,
  isExactCatalogMatch,
  matchCsvRowsAgainstCatalog,
  scoreRowAgainstCatalog,
  tokenSimilarity,
  UNCERTAIN_THRESHOLD,
} from "@/lib/csv-import-match"

const catalog = [
  { id: "p1", name: "Aventus", houseName: "Creed" },
  { id: "p2", name: "Aventus Cologne", houseName: "Creed" },
  { id: "p3", name: "Black Orchid", houseName: "Tom Ford" },
]

describe("tokenSimilarity", () => {
  it("returns 1 for identical normalized strings", () => {
    expect(tokenSimilarity("aventus", "aventus")).toBe(1)
  })

  it("returns 0 for empty input", () => {
    expect(tokenSimilarity("", "aventus")).toBe(0)
  })
})

describe("isExactCatalogMatch", () => {
  it("requires house when row provides house", () => {
    expect(isExactCatalogMatch("Aventus", "Creed", catalog[0]!)).toBe(true)
    expect(isExactCatalogMatch("Aventus", "Tom Ford", catalog[0]!)).toBe(false)
  })
})

describe("scoreRowAgainstCatalog", () => {
  it("returns confident for exact name and house", () => {
    const result = scoreRowAgainstCatalog(
      { rowIndex: 1, perfumeName: "Aventus", house: "Creed" },
      catalog
    )
    expect(result.bucket).toBe("confident")
    expect(result.match?.perfumeId).toBe("p1")
  })

  it("returns noMatch when house filters out all candidates", () => {
    const result = scoreRowAgainstCatalog(
      { rowIndex: 2, perfumeName: "Black Orchid", house: "Creed" },
      catalog
    )
    expect(result.bucket).toBe("noMatch")
  })

  it("returns uncertain or confident for close but not exact names", () => {
    const result = scoreRowAgainstCatalog(
      { rowIndex: 3, perfumeName: "Aventus Cologne", house: "Creed" },
      catalog
    )
    expect(result.bucket).not.toBe("noMatch")
    expect(result.match?.perfumeId).toBe("p2")
  })
})

describe("matchCsvRowsAgainstCatalog", () => {
  it("uses name-scoped catalog for rows without house", () => {
    const matches = matchCsvRowsAgainstCatalog(
      [{ rowIndex: 1, perfumeName: "Black Orchid", house: "" }],
      catalog,
      catalog
    )
    expect(matches[0]?.bucket).not.toBe("noMatch")
    expect(matches[0]?.match?.perfumeId).toBe("p3")
  })
})

describe("thresholds", () => {
  it("keeps confident above uncertain", () => {
    expect(CONFIDENT_THRESHOLD).toBeGreaterThan(UNCERTAIN_THRESHOLD)
  })
})
